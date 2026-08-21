// admin.service.ts statically imports PushService, which in turn imports the
// ESM-only `expo-server-sdk` package that ts-jest cannot transform out of the
// box. Mock the module (before importing admin.service) so Jest never has to
// load the real push.service.ts file for this unit test of a pure function.
jest.mock('../push/push.service', () => ({
  PushService: jest.fn(),
}));

import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import { AppVersionConfig } from '../database/entities/app-version-config.entity';
import { Offer } from '../database/entities/offer.entity';
import { PartRequest } from '../database/entities/part-request.entity';
import { SellerApplication } from '../database/entities/seller-application.entity';
import { User } from '../database/entities/user.entity';
import { PartRequestStatus, ModerationState } from '../database/enums';
import { PushService } from '../push/push.service';
import { AdminService, vehicleLabel } from './admin.service';

describe('AdminService.listRequests', () => {
  it('derives vehicle_label from label when present', () => {
    expect(
      vehicleLabel({
        label: 'My E46',
        brand: 'BMW',
        model: '330i',
        year: 2003,
        engine: 'M54B30',
      }),
    ).toBe('My E46');
  });

  it('composes vehicle_label from parts when label is null', () => {
    expect(
      vehicleLabel({
        label: null,
        brand: 'BMW',
        model: '330i',
        year: 2003,
        engine: 'M54B30',
      }),
    ).toBe('2003 BMW 330i M54B30');
  });

  it('skips null parts when composing', () => {
    expect(
      vehicleLabel({
        label: null,
        brand: 'BMW',
        model: null,
        year: null,
        engine: null,
      }),
    ).toBe('BMW');
  });

  it('returns null when the vehicle is null', () => {
    expect(vehicleLabel(null)).toBeNull();
  });

  it('returns null when every vehicle field is null', () => {
    expect(
      vehicleLabel({
        label: null,
        brand: null,
        model: null,
        year: null,
        engine: null,
      }),
    ).toBeNull();
  });
});

const mockRequestRow = (overrides: Partial<PartRequest> = {}): PartRequest =>
  ({
    id: 'request-uuid-1',
    author: { id: 'author-uuid-1', displayName: 'Author One' },
    vehicle: null,
    description: 'Need a part',
    vinText: null,
    partNumber: null,
    quantity: 1,
    city: null,
    status: PartRequestStatus.OPEN,
    region: 'AM',
    moderationState: ModerationState.VISIBLE,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    photos: [],
    activeAcceptanceOffer: null,
    ...overrides,
  }) as PartRequest;

describe('AdminService.listRequests (wiring)', () => {
  let service: AdminService;
  // Typed as plain mock-shaped objects (not `jest.Mocked<Repository<...>>`)
  // so `expect(offersRepo.createQueryBuilder).not.toHaveBeenCalled()` isn't
  // flagged by `@typescript-eslint/unbound-method` — that rule fires on
  // references to methods declared on a class/interface, which the
  // `Repository` type would otherwise carry.
  let requestsRepo: { findAndCount: jest.Mock };
  let offersRepo: { createQueryBuilder: jest.Mock };

  // Chainable query-builder mock matching the `select/addSelect/where/
  // groupBy/getRawMany` chain used by `offerCountsByRequest`.
  const mockQueryBuilder = (
    rawRows: { request_id: string; count: string }[],
  ) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rawRows),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
        {
          provide: getRepositoryToken(PartRequest),
          useValue: {
            findAndCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Offer),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SellerApplication),
          useValue: {},
        },
        {
          provide: getRepositoryToken(AppVersionConfig),
          useValue: {},
        },
        {
          provide: PushService,
          useValue: { sendTestToUser: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AdminService);
    requestsRepo = module.get(getRepositoryToken(PartRequest));
    offersRepo = module.get(getRepositoryToken(Offer));
  });

  it('picks the storage_key of the photo with the lowest sort_order, given photos out of order', async () => {
    const row = mockRequestRow({
      photos: [
        { id: 'p-high', storageKey: 'high', sortOrder: 5 } as never,
        { id: 'p-low', storageKey: 'low', sortOrder: 1 } as never,
        { id: 'p-mid', storageKey: 'mid', sortOrder: 3 } as never,
      ],
    });
    requestsRepo.findAndCount.mockResolvedValue([[row], 1]);
    offersRepo.createQueryBuilder.mockReturnValue(
      mockQueryBuilder([]) as never,
    );

    const result = await service.listRequests(20, 0);

    expect(result.items[0].first_photo_key).toBe('low');
  });

  it('returns null first_photo_key when the request has no photos', async () => {
    const row = mockRequestRow({ photos: [] });
    requestsRepo.findAndCount.mockResolvedValue([[row], 1]);
    offersRepo.createQueryBuilder.mockReturnValue(
      mockQueryBuilder([]) as never,
    );

    const result = await service.listRequests(20, 0);

    expect(result.items[0].first_photo_key).toBeNull();
  });

  it('does not reorder the entity photos array while picking first_photo_key', async () => {
    // Deliberately neither ascending nor descending by sortOrder, so a
    // sort in either direction would visibly change this order — the test
    // can't pass by accident regardless of comparator direction.
    const row = mockRequestRow({
      photos: [
        { id: 'p-mid', storageKey: 'mid', sortOrder: 2 } as never,
        { id: 'p-low', storageKey: 'low', sortOrder: 1 } as never,
        { id: 'p-high', storageKey: 'high', sortOrder: 3 } as never,
      ],
    });
    requestsRepo.findAndCount.mockResolvedValue([[row], 1]);
    offersRepo.createQueryBuilder.mockReturnValue(
      mockQueryBuilder([]) as never,
    );

    await service.listRequests(20, 0);

    expect(row.photos.map((p) => p.storageKey)).toEqual(['mid', 'low', 'high']);
  });

  it('defaults offers_count to 0 for a request absent from the counts result, and to the real count for one present', async () => {
    const rowWithOffers = mockRequestRow({ id: 'request-with-offers' });
    const rowWithoutOffers = mockRequestRow({ id: 'request-without-offers' });
    requestsRepo.findAndCount.mockResolvedValue([
      [rowWithOffers, rowWithoutOffers],
      2,
    ]);
    offersRepo.createQueryBuilder.mockReturnValue(
      mockQueryBuilder([
        { request_id: 'request-with-offers', count: '3' },
      ]) as never,
    );

    const result = await service.listRequests(20, 0);

    expect(
      result.items.find((i) => i.id === 'request-with-offers')?.offers_count,
    ).toBe(3);
    expect(
      result.items.find((i) => i.id === 'request-without-offers')?.offers_count,
    ).toBe(0);
  });

  it('sets vehicle_label to null end-to-end when vehicle is null', async () => {
    const row = mockRequestRow({ vehicle: null });
    requestsRepo.findAndCount.mockResolvedValue([[row], 1]);
    offersRepo.createQueryBuilder.mockReturnValue(
      mockQueryBuilder([]) as never,
    );

    const result = await service.listRequests(20, 0);

    expect(result.items[0].vehicle_label).toBeNull();
  });

  it('does not invoke the offers query builder at all for an empty page', async () => {
    requestsRepo.findAndCount.mockResolvedValue([[], 0]);

    const result = await service.listRequests(20, 0);

    expect(offersRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 0, items: [] });
  });
});

describe('AdminService.getRequestDetail', () => {
  let service: AdminService;
  // Typed as a plain mock-shaped object (not `jest.Mocked<Repository<...>>`)
  // for the same `@typescript-eslint/unbound-method` reason noted above.
  let requestsRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
        {
          provide: getRepositoryToken(PartRequest),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Offer),
          useValue: {},
        },
        {
          provide: getRepositoryToken(SellerApplication),
          useValue: {},
        },
        {
          provide: getRepositoryToken(AppVersionConfig),
          useValue: {},
        },
        {
          provide: PushService,
          useValue: { sendTestToUser: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AdminService);
    requestsRepo = module.get(getRepositoryToken(PartRequest));
  });

  it('throws a 404 ApiException when the request does not exist', async () => {
    requestsRepo.findOne.mockResolvedValue(null);

    await expect(service.getRequestDetail('missing-id')).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      code: 'not_found',
    });
    await expect(service.getRequestDetail('missing-id')).rejects.toBeInstanceOf(
      ApiException,
    );
  });

  it('returns null vehicle and an empty photos array when both are absent', async () => {
    requestsRepo.findOne.mockResolvedValue({
      id: 'r1',
      description: 'd',
      vinText: null,
      partNumber: null,
      quantity: 1,
      city: null,
      region: 'AM',
      status: 'open',
      moderationState: 'visible',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      author: { id: 'u1', phone: '+37411', displayName: null },
      vehicle: null,
      photos: [],
      activeAcceptanceOffer: null,
    });

    const out = await service.getRequestDetail('r1');

    expect(out.vehicle).toBeNull();
    expect(out.photos).toEqual([]);
    expect(out.active_acceptance_offer_id).toBeNull();
  });

  it('carries the active acceptance offer id when one is set', async () => {
    requestsRepo.findOne.mockResolvedValue({
      id: 'r1',
      description: 'd',
      vinText: null,
      partNumber: null,
      quantity: 1,
      city: null,
      region: 'AM',
      status: 'open',
      moderationState: 'visible',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      author: { id: 'u1', phone: '+37411', displayName: null },
      vehicle: null,
      photos: [],
      activeAcceptanceOffer: { id: 'o-42' },
    });

    const out = await service.getRequestDetail('r1');

    expect(out.active_acceptance_offer_id).toBe('o-42');
  });

  it('orders photos by sort_order', async () => {
    requestsRepo.findOne.mockResolvedValue({
      id: 'r1',
      description: 'd',
      vinText: null,
      partNumber: null,
      quantity: 1,
      city: null,
      region: 'AM',
      status: 'open',
      moderationState: 'visible',
      createdAt: new Date(),
      updatedAt: new Date(),
      author: { id: 'u1', phone: '+37411', displayName: null },
      vehicle: null,
      activeAcceptanceOffer: null,
      // Deliberately neither ascending nor descending, so a `.reverse()`, a
      // no-op, or a descending comparator would each produce an order
      // distinguishable from the correct ascending one — unlike a simple
      // two-element reversed pair, which a `.reverse()` would also satisfy.
      photos: [
        { storageKey: 'mid.jpg', sortOrder: 2 },
        { storageKey: 'low.jpg', sortOrder: 1 },
        { storageKey: 'high.jpg', sortOrder: 3 },
      ],
    });

    const out = await service.getRequestDetail('r1');

    expect(out.photos.map((p) => p.storage_key)).toEqual([
      'low.jpg',
      'mid.jpg',
      'high.jpg',
    ]);
  });
});

// Pins `listOffers`' title/label output BEFORE the `offerTitle` extraction
// (Task 3) so the refactor is provably a no-op for this endpoint's response
// shape. `listOffers` serves `GET /admin/offers`, consumed by the mobile
// app, and this feature must not change its output.
describe('AdminService.listOffers', () => {
  let service: AdminService;
  let offersRepo: { findAndCount: jest.Mock };

  const mockOfferRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'offer-1',
    request: { id: 'request-1', description: 'Need a part' },
    seller: { id: 'seller-1', phone: '+37411000000', displayName: 'Shop One' },
    moderationState: 'visible',
    priceAmount: '15000',
    variantLabel: 'OEM',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(PartRequest), useValue: {} },
        {
          provide: getRepositoryToken(Offer),
          useValue: { findAndCount: jest.fn() },
        },
        { provide: getRepositoryToken(SellerApplication), useValue: {} },
        { provide: getRepositoryToken(AppVersionConfig), useValue: {} },
        { provide: PushService, useValue: { sendTestToUser: jest.fn() } },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
      ],
    }).compile();

    service = module.get(AdminService);
    offersRepo = module.get(getRepositoryToken(Offer));
  });

  it('builds the title as "displayName · variantLabel · price AMD" when both are present', async () => {
    const row = mockOfferRow();
    offersRepo.findAndCount.mockResolvedValue([[row], 1]);

    const result = await service.listOffers(50, 0);

    expect(result.items[0].title).toBe('Shop One · OEM · 15000 AMD');
    expect(result.items[0].seller_label).toBe('Shop One');
  });

  it('falls back to phone when displayName is empty/whitespace after trim', async () => {
    const row = mockOfferRow({
      seller: { id: 'seller-1', phone: '+37411000000', displayName: '   ' },
    });
    offersRepo.findAndCount.mockResolvedValue([[row], 1]);

    const result = await service.listOffers(50, 0);

    expect(result.items[0].title).toBe('+37411000000 · OEM · 15000 AMD');
    expect(result.items[0].seller_label).toBe('+37411000000');
  });

  it('omits the variant label segment when variantLabel is null', async () => {
    const row = mockOfferRow({ variantLabel: null });
    offersRepo.findAndCount.mockResolvedValue([[row], 1]);

    const result = await service.listOffers(50, 0);

    expect(result.items[0].title).toBe('Shop One · 15000 AMD');
  });

  it('does not include a photos field in its output', async () => {
    const row = mockOfferRow();
    offersRepo.findAndCount.mockResolvedValue([[row], 1]);

    const result = await service.listOffers(50, 0);

    expect(result.items[0]).not.toHaveProperty('photos');
  });
});

describe('AdminService.listRequestOffers', () => {
  let service: AdminService;
  let requestsRepo: { findOne: jest.Mock };
  let offersRepo: { findAndCount: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useValue: {} },
        {
          provide: getRepositoryToken(PartRequest),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Offer),
          useValue: { findAndCount: jest.fn() },
        },
        { provide: getRepositoryToken(SellerApplication), useValue: {} },
        { provide: getRepositoryToken(AppVersionConfig), useValue: {} },
        { provide: PushService, useValue: { sendTestToUser: jest.fn() } },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
      ],
    }).compile();

    service = module.get(AdminService);
    requestsRepo = module.get(getRepositoryToken(PartRequest));
    offersRepo = module.get(getRepositoryToken(Offer));
  });

  it('throws a 404 when the parent request does not exist', async () => {
    requestsRepo.findOne.mockResolvedValue(null);

    await expect(
      service.listRequestOffers('missing', 50, 0),
    ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    await expect(
      service.listRequestOffers('missing', 50, 0),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('returns an empty page when the request has no offers', async () => {
    requestsRepo.findOne.mockResolvedValue({ id: 'r1' });
    offersRepo.findAndCount.mockResolvedValue([[], 0]);

    await expect(service.listRequestOffers('r1', 50, 0)).resolves.toEqual({
      total: 0,
      items: [],
    });
  });

  it('includes photos ordered by sort_order, given photos in non-monotonic order', async () => {
    requestsRepo.findOne.mockResolvedValue({ id: 'r1' });
    offersRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 'o1',
          request: { id: 'r1', description: 'desc' },
          seller: { id: 's1', phone: '+37411', displayName: 'Shop' },
          moderationState: 'visible',
          priceAmount: '1000',
          variantLabel: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          // Deliberately non-monotonic (2, 1, 3) with distinguishable keys,
          // so neither a naive `.reverse()` nor a no-op nor a descending
          // sort could accidentally pass this assertion the way a simple
          // two-element reversed pair could.
          photos: [
            { storageKey: 'mid.jpg', sortOrder: 2 },
            { storageKey: 'low.jpg', sortOrder: 1 },
            { storageKey: 'high.jpg', sortOrder: 3 },
          ],
        },
      ],
      1,
    ]);

    const out = await service.listRequestOffers('r1', 50, 0);

    expect(out.items[0].photos.map((p) => p.storage_key)).toEqual([
      'low.jpg',
      'mid.jpg',
      'high.jpg',
    ]);
    // The mocked `findAndCount` ignores its argument entirely, so without
    // this assertion a missing/wrong `where` (or dropped pagination/
    // ordering) would still return the mocked rows and every other
    // assertion here would keep passing. Assert the call itself.
    expect(offersRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { request: { id: 'r1' } },
        take: 50,
        skip: 0,
        order: { createdAt: 'DESC' },
      }),
    );
  });

  it('does not mutate the entity photos array while sorting', async () => {
    const entityPhotos = [
      { storageKey: 'mid.jpg', sortOrder: 2 },
      { storageKey: 'low.jpg', sortOrder: 1 },
      { storageKey: 'high.jpg', sortOrder: 3 },
    ];
    requestsRepo.findOne.mockResolvedValue({ id: 'r1' });
    offersRepo.findAndCount.mockResolvedValue([
      [
        {
          id: 'o1',
          request: { id: 'r1', description: 'desc' },
          seller: { id: 's1', phone: '+37411', displayName: 'Shop' },
          moderationState: 'visible',
          priceAmount: '1000',
          variantLabel: null,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          photos: entityPhotos,
        },
      ],
      1,
    ]);

    await service.listRequestOffers('r1', 50, 0);

    expect(entityPhotos.map((p) => p.storageKey)).toEqual([
      'mid.jpg',
      'low.jpg',
      'high.jpg',
    ]);
  });
});
