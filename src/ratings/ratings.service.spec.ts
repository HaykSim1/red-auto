import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SellerRating } from '../database/entities/seller-rating.entity';
import { SellerRatingAggregate } from '../database/entities/seller-rating-aggregate.entity';
import { User } from '../database/entities/user.entity';
import { HttpStatus } from '@nestjs/common';
import { ModerationState, UserRole } from '../database/enums';
import { RatingsService } from './ratings.service';

describe('RatingsService.refreshAggregate', () => {
  let service: RatingsService;
  let ratingsRepo: { createQueryBuilder: jest.Mock };
  let aggregatesRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let qb: {
    select: jest.Mock;
    addSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getRawOne: jest.Mock;
  };

  beforeEach(async () => {
    qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ cnt: '2', avg: '4' }),
    };
    ratingsRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    aggregatesRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((v: unknown) => v),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsService,
        { provide: getRepositoryToken(SellerRating), useValue: ratingsRepo },
        {
          provide: getRepositoryToken(SellerRatingAggregate),
          useValue: aggregatesRepo,
        },
        { provide: getRepositoryToken(User), useValue: {} },
      ],
    }).compile();

    service = module.get(RatingsService);
  });

  it('counts only visible ratings toward the aggregate', async () => {
    await service.refreshAggregate('seller-1');

    expect(qb.andWhere).toHaveBeenCalledWith('r.moderation_state = :ms', {
      ms: ModerationState.VISIBLE,
    });
  });

  it('still scopes the query to the seller', async () => {
    await service.refreshAggregate('seller-1');

    expect(qb.where).toHaveBeenCalledWith('r.seller_id = :sid', {
      sid: 'seller-1',
    });
  });

  it('writes the recomputed average and count', async () => {
    await service.refreshAggregate('seller-1');

    expect(aggregatesRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        sellerId: 'seller-1',
        avgScore: '4.000',
        ratingCount: 2,
      }),
    );
  });

  it('writes a zero aggregate when every rating is hidden', async () => {
    qb.getRawOne.mockResolvedValue({ cnt: '0', avg: null });

    await service.refreshAggregate('seller-1');

    expect(aggregatesRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ avgScore: '0.000', ratingCount: 0 }),
    );
  });
});

describe('RatingsService.create — staff cannot rate', () => {
  it('rejects an operator rater with 403 forbidden before touching ratings', async () => {
    const usersRepo = {
      findOne: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === 'op-1'
            ? { id: 'op-1', role: UserRole.OPERATOR }
            : { id: 'persona-1', role: UserRole.SELLER },
        ),
      ),
    };
    const ratingsRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsService,
        { provide: getRepositoryToken(SellerRating), useValue: ratingsRepo },
        { provide: getRepositoryToken(SellerRatingAggregate), useValue: {} },
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();
    const service = module.get(RatingsService);

    await expect(
      service.create('op-1', { seller_id: 'persona-1', score: 5 }),
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      code: 'forbidden',
    });
    expect(ratingsRepo.save).not.toHaveBeenCalled();
  });
});
