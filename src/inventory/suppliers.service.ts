import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import {
  InventorySupplierDto,
  InventorySupplierListResponseDto,
} from '../common/dto/responses.dto';
import { ApiException } from '../common/exceptions/api.exception';
import { InventoryItem } from '../database/entities/inventory-item.entity';
import { InventorySupplier } from '../database/entities/inventory-supplier.entity';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

const notFound = () =>
  new ApiException(
    'supplier_not_found',
    'Supplier not found.',
    HttpStatus.NOT_FOUND,
  );

const nameTaken = () =>
  new ApiException(
    'supplier_name_taken',
    'A supplier with this name already exists.',
    HttpStatus.CONFLICT,
  );

function blankToNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof QueryFailedError &&
    (e.driverError as { code?: string } | undefined)?.code === '23505'
  );
}

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(InventorySupplier)
    private readonly suppliers: Repository<InventorySupplier>,
    private readonly ds: DataSource,
  ) {}

  async list(shopId: string): Promise<InventorySupplierListResponseDto> {
    const rows = await this.suppliers
      .createQueryBuilder('s')
      .where('s.shop_id = :shopId', { shopId })
      .orderBy('lower(s.name)', 'ASC')
      .getMany();
    return { items: rows.map((r) => this.serialize(r)) };
  }

  async create(
    shopId: string,
    dto: CreateSupplierDto,
  ): Promise<InventorySupplierDto> {
    await this.assertNameFree(shopId, dto.name, null);
    try {
      const saved = await this.suppliers.save(
        this.suppliers.create({
          shop: { id: shopId },
          name: dto.name,
          phone: blankToNull(dto.phone),
          telegram: blankToNull(dto.telegram),
          note: blankToNull(dto.note),
        }),
      );
      return this.serialize(saved);
    } catch (e) {
      if (isUniqueViolation(e)) throw nameTaken();
      throw e;
    }
  }

  async update(
    shopId: string,
    id: string,
    dto: UpdateSupplierDto,
  ): Promise<InventorySupplierDto> {
    const row = await this.load(shopId, id);
    if (dto.name !== undefined && dto.name !== row.name) {
      await this.assertNameFree(shopId, dto.name, id);
      row.name = dto.name;
    }
    if (dto.phone !== undefined) row.phone = blankToNull(dto.phone);
    if (dto.telegram !== undefined) row.telegram = blankToNull(dto.telegram);
    if (dto.note !== undefined) row.note = blankToNull(dto.note);
    try {
      return this.serialize(await this.suppliers.save(row));
    } catch (e) {
      if (isUniqueViolation(e)) throw nameTaken();
      throw e;
    }
  }

  /** Soft delete; the shop's items stop pointing at the supplier. */
  async remove(shopId: string, id: string): Promise<void> {
    await this.load(shopId, id);
    await this.ds.transaction(async (m) => {
      await m
        .createQueryBuilder()
        .update(InventoryItem)
        .set({ supplier: null })
        .where('supplier_id = :id AND shop_id = :shopId', { id, shopId })
        .execute();
      await m.getRepository(InventorySupplier).softDelete({ id });
    });
  }

  serialize(s: InventorySupplier): InventorySupplierDto {
    return {
      id: s.id,
      name: s.name,
      phone: s.phone ?? null,
      telegram: s.telegram ?? null,
      note: s.note ?? null,
      created_at: s.createdAt.toISOString(),
    };
  }

  private async load(shopId: string, id: string): Promise<InventorySupplier> {
    const row = await this.suppliers.findOne({
      where: { id, shop: { id: shopId } },
    });
    if (!row) throw notFound();
    return row;
  }

  private async assertNameFree(
    shopId: string,
    name: string,
    exceptId: string | null,
  ): Promise<void> {
    const qb = this.suppliers
      .createQueryBuilder('s')
      .where('s.shop_id = :shopId', { shopId })
      .andWhere('lower(s.name) = lower(:name)', { name });
    if (exceptId) qb.andWhere('s.id <> :exceptId', { exceptId });
    if ((await qb.getCount()) > 0) throw nameTaken();
  }
}
