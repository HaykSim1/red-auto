import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { InventoryRecognitionDto } from '../../common/dto/responses.dto';
import { ApiException } from '../../common/exceptions/api.exception';
import type { JwtUserPayload } from '../../common/interfaces/jwt-user-payload.interface';
import { InventoryRecognition } from '../../database/entities/inventory-recognition.entity';
import { User } from '../../database/entities/user.entity';
import { InventoryRecognitionStatus } from '../../database/enums';
import { normalizeMake } from '../catalog/car-brands';
import {
  OTHER_CATEGORY_KEY,
  isKnownCategoryKey,
} from '../catalog/part-categories';
import { CreateRecognitionDto } from '../dto/create-recognition.dto';
import { InventoryService } from '../inventory.service';
import {
  normalizeBarcode,
  normalizeOemNumbers,
  normalizePartNumber,
} from '../normalize';
import { assertInventoryKeys } from '../storage-keys';
import { S3ObjectReader } from './object-reader';
import { RECOGNITION_CLIENT } from './recognition-client';
import type { RecognitionClient } from './recognition-client';
import {
  RecognitionFitment,
  RecognitionResult,
  StoredRecognitionResult,
} from './recognition.schema';

const MAX_CONCURRENT = 3;
const MAX_PHOTOS = 3;
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT = 20;
const STALE_AFTER_MS = 5 * 60_000;
/** A poll finds a job this old still in flight → its process died. */
const LAZY_STALE_AFTER_MS = 3 * 60_000;
const ERROR_MESSAGE_MAX = 500;
const DEFAULT_DAILY_LIMIT = 500;

type Failure = { code: string; message: string };

// Limits mirror InventoryItemFieldsDto / FitmentDto, so a recognition result
// can be submitted as an item without a validation error.
const LIMITS = {
  oemCount: 30,
  oemLength: 120,
  fitmentCount: 50,
  fitmentText: 60,
  brand: 120,
  partNumber: 120,
  name: 200,
  fitmentNote: 500,
  notesForSeller: 1000,
  yearMin: 1950,
  yearMax: 2100,
} as const;

function cut(v: string, max: number): string;
function cut(v: string | null | undefined, max: number): string | null;
function cut(v: string | null | undefined, max: number): string | null {
  return v == null ? null : v.slice(0, max);
}

function year(n: number | null): number | null {
  if (n === null || !Number.isFinite(n)) return null;
  const y = Math.round(n);
  return y >= LIMITS.yearMin && y <= LIMITS.yearMax ? y : null;
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

function startOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function errorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, ERROR_MESSAGE_MAX);
}

@Injectable()
export class RecognitionService implements OnModuleInit {
  private readonly logger = new Logger(RecognitionService.name);
  private active = 0;
  /** FIFO of jobs waiting for a slot; each entry resumes one job. */
  private readonly waiting: (() => void)[] = [];

  constructor(
    @InjectRepository(InventoryRecognition)
    private readonly recognitions: Repository<InventoryRecognition>,
    @Inject(RECOGNITION_CLIENT) private readonly client: RecognitionClient,
    private readonly reader: S3ObjectReader,
    private readonly inventory: InventoryService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Never block bootstrap on this housekeeping (e.g. a brief DB outage).
    try {
      const swept = await this.sweepStale();
      if (swept > 0) {
        this.logger.warn(`Marked ${swept} interrupted recognition(s) failed`);
      }
    } catch (err) {
      this.logger.error(`Stale recognition sweep failed: ${errorMessage(err)}`);
    }
  }

  // ── Public API ──

  async start(
    user: JwtUserPayload,
    dto: CreateRecognitionDto,
  ): Promise<InventoryRecognitionDto> {
    if (!this.client.isConfigured()) {
      throw new ApiException(
        'ai_unconfigured',
        'Recognition is not configured.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const keys = dto.photo_storage_keys ?? [];
    if (keys.length < 1 || keys.length > MAX_PHOTOS) {
      throw new ApiException(
        'bad_request',
        `Send 1 to ${MAX_PHOTOS} photos.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    assertInventoryKeys(user.sub, keys);
    await this.assertQuota(user.sub);

    const row = await this.recognitions.save(
      this.recognitions.create({
        shop: { id: user.sub } as User,
        status: InventoryRecognitionStatus.PENDING,
        photoStorageKeys: keys,
        barcodeHint: dto.barcode_hint?.trim() || null,
        textHint: dto.text_hint?.trim() || null,
      }),
    );
    void this.process(row.id);
    return this.toDto(row);
  }

  async get(shopId: string, id: string): Promise<InventoryRecognitionDto> {
    const row = await this.recognitions.findOne({
      where: { id, shop: { id: shopId } },
    });
    if (!row) {
      throw new ApiException(
        'recognition_not_found',
        'Recognition not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (await this.failIfStale(row)) {
      return this.get(shopId, id);
    }
    return this.toDto(row);
  }

  /**
   * Lazy counterpart of the boot sweep: a poll that finds its job in flight
   * longer than any run can take (client timeout 140 s) fails it, so the
   * client stops waiting. The status filter makes a finishing job win.
   */
  private async failIfStale(row: InventoryRecognition): Promise<boolean> {
    const inFlight =
      row.status === InventoryRecognitionStatus.PENDING ||
      row.status === InventoryRecognitionStatus.PROCESSING;
    const cutoff = new Date(Date.now() - LAZY_STALE_AFTER_MS);
    if (!inFlight || row.createdAt >= cutoff) return false;
    const res = await this.recognitions.update(
      {
        id: row.id,
        status: In([
          InventoryRecognitionStatus.PENDING,
          InventoryRecognitionStatus.PROCESSING,
        ]),
        createdAt: LessThan(cutoff),
      },
      {
        status: InventoryRecognitionStatus.FAILED,
        errorCode: 'interrupted',
        errorMessage: 'Processing did not finish in time.',
        finishedAt: new Date(),
      },
    );
    return (res.affected ?? 0) > 0;
  }

  /** Fails rows a restart left in flight; returns how many were marked. */
  async sweepStale(): Promise<number> {
    const res = await this.recognitions.update(
      {
        status: In([
          InventoryRecognitionStatus.PENDING,
          InventoryRecognitionStatus.PROCESSING,
        ]),
        createdAt: LessThan(new Date(Date.now() - STALE_AFTER_MS)),
      },
      {
        status: InventoryRecognitionStatus.FAILED,
        errorCode: 'interrupted',
        errorMessage: 'Processing was interrupted by a server restart.',
        finishedAt: new Date(),
      },
    );
    return res.affected ?? 0;
  }

  // ── Job runner ──

  /** Runs one job once a slot is free. Never rejects. */
  private async process(id: string): Promise<void> {
    await this.acquire();
    try {
      await this.run(id);
    } catch (err) {
      // Only reachable if writing the failure itself failed.
      this.logger.error(`Recognition ${id} crashed: ${errorMessage(err)}`);
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < MAX_CONCURRENT) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waiting.push(resolve));
  }

  private release(): void {
    const next = this.waiting.shift();
    // Hand the slot straight to the next job; otherwise free it.
    if (next) next();
    else this.active--;
  }

  private async run(id: string): Promise<void> {
    const startedAt = Date.now();
    try {
      const row = await this.recognitions.findOne({
        where: { id },
        relations: { shop: true },
      });
      if (!row || row.status !== InventoryRecognitionStatus.PENDING) return;
      await this.recognitions.update(id, {
        status: InventoryRecognitionStatus.PROCESSING,
      });

      const images = await Promise.all(
        row.photoStorageKeys.map((k) => this.reader.getImage(k)),
      );
      const call = await this.client.recognize({
        images,
        hints: { barcode: row.barcodeHint, text: row.textHint },
      });
      const usage = {
        model: call.model,
        inputTokens: call.usage.inputTokens,
        outputTokens: call.usage.outputTokens,
        webSearchUses: call.usage.webSearchUses,
      };

      let failure: Failure | null = null;
      if (call.stopReason === 'refusal') {
        failure = { code: 'ai_refused', message: 'The model declined.' };
      } else if (call.parsed === null) {
        failure = {
          code: 'ai_parse_failed',
          message: `No valid structured output (stop_reason: ${call.stopReason}).`,
        };
      } else if (!call.parsed.is_part) {
        failure = {
          code: 'no_part_detected',
          message: 'The photos show no automotive part, box or label.',
        };
      }
      if (failure) {
        await this.fail(id, startedAt, failure, usage);
        return;
      }

      const result = this.postProcess(call.parsed!, row.barcodeHint);
      const duplicate = await this.inventory.findDuplicate(
        row.shop.id,
        normalizePartNumber(result.part_number),
        result.barcode,
      );
      await this.recognitions.update(id, {
        ...usage,
        status: InventoryRecognitionStatus.DONE,
        result,
        possibleDuplicateItemId: duplicate?.id ?? null,
        durationMs: Date.now() - startedAt,
        finishedAt: new Date(),
      });
    } catch (err) {
      this.logger.warn(`Recognition ${id} failed: ${errorMessage(err)}`);
      await this.fail(id, startedAt, {
        code: 'ai_error',
        message: errorMessage(err),
      });
    }
  }

  private async fail(
    id: string,
    startedAt: number,
    failure: Failure,
    usage: Partial<InventoryRecognition> = {},
  ): Promise<void> {
    await this.recognitions.update(id, {
      ...usage,
      status: InventoryRecognitionStatus.FAILED,
      errorCode: failure.code,
      errorMessage: failure.message.slice(0, ERROR_MESSAGE_MAX),
      durationMs: Date.now() - startedAt,
      finishedAt: new Date(),
    });
  }

  private postProcess(
    model: RecognitionResult,
    barcodeHint: string | null,
  ): StoredRecognitionResult {
    // `is_part` gated the run; it is not part of the stored result.
    const { is_part, ...parsed } = model;
    void is_part;
    const needsReview = new Set(parsed.needs_review);
    const confidence = {
      brand: clamp01(parsed.confidence.brand),
      part_number: clamp01(parsed.confidence.part_number),
      barcode: clamp01(parsed.confidence.barcode),
      name: clamp01(parsed.confidence.name),
      category_key: clamp01(parsed.confidence.category_key),
      fitments: clamp01(parsed.confidence.fitments),
    };

    // A scanned barcode is ground truth; the model often misses it on photos.
    const hinted = normalizeBarcode(barcodeHint);
    let barcode = normalizeBarcode(parsed.barcode);
    if (hinted) {
      barcode = hinted;
      confidence.barcode = 1;
      needsReview.delete('barcode');
    }

    let categoryKey = parsed.category_key;
    if (!isKnownCategoryKey(categoryKey)) {
      categoryKey = OTHER_CATEGORY_KEY;
      needsReview.add('category_key');
    }

    const oemAll = normalizeOemNumbers(parsed.oem_numbers);
    const oemNumbers = oemAll
      .slice(0, LIMITS.oemCount)
      .map((n) => n.slice(0, LIMITS.oemLength));
    if (
      oemAll.length > LIMITS.oemCount ||
      oemAll.some((n) => n.length > LIMITS.oemLength)
    ) {
      needsReview.add('oem_numbers');
    }

    const { fitments, trimmed } = this.cleanFitments(parsed.fitments);
    if (trimmed) needsReview.add('fitments');

    return {
      ...parsed,
      brand: cut(parsed.brand?.trim() || null, LIMITS.brand),
      part_number: cut(parsed.part_number?.trim() || null, LIMITS.partNumber),
      barcode,
      name: cut(parsed.name, LIMITS.name),
      name_en: cut(parsed.name_en, LIMITS.name),
      name_hy: cut(parsed.name_hy, LIMITS.name),
      oem_numbers: oemNumbers,
      fitments,
      fitment_note: cut(parsed.fitment_note, LIMITS.fitmentNote),
      notes_for_seller: cut(parsed.notes_for_seller, LIMITS.notesForSeller),
      category_key: categoryKey,
      confidence,
      needs_review: [...needsReview],
    };
  }

  /**
   * Drops rows without a make, caps count and text lengths, rounds years and
   * nulls ones outside 1950–2100. A reversed range is swapped: the model
   * read both years, just in the wrong order. `trimmed` is set when any row
   * was dropped or a value was cut/nulled (not for a swap or rounding).
   */
  private cleanFitments(raw: RecognitionFitment[]): {
    fitments: RecognitionFitment[];
    trimmed: boolean;
  } {
    let trimmed = false;
    const out: RecognitionFitment[] = [];
    for (const f of raw) {
      const fullMake = normalizeMake(f.make);
      if (!fullMake) {
        trimmed = true;
        continue;
      }
      if (out.length === LIMITS.fitmentCount) {
        trimmed = true;
        break;
      }
      let yearFrom = year(f.year_from);
      let yearTo = year(f.year_to);
      if (
        (f.year_from !== null && yearFrom === null) ||
        (f.year_to !== null && yearTo === null)
      ) {
        trimmed = true;
      }
      if (yearFrom !== null && yearTo !== null && yearFrom > yearTo) {
        [yearFrom, yearTo] = [yearTo, yearFrom];
      }
      const make = fullMake.slice(0, LIMITS.fitmentText);
      const model = cut(f.model, LIMITS.fitmentText);
      const engine = cut(f.engine, LIMITS.fitmentText);
      if (
        fullMake.length > LIMITS.fitmentText ||
        (f.model?.length ?? 0) > LIMITS.fitmentText ||
        (f.engine?.length ?? 0) > LIMITS.fitmentText
      ) {
        trimmed = true;
      }
      out.push({ make, model, year_from: yearFrom, year_to: yearTo, engine });
    }
    return { fitments: out, trimmed };
  }

  // ── Helpers ──

  private async assertQuota(shopId: string): Promise<void> {
    // 0 is a valid kill switch: every recognition is over quota.
    const configured = Number(
      this.config.get('AI_RECOGNITION_DAILY_LIMIT') ?? DEFAULT_DAILY_LIMIT,
    );
    const dailyLimit = Number.isFinite(configured)
      ? configured
      : DEFAULT_DAILY_LIMIT;
    const now = new Date();
    const today = await this.recognitions.count({
      where: {
        shop: { id: shopId },
        createdAt: MoreThanOrEqual(startOfUtcDay(now)),
      },
    });
    if (today >= dailyLimit) {
      throw new ApiException(
        'ai_quota_exceeded',
        'Daily recognition limit reached.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const recent = await this.recognitions.count({
      where: {
        shop: { id: shopId },
        createdAt: MoreThanOrEqual(new Date(now.getTime() - RATE_WINDOW_MS)),
      },
    });
    if (recent >= RATE_LIMIT) {
      throw new ApiException(
        'ai_rate_limited',
        'Too many recognitions; try again in a few minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private toDto(row: InventoryRecognition): InventoryRecognitionDto {
    return {
      id: row.id,
      status: row.status,
      result: row.result ?? null,
      possible_duplicate_item_id: row.possibleDuplicateItemId ?? null,
      error_code: row.errorCode ?? null,
      photo_storage_keys: row.photoStorageKeys ?? [],
      barcode_hint: row.barcodeHint ?? null,
      text_hint: row.textHint ?? null,
      created_at: row.createdAt.toISOString(),
      finished_at: row.finishedAt ? row.finishedAt.toISOString() : null,
    };
  }
}
