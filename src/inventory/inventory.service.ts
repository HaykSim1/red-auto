import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  EntityManager,
  Not,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import {
  InventoryItemListResponseDto,
  InventoryItemDto,
  InventoryStatsDto,
  ShopCatalogItemDto,
  ShopCatalogListResponseDto,
} from '../common/dto/responses.dto';
import { ApiException } from '../common/exceptions/api.exception';
import { decodeCursor, encodeCursor } from '../common/utils/cursor-pagination';
import { InventoryItemPhoto } from '../database/entities/inventory-item-photo.entity';
import {
  InventoryFitment,
  InventoryItem,
} from '../database/entities/inventory-item.entity';
import { InventoryRecognition } from '../database/entities/inventory-recognition.entity';
import { InventoryItemStatus } from '../database/enums';
import { isKnownCategoryKey } from './catalog/part-categories';
import { normalizeMake } from './catalog/car-brands';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { FitmentDto } from './dto/fitment.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import { ShopCatalogQueryDto } from './dto/shop-catalog-query.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import {
  normalizeBarcode,
  normalizeOemNumbers,
  normalizePartNumber,
} from './normalize';
import { assertInventoryKeys } from './storage-keys';

const notFound = () =>
  new ApiException(
    'inventory_item_not_found',
    'Inventory item not found.',
    HttpStatus.NOT_FOUND,
  );

function nullable<T>(v: T | null | undefined): T | null {
  return v === undefined ? null : v;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly items: Repository<InventoryItem>,
    @InjectRepository(InventoryRecognition)
    private readonly recognitions: Repository<InventoryRecognition>,
    private readonly ds: DataSource,
  ) {}

  // ── Reads ──

  async list(
    shopId: string,
    q: ListInventoryItemsQueryDto,
  ): Promise<InventoryItemListResponseDto> {
    const status = q.status ?? 'all';
    const qb = this.baseQuery(shopId, q);
    if (status === 'all') {
      qb.andWhere('i.status IN (:...sts)', {
        sts: [InventoryItemStatus.DRAFT, InventoryItemStatus.ACTIVE],
      });
    } else {
      qb.andWhere('i.status = :st', { st: status });
    }
    if (q.in_stock === true) qb.andWhere('i.quantity > 0');
    if (q.in_stock === false) qb.andWhere('i.quantity = 0');
    const page = await this.paginate(qb, q);
    return {
      items: page.rows.map((r) => this.serialize(r)),
      next_cursor: page.next_cursor,
    };
  }

  async listPublic(
    shopId: string,
    q: ShopCatalogQueryDto,
  ): Promise<ShopCatalogListResponseDto> {
    const qb = this.baseQuery(shopId, q).andWhere('i.status = :st', {
      st: InventoryItemStatus.ACTIVE,
    });
    const page = await this.paginate(qb, q);
    return {
      items: page.rows.map((r) => this.serializePublic(r)),
      next_cursor: page.next_cursor,
    };
  }

  /** active = active items; drafts = drafts; out_of_stock = non-archived with quantity 0. */
  async stats(shopId: string): Promise<InventoryStatsDto> {
    const shop = { id: shopId };
    const [active, drafts, outOfStock] = await Promise.all([
      this.items.count({
        where: { shop, status: InventoryItemStatus.ACTIVE },
      }),
      this.items.count({
        where: { shop, status: InventoryItemStatus.DRAFT },
      }),
      this.items.count({
        where: { shop, status: Not(InventoryItemStatus.ARCHIVED), quantity: 0 },
      }),
    ]);
    return { active, drafts, out_of_stock: outOfStock };
  }

  countActive(shopId: string): Promise<number> {
    return this.items.count({
      where: { shop: { id: shopId }, status: InventoryItemStatus.ACTIVE },
    });
  }

  async get(shopId: string, id: string): Promise<InventoryItemDto> {
    return this.serialize(await this.load(this.items, shopId, id));
  }

  async getPublic(shopId: string, itemId: string): Promise<ShopCatalogItemDto> {
    const item = await this.items.findOne({
      where: {
        id: itemId,
        shop: { id: shopId },
        status: InventoryItemStatus.ACTIVE,
      },
      relations: { photos: true },
    });
    if (!item) throw notFound();
    return this.serializePublic(item);
  }

  findDuplicate(
    shopId: string,
    partNumberNormalized: string | null,
    barcode: string | null,
  ): Promise<InventoryItem | null> {
    const base = {
      shop: { id: shopId },
      status: Not(InventoryItemStatus.ARCHIVED),
    };
    const where = [
      ...(partNumberNormalized ? [{ ...base, partNumberNormalized }] : []),
      ...(barcode ? [{ ...base, barcode }] : []),
    ];
    if (where.length === 0) return Promise.resolve(null);
    return this.items.findOne({
      where,
      order: { createdAt: 'DESC' },
      relations: { photos: true },
    });
  }

  // ── Writes ──

  async create(
    shopId: string,
    dto: CreateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    this.assertCategory(dto.category_key);
    const keys = dto.photo_storage_keys ?? [];
    assertInventoryKeys(shopId, keys);

    let recognition: InventoryRecognition | null = null;
    if (dto.recognition_id) {
      recognition = await this.recognitions.findOne({
        where: { id: dto.recognition_id, shop: { id: shopId } },
      });
      if (!recognition) {
        throw new ApiException(
          'recognition_not_found',
          'Recognition not found.',
          HttpStatus.NOT_FOUND,
        );
      }
    }

    const id = await this.ds.transaction(async (m) => {
      const items = m.getRepository(InventoryItem);
      const item = items.create({
        shop: { id: shopId },
        status:
          dto.status === 'draft'
            ? InventoryItemStatus.DRAFT
            : InventoryItemStatus.ACTIVE,
        recognition,
        needsReview: [],
        aiConfidence: null,
        ...this.fields(dto),
      } as Partial<InventoryItem>);
      const saved = await items.save(item);
      await this.insertPhotos(m, saved, keys);
      return saved.id;
    });
    return this.get(shopId, id);
  }

  async update(
    shopId: string,
    id: string,
    dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    if (dto.category_key !== undefined) this.assertCategory(dto.category_key);
    if (dto.photo_storage_keys !== undefined) {
      assertInventoryKeys(shopId, dto.photo_storage_keys);
    }
    await this.ds.transaction(async (m) => {
      const items = m.getRepository(InventoryItem);
      const item = await this.load(items, shopId, id);
      Object.assign(item, this.fields(dto));
      if (dto.status) {
        item.status =
          dto.status === 'draft'
            ? InventoryItemStatus.DRAFT
            : InventoryItemStatus.ACTIVE;
      }
      const { photos: _photos, ...rest } = item;
      void _photos;
      await items.save(rest as InventoryItem);
      if (dto.photo_storage_keys !== undefined) {
        await m.getRepository(InventoryItemPhoto).delete({ item: { id } });
        await this.insertPhotos(m, item, dto.photo_storage_keys);
      }
    });
    return this.get(shopId, id);
  }

  async archive(shopId: string, id: string): Promise<void> {
    const item = await this.load(this.items, shopId, id);
    const { photos: _photos, ...rest } = item;
    void _photos;
    await this.items.save({
      ...rest,
      status: InventoryItemStatus.ARCHIVED,
    } as InventoryItem);
  }

  // ── Serialization ──

  serialize(item: InventoryItem): InventoryItemDto {
    return {
      id: item.id,
      status: item.status,
      brand: item.brand,
      part_number: item.partNumber,
      part_number_normalized: item.partNumberNormalized,
      barcode: item.barcode,
      oem_numbers: item.oemNumbers,
      name: item.name,
      name_hy: item.nameHy,
      name_en: item.nameEn,
      category_key: item.categoryKey,
      fitments: item.fitments,
      fitment_note: item.fitmentNote,
      condition: item.condition,
      price_amount: this.price(item),
      price_currency: item.priceCurrency,
      quantity: item.quantity,
      shelf_location: item.shelfLocation,
      note: item.note,
      ai_confidence: item.aiConfidence,
      needs_review: item.needsReview,
      recognition_id: item.recognition?.id ?? null,
      photos: this.photos(item),
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
    };
  }

  serializePublic(item: InventoryItem): ShopCatalogItemDto {
    return {
      id: item.id,
      name: item.name,
      name_hy: item.nameHy,
      name_en: item.nameEn,
      brand: item.brand,
      part_number: item.partNumber,
      barcode: item.barcode,
      oem_numbers: item.oemNumbers,
      category_key: item.categoryKey,
      fitments: item.fitments,
      fitment_note: item.fitmentNote,
      condition: item.condition,
      price_amount: this.price(item),
      price_currency: item.priceCurrency,
      in_stock: item.quantity > 0,
      photos: this.photos(item),
      created_at: item.createdAt.toISOString(),
    };
  }

  // ── Helpers ──

  private price(item: InventoryItem): number | null {
    return item.priceAmount === null || item.priceAmount === undefined
      ? null
      : Number(item.priceAmount);
  }

  private photos(item: InventoryItem) {
    return [...(item.photos ?? [])]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => ({ storage_key: p.storageKey, sort_order: p.sortOrder }));
  }

  private assertCategory(key: string | null | undefined): void {
    if (key && !isKnownCategoryKey(key)) {
      throw new ApiException(
        'category_unknown',
        'Unknown category key.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async load(
    repo: Repository<InventoryItem>,
    shopId: string,
    id: string,
  ): Promise<InventoryItem> {
    const item = await repo.findOne({
      where: {
        id,
        shop: { id: shopId },
        status: Not(InventoryItemStatus.ARCHIVED),
      },
      relations: { photos: true, recognition: true },
    });
    if (!item) throw notFound();
    return item;
  }

  private async insertPhotos(
    m: EntityManager,
    item: InventoryItem,
    keys: string[],
  ): Promise<void> {
    if (keys.length === 0) return;
    const repo = m.getRepository(InventoryItemPhoto);
    await repo.save(
      keys.map((storageKey, sortOrder) =>
        repo.create({ item: { id: item.id }, storageKey, sortOrder }),
      ),
    );
  }

  /** Maps the DTO fields that are present to entity columns, normalizing. */
  private fields(dto: Partial<CreateInventoryItemDto>): Partial<InventoryItem> {
    const out: Partial<InventoryItem> = {};
    if (dto.brand !== undefined) out.brand = dto.brand;
    if (dto.part_number !== undefined) {
      out.partNumber = dto.part_number;
      out.partNumberNormalized = normalizePartNumber(dto.part_number);
    }
    if (dto.barcode !== undefined) {
      out.barcode = normalizeBarcode(dto.barcode);
    }
    if (dto.oem_numbers !== undefined) {
      out.oemNumbers = normalizeOemNumbers(dto.oem_numbers);
    }
    if (dto.name !== undefined) out.name = dto.name;
    if (dto.name_hy !== undefined) out.nameHy = dto.name_hy;
    if (dto.name_en !== undefined) out.nameEn = dto.name_en;
    if (dto.category_key !== undefined) out.categoryKey = dto.category_key;
    if (dto.fitments !== undefined) {
      out.fitments = dto.fitments.map((f) => this.fitment(f));
    }
    if (dto.fitment_note !== undefined) out.fitmentNote = dto.fitment_note;
    if (dto.condition !== undefined) out.condition = dto.condition;
    if (dto.price_amount !== undefined) {
      out.priceAmount =
        dto.price_amount === null ? null : String(dto.price_amount);
    }
    if (dto.quantity !== undefined) out.quantity = dto.quantity;
    if (dto.shelf_location !== undefined) {
      out.shelfLocation = dto.shelf_location;
    }
    if (dto.note !== undefined) out.note = dto.note;
    return out;
  }

  private fitment(f: FitmentDto): InventoryFitment {
    return {
      make: normalizeMake(f.make),
      model: nullable(f.model),
      year_from: nullable(f.year_from),
      year_to: nullable(f.year_to),
      engine: nullable(f.engine),
    };
  }

  private baseQuery(
    shopId: string,
    q: ShopCatalogQueryDto,
  ): SelectQueryBuilder<InventoryItem> {
    const qb = this.items
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.photos', 'photos')
      .where('i.shop_id = :shopId', { shopId });

    const term = q.q?.trim();
    if (term) {
      const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
      const normalized = normalizePartNumber(term);
      qb.andWhere(
        new Brackets((b) => {
          b.where('i.name ILIKE :like', { like })
            .orWhere('i.brand ILIKE :like', { like })
            .orWhere('i.barcode = :term', { term });
          if (normalized) {
            b.orWhere('i.part_number_normalized ILIKE :pn', {
              pn: `%${normalized}%`,
            });
          }
        }),
      );
    }

    const category = q.category?.trim();
    if (category) {
      if (category.includes('.')) {
        qb.andWhere('i.category_key = :cat', { cat: category });
      } else {
        qb.andWhere('i.category_key LIKE :catp', {
          catp: `${category.replace(/[\\%_]/g, '\\$&')}.%`,
        });
      }
    }
    return qb;
  }

  private async paginate(
    qb: SelectQueryBuilder<InventoryItem>,
    q: ShopCatalogQueryDto,
  ): Promise<{ rows: InventoryItem[]; next_cursor: string | null }> {
    const take = Math.min(Math.max(q.limit ?? 20, 1), 100);
    qb.orderBy('i.createdAt', 'DESC')
      .addOrderBy('i.id', 'DESC')
      .take(take + 1);
    if (q.cursor) {
      const p = decodeCursor(q.cursor);
      if (p) {
        qb.andWhere(
          '(i.created_at < :ct OR (i.created_at = :ct AND i.id < :cid))',
          { ct: new Date(p.t), cid: p.id },
        );
      }
    }
    const found = await qb.getMany();
    const hasMore = found.length > take;
    const rows = hasMore ? found.slice(0, take) : found;
    const last = rows[rows.length - 1];
    return {
      rows,
      next_cursor:
        hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }
}
