import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOperator } from 'typeorm';
import { ApiException } from '../../common/exceptions/api.exception';
import type { JwtUserPayload } from '../../common/interfaces/jwt-user-payload.interface';
import { InventoryRecognition } from '../../database/entities/inventory-recognition.entity';
import { InventoryRecognitionStatus, UserRole } from '../../database/enums';
import { InventoryService } from '../inventory.service';
import { S3ObjectReader } from './object-reader';
import {
  RECOGNITION_CLIENT,
  RecognitionCallResult,
} from './recognition-client';
import { RecognitionResult } from './recognition.schema';
import { RecognitionService } from './recognition.service';

const SHOP = 'shop-1';
const USER: JwtUserPayload = {
  sub: SHOP,
  role: UserRole.SELLER,
  phone_verified: true,
};
const KEY = (n: number) => `inventory/${SHOP}/photo-${n}.png`;

function parsed(over: Partial<RecognitionResult> = {}): RecognitionResult {
  return {
    brand: 'Bosch',
    part_number: '0 986 494 527',
    barcode: null,
    name: 'Тормозные колодки',
    name_en: 'Brake pads',
    name_hy: 'Արգելակային կոճղակներ',
    category_key: 'brakes.pads',
    oem_numbers: ['04465-02220', '0446502220', ' 04465 33450 '],
    fitments: [
      {
        make: 'toyota',
        model: 'Corolla',
        year_from: 2013,
        year_to: 2018,
        engine: null,
      },
    ],
    fitment_note: null,
    condition: 'new',
    confidence: {
      brand: 1.3,
      part_number: 0.9,
      barcode: -0.2,
      name: Number.NaN,
      category_key: 0.8,
      fitments: 0.7,
    },
    needs_review: [],
    notes_for_seller: null,
    ...over,
  };
}

function call(
  over: Partial<RecognitionCallResult> = {},
): RecognitionCallResult {
  return {
    parsed: parsed(),
    stopReason: 'end_turn',
    usage: { inputTokens: 25000, outputTokens: 1800, webSearchUses: 3 },
    model: 'claude-opus-5-5',
    ...over,
  };
}

describe('RecognitionService', () => {
  let service: RecognitionService;
  let store: InventoryRecognition[];
  let repo: Record<string, jest.Mock>;
  let client: { isConfigured: jest.Mock; recognize: jest.Mock };
  let reader: { getImage: jest.Mock };
  let inventory: { findDuplicate: jest.Mock };

  const row = (over: Partial<InventoryRecognition> = {}) => {
    const r = {
      id: `rec-${store.length + 1}`,
      shop: { id: SHOP },
      status: InventoryRecognitionStatus.PENDING,
      photoStorageKeys: [KEY(1)],
      barcodeHint: null,
      textHint: null,
      result: null,
      possibleDuplicateItemId: null,
      errorCode: null,
      errorMessage: null,
      model: null,
      inputTokens: null,
      outputTokens: null,
      webSearchUses: null,
      durationMs: null,
      createdAt: new Date(),
      finishedAt: null,
      ...over,
    } as unknown as InventoryRecognition;
    store.push(r);
    return r;
  };

  const process = (id: string): Promise<void> =>
    (service as unknown as { process(id: string): Promise<void> }).process(id);

  let dailyLimit: number;

  beforeEach(async () => {
    dailyLimit = 500;
    store = [];
    repo = {
      create: jest.fn((v: Partial<InventoryRecognition>) => v),
      save: jest.fn((v: Partial<InventoryRecognition>) =>
        Promise.resolve(row(v)),
      ),
      findOne: jest.fn(
        (opts: { where: { id: string; shop?: { id: string } } }) =>
          Promise.resolve(
            store.find(
              (r) =>
                r.id === opts.where.id &&
                (!opts.where.shop || r.shop.id === opts.where.shop.id),
            ) ?? null,
          ),
      ),
      update: jest.fn(
        (
          criteria: string | Record<string, FindOperator<unknown>>,
          patch: Partial<InventoryRecognition>,
        ) => {
          let hits: InventoryRecognition[];
          if (typeof criteria === 'string') {
            hits = store.filter((r) => r.id === criteria);
          } else {
            const statuses = criteria.status.value as string[];
            const before = criteria.createdAt.value as Date;
            hits = store.filter(
              (r) => statuses.includes(r.status) && r.createdAt < before,
            );
          }
          hits.forEach((r) => Object.assign(r, patch));
          return Promise.resolve({ affected: hits.length });
        },
      ),
      count: jest.fn(() => Promise.resolve(0)),
    };
    client = {
      isConfigured: jest.fn(() => true),
      recognize: jest.fn(() => Promise.resolve(call())),
    };
    reader = {
      getImage: jest.fn(() =>
        Promise.resolve({ media_type: 'image/png', data: 'AAAA' }),
      ),
    };
    inventory = { findDuplicate: jest.fn(() => Promise.resolve(null)) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RecognitionService,
        {
          provide: getRepositoryToken(InventoryRecognition),
          useValue: repo,
        },
        { provide: RECOGNITION_CLIENT, useValue: client },
        { provide: S3ObjectReader, useValue: reader },
        { provide: InventoryService, useValue: inventory },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) =>
              k === 'AI_RECOGNITION_DAILY_LIMIT' ? dailyLimit : undefined,
          },
        },
      ],
    }).compile();
    service = moduleRef.get(RecognitionService);
  });

  async function expectCode(p: Promise<unknown>, code: string, status: number) {
    const err = await p.then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ApiException);
    expect((err as ApiException).code).toBe(code);
    expect((err as ApiException).getStatus()).toBe(status);
  }

  it('start throws ai_unconfigured when the client is not configured', async () => {
    client.isConfigured.mockReturnValue(false);
    await expectCode(
      service.start(USER, { photo_storage_keys: [KEY(1)] }),
      'ai_unconfigured',
      503,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('start rejects a 4th photo and foreign keys', async () => {
    const spy = jest
      .spyOn(service as unknown as { process(): Promise<void> }, 'process')
      .mockResolvedValue(undefined);
    await expectCode(
      service.start(USER, {
        photo_storage_keys: [KEY(1), KEY(2), KEY(3), KEY(4)],
      }),
      'bad_request',
      400,
    );
    await expectCode(
      service.start(USER, {
        photo_storage_keys: ['inventory/other-shop/x.png'],
      }),
      'inventory_photo_key_forbidden',
      403,
    );
    expect(repo.save).not.toHaveBeenCalled();

    const dto = await service.start(USER, {
      photo_storage_keys: [KEY(1), KEY(2), KEY(3)],
      barcode_hint: ' 4047024063303 ',
      text_hint: 'front axle',
    });
    expect(dto).toMatchObject({
      id: 'rec-1',
      status: 'pending',
      result: null,
      possible_duplicate_item_id: null,
      error_code: null,
      finished_at: null,
      photo_storage_keys: [KEY(1), KEY(2), KEY(3)],
      barcode_hint: '4047024063303',
      text_hint: 'front axle',
    });
    expect(store[0]).toMatchObject({
      shop: { id: SHOP },
      barcodeHint: '4047024063303',
      textHint: 'front axle',
    });
    expect(spy).toHaveBeenCalledWith('rec-1');
  });

  it('start enforces the daily quota (ai_quota_exceeded) and the 10-minute rate (ai_rate_limited)', async () => {
    jest
      .spyOn(service as unknown as { process(): Promise<void> }, 'process')
      .mockResolvedValue(undefined);
    repo.count.mockResolvedValueOnce(500);
    await expectCode(
      service.start(USER, { photo_storage_keys: [KEY(1)] }),
      'ai_quota_exceeded',
      429,
    );
    repo.count.mockResolvedValueOnce(499).mockResolvedValueOnce(20);
    await expectCode(
      service.start(USER, { photo_storage_keys: [KEY(1)] }),
      'ai_rate_limited',
      429,
    );
    expect(repo.save).not.toHaveBeenCalled();

    // Daily window starts at UTC midnight; rate window is the last 10 minutes.
    type CountArgs = {
      where: { shop: { id: string }; createdAt: FindOperator<Date> };
    };
    const countWhere = (i: number) =>
      (repo.count.mock.calls[i] as [CountArgs])[0].where;
    const dayWhere = countWhere(0);
    const rateWhere = countWhere(2);
    const dayStart = dayWhere.createdAt.value;
    expect(dayStart.getUTCHours()).toBe(0);
    expect(dayStart.getUTCMinutes()).toBe(0);
    expect(Date.now() - dayStart.getTime()).toBeLessThan(86_400_000);
    const rateStart = rateWhere.createdAt.value;
    expect(Math.abs(Date.now() - rateStart.getTime() - 600_000)).toBeLessThan(
      5_000,
    );
    expect(dayWhere.shop).toEqual({ id: SHOP });

    // A daily limit of 0 is a kill switch, not "use the default".
    dailyLimit = 0;
    repo.count.mockResolvedValue(0);
    await expectCode(
      service.start(USER, { photo_storage_keys: [KEY(1)] }),
      'ai_quota_exceeded',
      429,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('process stores a done result with normalized numbers, make and duplicate id', async () => {
    inventory.findDuplicate.mockResolvedValue({ id: 'item-9' });
    const r = row({
      photoStorageKeys: [KEY(1), KEY(2)],
      barcodeHint: '4047024063303',
      textHint: 'left side',
    });
    await process(r.id);

    expect(reader.getImage).toHaveBeenCalledWith(KEY(1));
    expect(reader.getImage).toHaveBeenCalledWith(KEY(2));
    expect(client.recognize).toHaveBeenCalledWith({
      images: [
        { media_type: 'image/png', data: 'AAAA' },
        { media_type: 'image/png', data: 'AAAA' },
      ],
      hints: { barcode: '4047024063303', text: 'left side' },
    });
    expect(r.status).toBe(InventoryRecognitionStatus.DONE);
    expect(r.result).toMatchObject({
      part_number: '0 986 494 527',
      barcode: '4047024063303',
      oem_numbers: ['0446502220', '0446533450'],
      fitments: [{ make: 'Toyota', model: 'Corolla' }],
      category_key: 'brakes.pads',
      confidence: {
        brand: 1,
        part_number: 0.9,
        barcode: 1,
        name: 0,
        category_key: 0.8,
        fitments: 0.7,
      },
    });
    expect(inventory.findDuplicate).toHaveBeenCalledWith(
      SHOP,
      '0986494527',
      '4047024063303',
    );
    expect(r.possibleDuplicateItemId).toBe('item-9');
    expect(r).toMatchObject({
      model: 'claude-opus-5-5',
      inputTokens: 25000,
      outputTokens: 1800,
      webSearchUses: 3,
      errorCode: null,
    });
    expect(typeof r.durationMs).toBe('number');
    expect(r.finishedAt).toBeInstanceOf(Date);

    // Without a usable hint the model's barcode is normalized; a bad hint is ignored.
    client.recognize.mockResolvedValueOnce(
      call({ parsed: parsed({ barcode: '4 047024 063303' }) }),
    );
    const r2 = row({ barcodeHint: 'abc' });
    await process(r2.id);
    expect(r2.result?.barcode).toBe('4047024063303');
    expect(r2.result?.confidence.barcode).toBe(0);

    // The hint wins even over a different model barcode.
    client.recognize.mockResolvedValueOnce(
      call({ parsed: parsed({ barcode: '1234567890128' }) }),
    );
    const r3 = row({ barcodeHint: '4047024063303' });
    await process(r3.id);
    expect(r3.result?.barcode).toBe('4047024063303');
  });

  it('process maps an unknown category to other.other and flags it', async () => {
    client.recognize.mockResolvedValueOnce(
      call({
        parsed: parsed({
          category_key: 'brakes.unicorns',
          needs_review: ['fitments'],
        }),
      }),
    );
    const r = row();
    await process(r.id);
    expect(r.status).toBe(InventoryRecognitionStatus.DONE);
    expect(r.result?.category_key).toBe('other.other');
    expect(r.result?.needs_review).toEqual(['fitments', 'category_key']);
  });

  it('process marks ai_parse_failed when parsed is null and ai_refused on refusal', async () => {
    client.recognize.mockResolvedValueOnce(call({ parsed: null }));
    const r = row();
    await process(r.id);
    expect(r).toMatchObject({
      status: InventoryRecognitionStatus.FAILED,
      errorCode: 'ai_parse_failed',
      result: null,
      inputTokens: 25000,
    });
    expect(r.finishedAt).toBeInstanceOf(Date);

    client.recognize.mockResolvedValueOnce(
      call({ parsed: parsed(), stopReason: 'refusal' }),
    );
    const r2 = row();
    await process(r2.id);
    expect(r2).toMatchObject({
      status: InventoryRecognitionStatus.FAILED,
      errorCode: 'ai_refused',
      result: null,
    });
    expect(r2.finishedAt).toBeInstanceOf(Date);
  });

  it('process marks ai_error when the client throws, with the message', async () => {
    client.recognize.mockRejectedValueOnce(
      new Error('overloaded '.repeat(100)),
    );
    const r = row();
    await process(r.id);
    expect(r.status).toBe(InventoryRecognitionStatus.FAILED);
    expect(r.errorCode).toBe('ai_error');
    expect(r.errorMessage).toMatch(/^overloaded/);
    expect(r.errorMessage!.length).toBeLessThanOrEqual(500);
    expect(r.finishedAt).toBeInstanceOf(Date);

    // A storage failure takes the same path.
    reader.getImage.mockRejectedValueOnce(new Error('NoSuchKey'));
    const r2 = row();
    await process(r2.id);
    expect(r2).toMatchObject({
      status: InventoryRecognitionStatus.FAILED,
      errorCode: 'ai_error',
      errorMessage: 'NoSuchKey',
    });
  });

  it('process runs at most 3 jobs at once and queues the rest', async () => {
    let running = 0;
    let peak = 0;
    const releases: (() => void)[] = [];
    client.recognize.mockImplementation(() => {
      running++;
      peak = Math.max(peak, running);
      return new Promise<RecognitionCallResult>((resolve) => {
        releases.push(() => {
          running--;
          resolve(call());
        });
      });
    });
    const rows = [row(), row(), row(), row(), row()];
    const jobs = rows.map((r) => process(r.id));
    const flush = () => new Promise((res) => setImmediate(res));
    await flush();
    expect(running).toBe(3);
    expect(rows[3].status).toBe(InventoryRecognitionStatus.PENDING);
    while (releases.length > 0) {
      releases.shift()!();
      await flush();
    }
    await Promise.all(jobs);
    expect(peak).toBe(3);
    expect(
      rows.every((r) => r.status === InventoryRecognitionStatus.DONE),
    ).toBe(true);

    // A throwing job releases its slot too.
    client.recognize.mockReset();
    client.recognize.mockRejectedValue(new Error('boom'));
    const failing = [row(), row(), row(), row()];
    await Promise.all(failing.map((r) => process(r.id)));
    expect(failing.every((r) => r.errorCode === 'ai_error')).toBe(true);
    client.recognize.mockResolvedValue(call());
    const after = row();
    await process(after.id);
    expect(after.status).toBe(InventoryRecognitionStatus.DONE);
  });

  it('sweepStale fails rows older than 5 minutes and leaves fresh ones', async () => {
    const old = new Date(Date.now() - 6 * 60_000);
    const stalePending = row({ createdAt: old });
    const staleProcessing = row({
      createdAt: old,
      status: InventoryRecognitionStatus.PROCESSING,
    });
    const oldDone = row({
      createdAt: old,
      status: InventoryRecognitionStatus.DONE,
    });
    const fresh = row();
    await expect(service.sweepStale()).resolves.toBe(2);
    for (const r of [stalePending, staleProcessing]) {
      expect(r).toMatchObject({
        status: InventoryRecognitionStatus.FAILED,
        errorCode: 'interrupted',
      });
      expect(r.finishedAt).toBeInstanceOf(Date);
    }
    expect(oldDone.status).toBe(InventoryRecognitionStatus.DONE);
    expect(fresh.status).toBe(InventoryRecognitionStatus.PENDING);

    // A sweep failure on boot is logged, never thrown into bootstrap.
    repo.update.mockRejectedValueOnce(new Error('db down'));
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });
});
