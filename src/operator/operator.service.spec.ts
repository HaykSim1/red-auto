jest.mock('../push/push.service', () => ({
  PushService: jest.fn(),
}));

import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Offer } from '../database/entities/offer.entity';
import { PartRequest } from '../database/entities/part-request.entity';
import { User } from '../database/entities/user.entity';
import {
  ModerationState,
  OfferCondition,
  OfferDelivery,
  OfferInteractionState,
  PartRequestStatus,
  UserRole,
} from '../database/enums';
import { OffersService } from '../offers/offers.service';
import { RequestsService } from '../requests/requests.service';
import { SelectionsService } from '../selections/selections.service';
import { OperatorService } from './operator.service';

const qb = (terminal: Record<string, jest.Mock>) => ({
  innerJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  ...terminal,
});

const persona = {
  id: 'persona-1',
  phone: '+37491000777',
  role: UserRole.SELLER,
  isManagedShop: true,
  blockedAt: null,
  shopName: 'Garage One',
  shopAddress: 'Yerevan',
  sellerPhone: '+37491000777',
  shopLogoStorageKey: null,
} as unknown as User;

const dto = {
  shop_id: 'persona-1',
  price_amount: 1000,
  condition: OfferCondition.NEW,
  delivery: OfferDelivery.PICKUP_ONLY,
  description: 'In stock',
};

describe('OperatorService', () => {
  let service: OperatorService;
  let usersRepo: { findOne: jest.Mock; find: jest.Mock };
  let offersRepo: {
    createQueryBuilder: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findAndCount: jest.Mock;
  };
  let requestsRepo: { findOne: jest.Mock };
  let offersService: {
    create: jest.Mock;
    patch: jest.Mock;
    softDelete: jest.Mock;
    serializeOffer: jest.Mock;
    loadAggregates: jest.Mock;
    countVisibleOffersByRequestIds: jest.Mock;
  };
  let requestsService: { listOpen: jest.Mock; serializePublic: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperatorService,
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn(), find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Offer),
          useValue: {
            createQueryBuilder: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PartRequest),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: OffersService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'offer-1' }),
            patch: jest.fn().mockResolvedValue({ id: 'offer-1' }),
            softDelete: jest.fn(),
            serializeOffer: jest.fn((o: Offer) => ({ id: o.id })),
            loadAggregates: jest.fn().mockResolvedValue(new Map()),
            countVisibleOffersByRequestIds: jest
              .fn()
              .mockResolvedValue({ 'req-1': 1 }),
          },
        },
        {
          provide: RequestsService,
          useValue: {
            listOpen: jest.fn(),
            serializePublic: jest.fn((r: PartRequest) => ({ id: r.id })),
          },
        },
        {
          provide: SelectionsService,
          useValue: { sellerMarkDealComplete: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(OperatorService);
    usersRepo = module.get(getRepositoryToken(User));
    offersRepo = module.get(getRepositoryToken(Offer));
    requestsRepo = module.get(getRepositoryToken(PartRequest));
    offersService = module.get(OffersService);
    requestsService = module.get(RequestsService);
  });

  describe('listShops', () => {
    it('returns managed shop personas as shop rows', async () => {
      usersRepo.find.mockResolvedValue([persona]);

      const res = await service.listShops();

      const findArgs = usersRepo.find.mock.calls[0] as [
        { where: { isManagedShop: boolean } },
      ];
      expect(findArgs[0].where.isManagedShop).toBe(true);
      expect(res.items).toEqual([
        expect.objectContaining({
          id: 'persona-1',
          shop_name: 'Garage One',
          seller_phone: '+37491000777',
        }),
      ]);
    });
  });

  describe('createOffer', () => {
    it('throws 404 managed_shop_not_found for an unknown or non-managed shop', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createOffer('op-1', 'req-1', dto),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        code: 'managed_shop_not_found',
      });
      expect(offersService.create).not.toHaveBeenCalled();
    });

    it('throws 422 managed_shop_blocked for a blocked persona', async () => {
      usersRepo.findOne.mockResolvedValue({
        ...persona,
        blockedAt: new Date(),
      });

      await expect(
        service.createOffer('op-1', 'req-1', dto),
      ).rejects.toMatchObject({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'managed_shop_blocked',
      });
    });

    it('creates the offer as the persona and records the operator as creator', async () => {
      usersRepo.findOne.mockResolvedValue(persona);

      await service.createOffer('op-1', 'req-1', dto);

      expect(offersService.create).toHaveBeenCalledWith(
        'req-1',
        'persona-1',
        UserRole.SELLER,
        expect.objectContaining({ price_amount: 1000 }),
        'op-1',
      );
    });
  });

  describe('patchOffer', () => {
    it('refuses an offer whose seller is not a managed shop', async () => {
      offersRepo.findOne.mockResolvedValue({
        id: 'offer-9',
        seller: { id: 'real-seller', isManagedShop: false },
      });

      await expect(
        service.patchOffer('offer-9', { description: 'x' }),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        code: 'not_found',
      });
      expect(offersService.patch).not.toHaveBeenCalled();
    });

    it('delegates to OffersService.patch with the persona id', async () => {
      offersRepo.findOne.mockResolvedValue({
        id: 'offer-1',
        seller: { id: 'persona-1', isManagedShop: true },
      });

      await service.patchOffer('offer-1', { description: 'x' });

      expect(offersService.patch).toHaveBeenCalledWith(
        'persona-1',
        'offer-1',
        UserRole.SELLER,
        { description: 'x' },
      );
    });
  });

  describe('listRequests', () => {
    it('attaches answered_by_shop_ids per request from managed shop offers', async () => {
      requestsService.listOpen.mockResolvedValue({
        items: [{ id: 'req-1' }, { id: 'req-2' }],
        next_cursor: null,
      });
      offersRepo.createQueryBuilder.mockReturnValue(
        qb({
          getRawMany: jest.fn().mockResolvedValue([
            { request_id: 'req-1', seller_id: 'persona-1' },
            { request_id: 'req-1', seller_id: 'persona-2' },
          ]),
        }),
      );

      const res = await service.listRequests('op-1', { limit: 20 });

      expect(requestsService.listOpen).toHaveBeenCalledWith(
        'op-1',
        UserRole.OPERATOR,
        20,
        undefined,
        { brand: undefined, city: undefined },
      );
      expect(res.items[0].answered_by_shop_ids).toEqual([
        'persona-1',
        'persona-2',
      ]);
      expect(res.items[1].answered_by_shop_ids).toEqual([]);
    });

    it('lists each shop once even when it has several offers on the request', async () => {
      requestsService.listOpen.mockResolvedValue({
        items: [{ id: 'req-1' }],
        next_cursor: null,
      });
      offersRepo.createQueryBuilder.mockReturnValue(
        qb({
          getRawMany: jest.fn().mockResolvedValue([
            { request_id: 'req-1', seller_id: 'persona-1' },
            { request_id: 'req-1', seller_id: 'persona-1' },
          ]),
        }),
      );

      const res = await service.listRequests('op-1', { limit: 20 });

      expect(res.items[0].answered_by_shop_ids).toEqual(['persona-1']);
    });
  });

  describe('getRequest', () => {
    const closedRequest = {
      id: 'req-1',
      status: PartRequestStatus.CLOSED,
      moderationState: ModerationState.VISIBLE,
      activeAcceptanceOffer: null,
    } as unknown as PartRequest;

    it('throws 404 when the request is closed and no managed shop has history on it', async () => {
      requestsRepo.findOne.mockResolvedValue(closedRequest);
      offersRepo.createQueryBuilder.mockReturnValue(
        qb({ getCount: jest.fn().mockResolvedValue(0) }),
      );

      await expect(service.getRequest('req-1')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        code: 'not_found',
      });
    });

    it('returns the request with persona offers and deal flags when open', async () => {
      requestsRepo.findOne.mockResolvedValue({
        ...closedRequest,
        status: PartRequestStatus.OPEN,
        activeAcceptanceOffer: { id: 'offer-1' },
      });
      offersRepo.find.mockResolvedValue([
        {
          id: 'offer-1',
          interactionState: OfferInteractionState.CONTACT_REVEALED,
          createdByUserId: 'op-1',
          seller: persona,
          request: { id: 'req-1', description: 'Pads', status: 'open' },
        },
      ]);

      const res = await service.getRequest('req-1');

      expect(res.id).toBe('req-1');
      expect(res.active_acceptance_offer_id).toBe('offer-1');
      expect(res.persona_offers).toEqual([
        expect.objectContaining({
          id: 'offer-1',
          deal_active: true,
          created_by_user_id: 'op-1',
        }),
      ]);
    });
  });
});
