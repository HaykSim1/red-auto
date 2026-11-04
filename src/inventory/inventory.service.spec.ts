import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InventoryItemPhoto } from '../database/entities/inventory-item-photo.entity';
import { InventoryItem } from '../database/entities/inventory-item.entity';
import { InventoryRecognition } from '../database/entities/inventory-recognition.entity';
import { InventoryItemStatus, OfferCondition } from '../database/enums';
import { InventoryService } from './inventory.service';

const SHOP = 'shop-1';

function makeItem(over: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'item-1',
    status: InventoryItemStatus.ACTIVE,
    brand: 'Bosch',
    partNumber: '0 986 AB1',
    partNumberNormalized: '0986AB1',
    barcode: null,
    oemNumbers: [],
    name: 'Brake pads',
    nameHy: null,
    nameEn: null,
    categoryKey: null,
    fitments: [],
    fitmentNote: null,
    condition: OfferCondition.NEW,
    priceAmount: '1500.00',
    priceCurrency: 'AMD',
    quantity: 3,
    shelfLocation: 'A-12',
    note: 'secret',
    aiConfidence: { name: 0.9 },
    needsReview: ['name'],
    recognition: { id: 'rec-1' },
    photos: [],
    createdAt: new Date('2026-11-01T10:00:00Z'),
    updatedAt: new Date('2026-11-02T10:00:00Z'),
    deletedAt: null,
    ...over,
  } as unknown as InventoryItem;
}

describe('InventoryService', () => {
  let service: InventoryService;
  let store: InventoryItem[];
  let saved: Partial<InventoryItem>[];
  let photoSaves: unknown[][];
  let itemsRepo: Record<string, jest.Mock>;
  let recognitionsRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    store = [];
    saved = [];
    photoSaves = [];
    itemsRepo = {
      create: jest.fn((v: Partial<InventoryItem>) => v),
      save: jest.fn((v: Partial<InventoryItem>) => {
        saved.push(v);
        const withId = { id: 'item-1', ...v } as InventoryItem;
        const idx = store.findIndex((s) => s.id === withId.id);
        if (idx >= 0) store[idx] = { ...store[idx], ...withId };
        else store.push(makeItem(withId));
        return Promise.resolve(withId);
      }),
      // The service always filters out archived items in findOne.
      findOne: jest.fn(() =>
        Promise.resolve(
          store.find((s) => s.status !== InventoryItemStatus.ARCHIVED) ?? null,
        ),
      ),
    };
    recognitionsRepo = { findOne: jest.fn() };
    const photoRepo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn((v: unknown[]) => {
        photoSaves.push(v);
        return Promise.resolve(v);
      }),
      delete: jest.fn(),
    };
    const manager = {
      getRepository: (e: unknown) =>
        e === InventoryItem ? itemsRepo : photoRepo,
    };
    const module = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(InventoryItem), useValue: itemsRepo },
        {
          provide: getRepositoryToken(InventoryRecognition),
          useValue: recognitionsRepo,
        },
        {
          provide: DataSource,
          useValue: {
            transaction: (cb: (m: unknown) => Promise<unknown>) => cb(manager),
          },
        },
      ],
    }).compile();
    service = module.get(InventoryService);
    void InventoryItemPhoto;
  });

  it('create normalizes numbers and makes', async () => {
    await service.create(SHOP, {
      name: 'Brake pads',
      part_number: '1k0-698 151',
      fitments: [{ make: 'toyota' }],
    });
    expect(saved[0].partNumber).toBe('1k0-698 151');
    expect(saved[0].partNumberNormalized).toBe('1K0698151');
    expect(saved[0].fitments?.[0].make).toBe('Toyota');
  });

  it('create rejects unknown category with category_unknown', async () => {
    await expect(
      service.create(SHOP, { name: 'x', category_key: 'nope.nope' }),
    ).rejects.toMatchObject({ code: 'category_unknown' });
  });

  it('create rejects foreign storage keys', async () => {
    await expect(
      service.create(SHOP, {
        name: 'x',
        photo_storage_keys: ['inventory/other-shop/a.jpg'],
      }),
    ).rejects.toMatchObject({ code: 'inventory_photo_key_forbidden' });
  });

  it('findDuplicate matches by normalized part number or barcode, ignores archived', async () => {
    await service.findDuplicate(SHOP, '0986AB1', '12345678');
    const calls = itemsRepo.findOne.mock.calls as unknown[][];
    const arg = calls[0][0] as {
      where: Record<string, unknown>[];
      order: unknown;
    };
    expect(arg.where).toHaveLength(2);
    expect(arg.where[0]).toMatchObject({ partNumberNormalized: '0986AB1' });
    expect(arg.where[1]).toMatchObject({ barcode: '12345678' });
    for (const w of arg.where) {
      expect(w.shop).toEqual({ id: SHOP });
      // Not(ARCHIVED) FindOperator
      expect(w.status).toMatchObject({ _type: 'not' });
    }
    expect(arg.order).toEqual({ createdAt: 'DESC' });
    itemsRepo.findOne.mockClear();
    await expect(service.findDuplicate(SHOP, null, null)).resolves.toBeNull();
    expect(itemsRepo.findOne).not.toHaveBeenCalled();
  });

  it('serializePublic omits shelf_location, note, ai_confidence, needs_review, recognition_id and sets in_stock', () => {
    const pub = service.serializePublic(makeItem({ quantity: 0 }));
    for (const k of [
      'shelf_location',
      'note',
      'ai_confidence',
      'needs_review',
      'recognition_id',
      'status',
      'quantity',
    ]) {
      expect(pub).not.toHaveProperty(k);
    }
    expect(pub.in_stock).toBe(false);
    expect(pub.price_amount).toBe(1500);
    expect(service.serializePublic(makeItem()).in_stock).toBe(true);
  });

  it('archive sets status archived and get() then throws inventory_item_not_found', async () => {
    store.push(makeItem());
    await service.archive(SHOP, 'item-1');
    expect(saved[0].status).toBe(InventoryItemStatus.ARCHIVED);
    await expect(service.get(SHOP, 'item-1')).rejects.toMatchObject({
      code: 'inventory_item_not_found',
    });
  });

  describe('AI flags from a recognition', () => {
    const recognition = {
      id: 'rec-1',
      result: {
        confidence: { brand: 0.9, part_number: 0.4 },
        needs_review: ['part_number', 'fitments'],
      },
    };

    it('create as draft from a recognition keeps confidence and needs_review', async () => {
      recognitionsRepo.findOne.mockResolvedValue(recognition);
      await service.create(SHOP, {
        name: 'Brake pads',
        status: 'draft',
        recognition_id: '00000000-0000-4000-8000-000000000001',
      });
      expect(saved[0].status).toBe(InventoryItemStatus.DRAFT);
      expect(saved[0].aiConfidence).toEqual({ brand: 0.9, part_number: 0.4 });
      expect(saved[0].needsReview).toEqual(['part_number', 'fitments']);
    });

    it('create as active from a recognition clears needs_review', async () => {
      recognitionsRepo.findOne.mockResolvedValue(recognition);
      await service.create(SHOP, {
        name: 'Brake pads',
        recognition_id: '00000000-0000-4000-8000-000000000001',
      });
      expect(saved[0].status).toBe(InventoryItemStatus.ACTIVE);
      expect(saved[0].aiConfidence).toEqual({ brand: 0.9, part_number: 0.4 });
      expect(saved[0].needsReview).toEqual([]);
    });

    it('create from a recognition without a result stores no flags', async () => {
      recognitionsRepo.findOne.mockResolvedValue({ id: 'rec-2', result: null });
      await service.create(SHOP, {
        name: 'x',
        status: 'draft',
        recognition_id: '00000000-0000-4000-8000-000000000002',
      });
      expect(saved[0].aiConfidence).toBeNull();
      expect(saved[0].needsReview).toEqual([]);
    });

    it('update to active clears needs_review; a draft edit keeps it', async () => {
      store.push(
        makeItem({ status: InventoryItemStatus.DRAFT, needsReview: ['name'] }),
      );
      await service.update(SHOP, 'item-1', { note: 'n' });
      expect(saved[0].needsReview).toEqual(['name']);
      const dto = await service.update(SHOP, 'item-1', { status: 'active' });
      expect(saved[1].status).toBe(InventoryItemStatus.ACTIVE);
      expect(saved[1].needsReview).toEqual([]);
      expect(dto.needs_review).toEqual([]);
      expect(dto.ai_confidence).toEqual({ name: 0.9 });
    });
  });

  it('create keeps a shop-typed barcode without a check digit (digits only, 8–14)', async () => {
    await service.create(SHOP, { name: 'x', barcode: '12-345-678-90' });
    expect(saved[0].barcode).toBe('1234567890');
  });
});
