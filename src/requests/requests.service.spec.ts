// requests.service.ts imports PushService → expo-server-sdk (ESM); mock it like admin.service.spec.
jest.mock('../push/push.service', () => ({
  PushService: jest.fn(),
}));

import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ApiException } from '../common/exceptions/api.exception';
import { PartRequest } from '../database/entities/part-request.entity';
import { RequestPhoto } from '../database/entities/request-photo.entity';
import {
  ModerationState,
  PartRequestStatus,
  UserRole,
} from '../database/enums';
import { OffersService } from '../offers/offers.service';
import { PushService } from '../push/push.service';
import { RealtimeService } from '../realtime/realtime.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import {
  OpenRequestsQueryDto,
  toStringList,
} from './dto/open-requests-query.dto';
import { RequestsService } from './requests.service';

const REQUEST_ID = 'r-1';
const AUTHOR_ID = 'u-author';

function mockRequest(overrides: Partial<PartRequest> = {}): PartRequest {
  return {
    id: REQUEST_ID,
    description: 'Front brake pads',
    quantity: 1,
    city: 'yerevan',
    vinText: null,
    partNumber: null,
    status: PartRequestStatus.OPEN,
    moderationState: ModerationState.VISIBLE,
    region: 'AM',
    createdAt: new Date('2026-10-01T10:00:00Z'),
    updatedAt: new Date('2026-10-01T10:00:00Z'),
    author: { id: AUTHOR_ID, isSpecialBuyer: false },
    vehicle: null,
    photos: [],
    activeAcceptanceOffer: null,
    ...overrides,
  } as unknown as PartRequest;
}

function expectApiError(
  promise: Promise<unknown>,
  code: string,
  status: HttpStatus,
) {
  return promise.then(
    () => {
      throw new Error('expected ApiException');
    },
    (e: unknown) => {
      expect(e).toBeInstanceOf(ApiException);
      const err = e as ApiException;
      expect(err.getStatus()).toBe(status);
      expect((err.getResponse() as { code: string }).code).toBe(code);
    },
  );
}

describe('RequestsService', () => {
  let service: RequestsService;
  let em: { save: jest.Mock; delete: jest.Mock; create: jest.Mock };
  const requestsRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: { transaction: jest.fn() },
  };
  const offers = {
    countVisibleOffersByRequestIds: jest.fn(),
    listForAuthor: jest.fn(),
    listVisibleOfferSellerIds: jest.fn(),
  };
  const realtime = { emit: jest.fn(), emitToRequestRoom: jest.fn() };
  const push = { sendToUserIds: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    em = {
      save: jest.fn(),
      delete: jest.fn(),
      create: jest.fn((_entity: unknown, v: unknown) => v),
    };
    requestsRepo.manager.transaction.mockImplementation(
      (cb: (m: typeof em) => Promise<void>) => cb(em),
    );
    offers.countVisibleOffersByRequestIds.mockResolvedValue({
      [REQUEST_ID]: 0,
    });
    offers.listForAuthor.mockResolvedValue([]);
    offers.listVisibleOfferSellerIds.mockResolvedValue([]);
    push.sendToUserIds.mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        RequestsService,
        { provide: getRepositoryToken(PartRequest), useValue: requestsRepo },
        { provide: getRepositoryToken(RequestPhoto), useValue: {} },
        { provide: VehiclesService, useValue: {} },
        { provide: OffersService, useValue: offers },
        { provide: RealtimeService, useValue: realtime },
        { provide: PushService, useValue: push },
      ],
    }).compile();
    service = module.get(RequestsService);
  });

  describe('patchAuthor', () => {
    it('404s when the request is not owned by the caller', async () => {
      requestsRepo.findOne.mockResolvedValueOnce(null);
      await expectApiError(
        service.patchAuthor(REQUEST_ID, 'someone-else', { description: 'x' }),
        'not_found',
        HttpStatus.NOT_FOUND,
      );
      expect(requestsRepo.manager.transaction).not.toHaveBeenCalled();
    });

    it('rejects content edits on a closed request', async () => {
      requestsRepo.findOne.mockResolvedValueOnce(
        mockRequest({ status: PartRequestStatus.CLOSED }),
      );
      await expectApiError(
        service.patchAuthor(REQUEST_ID, AUTHOR_ID, { description: 'new' }),
        'request_not_open',
        HttpStatus.BAD_REQUEST,
      );
    });

    it('rejects content edits while an accepted offer is active', async () => {
      requestsRepo.findOne.mockResolvedValueOnce(
        mockRequest({
          activeAcceptanceOffer: { id: 'o-1' } as never,
        }),
      );
      await expectApiError(
        service.patchAuthor(REQUEST_ID, AUTHOR_ID, { city: 'gyumri' }),
        'request_deal_active',
        HttpStatus.BAD_REQUEST,
      );
    });

    it('rejects content edits on a hidden request but still allows cancelling it', async () => {
      requestsRepo.findOne.mockResolvedValueOnce(
        mockRequest({ moderationState: ModerationState.HIDDEN }),
      );
      await expectApiError(
        service.patchAuthor(REQUEST_ID, AUTHOR_ID, { description: 'new' }),
        'request_hidden',
        HttpStatus.BAD_REQUEST,
      );

      const hidden = mockRequest({ moderationState: ModerationState.HIDDEN });
      requestsRepo.findOne
        .mockResolvedValueOnce(hidden)
        .mockResolvedValueOnce(hidden);
      await service.patchAuthor(REQUEST_ID, AUTHOR_ID, {
        status: PartRequestStatus.CANCELLED,
      });
      expect(hidden.status).toBe(PartRequestStatus.CANCELLED);
      expect(realtime.emit).not.toHaveBeenCalled();
      expect(push.sendToUserIds).not.toHaveBeenCalled();
    });

    it('replaces the photo set in order inside the transaction', async () => {
      const r = mockRequest();
      requestsRepo.findOne.mockResolvedValueOnce(r).mockResolvedValueOnce(r);
      await service.patchAuthor(REQUEST_ID, AUTHOR_ID, {
        photo_storage_keys: ['b.jpg', 'a.jpg'],
      });
      expect(em.delete).toHaveBeenCalledTimes(1);
      expect(em.delete).toHaveBeenCalledWith(RequestPhoto, {
        request: { id: REQUEST_ID },
      });
      const calls = em.save.mock.calls as unknown[][];
      const saved = calls.find((c) => c[0] === RequestPhoto)?.[1];
      expect(saved).toEqual([
        expect.objectContaining({ storageKey: 'b.jpg', sortOrder: 0 }),
        expect.objectContaining({ storageKey: 'a.jpg', sortOrder: 1 }),
      ]);
    });

    it('removes every photo when given an empty array', async () => {
      const r = mockRequest();
      requestsRepo.findOne.mockResolvedValueOnce(r).mockResolvedValueOnce(r);
      await service.patchAuthor(REQUEST_ID, AUTHOR_ID, {
        photo_storage_keys: [],
      });
      expect(em.delete).toHaveBeenCalledTimes(1);
      const calls = em.save.mock.calls as unknown[][];
      expect(calls.some((c) => c[0] === RequestPhoto)).toBe(false);
    });

    it('normalises fields and notifies sellers with a live offer once each', async () => {
      const r = mockRequest({ description: 'x'.repeat(80) });
      requestsRepo.findOne.mockResolvedValueOnce(r).mockResolvedValueOnce(r);
      offers.listVisibleOfferSellerIds.mockResolvedValueOnce([
        's1',
        's2',
        AUTHOR_ID,
      ]);
      await service.patchAuthor(REQUEST_ID, AUTHOR_ID, {
        part_number: '  ',
        city: ' gyumri ',
        quantity: 3,
      });
      expect(r.partNumber).toBeNull();
      expect(r.city).toBe('gyumri');
      expect(r.quantity).toBe(3);
      expect(realtime.emit).toHaveBeenCalledWith('request.updated', {
        request_id: REQUEST_ID,
      });
      expect(realtime.emitToRequestRoom).toHaveBeenCalledWith(
        REQUEST_ID,
        'request.updated',
        { request_id: REQUEST_ID },
      );
      expect(push.sendToUserIds).toHaveBeenCalledTimes(1);
      const [ids, msg] = push.sendToUserIds.mock.calls[0] as [
        string[],
        { title: string; body: string; data: Record<string, string> },
      ];
      expect(ids).toEqual(['s1', 's2']);
      expect(msg.title).toBe('Request updated');
      expect(msg.body).toBe(`${'x'.repeat(60)}…`);
      expect(msg.data).toEqual({
        type: 'request.updated',
        request_id: REQUEST_ID,
      });
    });

    it('rejects a blank description', async () => {
      requestsRepo.findOne.mockResolvedValueOnce(mockRequest());
      await expectApiError(
        service.patchAuthor(REQUEST_ID, AUTHOR_ID, { description: '   ' }),
        'bad_request',
        HttpStatus.BAD_REQUEST,
      );
    });
  });

  describe('listOpen', () => {
    function chainableQb() {
      const qb: Record<string, jest.Mock> = {};
      for (const m of [
        'leftJoinAndSelect',
        'where',
        'andWhere',
        'orderBy',
        'addOrderBy',
        'take',
      ]) {
        qb[m] = jest.fn().mockReturnValue(qb);
      }
      qb.getMany = jest.fn().mockResolvedValue([]);
      return qb;
    }

    it('applies brand (lower-cased) and city filters', async () => {
      const qb = chainableQb();
      requestsRepo.createQueryBuilder.mockReturnValueOnce(qb);
      offers.countVisibleOffersByRequestIds.mockResolvedValueOnce({});
      await service.listOpen('u-seller', UserRole.SELLER, 20, undefined, {
        brand: ['BMW', 'honda'],
        city: ['yerevan'],
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'LOWER(vehicle.brand) IN (:...brands)',
        { brands: ['bmw', 'honda'] },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('r.city IN (:...cities)', {
        cities: ['yerevan'],
      });
    });

    it('adds no filter clauses when filters are empty', async () => {
      const qb = chainableQb();
      requestsRepo.createQueryBuilder.mockReturnValueOnce(qb);
      offers.countVisibleOffersByRequestIds.mockResolvedValueOnce({});
      await service.listOpen('u-seller', UserRole.SELLER, 20, undefined, {
        brand: [],
      });
      const clauses = (qb.andWhere.mock.calls as unknown[][]).map((c) =>
        String(c[0]),
      );
      expect(clauses.some((c) => c.includes('vehicle.brand'))).toBe(false);
      expect(clauses.some((c) => c.includes('r.city IN'))).toBe(false);
    });

    it('is forbidden for buyers', async () => {
      await expectApiError(
        service.listOpen('u-buyer', UserRole.USER),
        'seller_feed_required',
        HttpStatus.FORBIDDEN,
      );
    });
  });
});

describe('OpenRequestsQueryDto', () => {
  it('normalises single, repeated and CSV values', () => {
    expect(toStringList({ value: 'BMW' })).toEqual(['BMW']);
    expect(toStringList({ value: ['a', 'b,c', ' b '] })).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(toStringList({ value: '' })).toBeUndefined();
    expect(toStringList({ value: undefined })).toBeUndefined();
  });

  it('rejects more than ten values', async () => {
    const dto = plainToInstance(OpenRequestsQueryDto, {
      brand: Array.from({ length: 11 }, (_, i) => `b${i}`),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'brand')).toBe(true);
  });
});
