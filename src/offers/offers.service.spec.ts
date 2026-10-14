jest.mock('../push/push.service', () => ({
  PushService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OfferPhoto } from '../database/entities/offer-photo.entity';
import { Offer } from '../database/entities/offer.entity';
import { PartRequest } from '../database/entities/part-request.entity';
import { SellerRatingAggregate } from '../database/entities/seller-rating-aggregate.entity';
import {
  ModerationState,
  OfferCondition,
  OfferDelivery,
  OfferInteractionState,
  PartRequestStatus,
  UserRole,
} from '../database/enums';
import { PushService } from '../push/push.service';
import { RealtimeService } from '../realtime/realtime.service';
import { OffersService } from './offers.service';

const chain = (terminal: Record<string, jest.Mock>) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  ...terminal,
});

describe('OffersService.create — audit of the creating staff user', () => {
  let service: OffersService;
  let offersRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let requestsRepo: { findOne: jest.Mock };

  const openRequest = {
    id: 'req-1',
    status: PartRequestStatus.OPEN,
    moderationState: ModerationState.VISIBLE,
    author: { id: 'buyer-1' },
    description: 'Brake pads',
  } as unknown as PartRequest;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        { provide: DataSource, useValue: {} },
        {
          provide: getRepositoryToken(Offer),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            create: jest.fn((v: Partial<Offer>) => v),
            save: jest.fn((v: Partial<Offer>) =>
              Promise.resolve({ ...v, id: 'offer-1' }),
            ),
            createQueryBuilder: jest.fn(() =>
              chain({ getCount: jest.fn().mockResolvedValue(0) }),
            ),
          },
        },
        { provide: getRepositoryToken(OfferPhoto), useValue: {} },
        {
          provide: getRepositoryToken(PartRequest),
          useValue: { findOne: jest.fn().mockResolvedValue(openRequest) },
        },
        {
          provide: getRepositoryToken(SellerRatingAggregate),
          useValue: {
            createQueryBuilder: jest.fn(() =>
              chain({ getMany: jest.fn().mockResolvedValue([]) }),
            ),
          },
        },
        {
          provide: RealtimeService,
          useValue: { emit: jest.fn(), emitToRequestRoom: jest.fn() },
        },
        { provide: PushService, useValue: { sendToUserIds: jest.fn() } },
      ],
    }).compile();

    service = module.get(OffersService);
    offersRepo = module.get(getRepositoryToken(Offer));
    requestsRepo = module.get(getRepositoryToken(PartRequest));
    offersRepo.findOne.mockResolvedValue({
      id: 'offer-1',
      priceAmount: '1000.00',
      priceCurrency: 'AMD',
      createdAt: new Date(),
      photos: [],
      request: openRequest,
      seller: { id: 'persona-1', displayName: 'Shop' },
    });
  });

  const dto = {
    price_amount: 1000,
    condition: OfferCondition.NEW,
    delivery: OfferDelivery.PICKUP_ONLY,
    description: 'In stock',
  };

  it('stores createdByUserId when a staff user creates the offer', async () => {
    await service.create('req-1', 'persona-1', UserRole.SELLER, dto, 'op-1');

    expect(requestsRepo.findOne).toHaveBeenCalled();
    expect(offersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ createdByUserId: 'op-1' }),
    );
  });

  it('leaves createdByUserId null for a regular seller', async () => {
    await service.create('req-1', 'seller-1', UserRole.SELLER, dto);

    expect(offersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ createdByUserId: null }),
    );
  });
});

describe('OffersService.withSellerDealFlags', () => {
  const flagsOf = (o: Partial<Offer>, activeId: string | null) =>
    OffersService.withSellerDealFlags(o as Offer, activeId);

  it('marks the active accepted offer with contact revealed as deal_active', () => {
    const flags = flagsOf(
      { id: 'o1', interactionState: OfferInteractionState.CONTACT_REVEALED },
      'o1',
    );
    expect(flags.deal_active).toBe(true);
    expect(flags.buyer_cancel_pending_ack).toBe(false);
  });

  it('flags a buyer cancellation the seller has not acknowledged', () => {
    const flags = flagsOf(
      {
        id: 'o1',
        interactionState: OfferInteractionState.BUYER_CANCELLED,
        sellerAcknowledgedAt: null,
        buyerDealCancelAt: new Date(),
      },
      null,
    );
    expect(flags).toMatchObject({
      deal_active: false,
      buyer_cancel_pending_ack: true,
      buyer_marked_cancel: true,
      seller_marked_cancel: false,
      buyer_marked_complete: false,
      seller_marked_complete: false,
    });
  });
});
