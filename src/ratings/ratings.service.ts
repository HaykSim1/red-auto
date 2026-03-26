import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import { Offer } from '../database/entities/offer.entity';
import { PartRequest } from '../database/entities/part-request.entity';
import { Selection } from '../database/entities/selection.entity';
import { SellerRating } from '../database/entities/seller-rating.entity';
import { SellerRatingAggregate } from '../database/entities/seller-rating-aggregate.entity';
import { User } from '../database/entities/user.entity';
import { CreateRatingDto } from './dto/create-rating.dto';

@Injectable()
export class RatingsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SellerRating)
    private readonly ratings: Repository<SellerRating>,
  ) {}

  async create(raterId: string, dto: CreateRatingDto) {
    const existing = await this.ratings.findOne({
      where: {
        request: { id: dto.request_id },
        rater: { id: raterId },
      },
      relations: { seller: true },
    });
    if (existing) {
      return {
        id: existing.id,
        request_id: dto.request_id,
        seller_id: existing.seller.id,
        score: existing.score,
        comment: existing.comment,
        created_at: existing.createdAt.toISOString(),
        idempotent: true as const,
      };
    }

    return this.dataSource.transaction(async (em) => {
      const req = await em.findOne(PartRequest, {
        where: { id: dto.request_id },
        relations: { author: true },
      });
      if (!req || req.author.id !== raterId) {
        throw new ApiException(
          'forbidden',
          'Only the request author can rate.',
          HttpStatus.FORBIDDEN,
        );
      }

      const sel = await em.findOne(Selection, {
        where: { requestId: dto.request_id },
      });
      if (!sel) {
        throw new ApiException(
          'bad_request',
          'No selection on this request.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const offer = await em.findOne(Offer, {
        where: { id: sel.chosenOfferId },
        relations: { seller: true },
      });
      if (!offer) {
        throw new ApiException(
          'not_found',
          'Offer not found.',
          HttpStatus.NOT_FOUND,
        );
      }

      const sellerId = offer.seller.id;

      const row = em.create(SellerRating, {
        request: req,
        rater: { id: raterId } as User,
        seller: { id: sellerId } as User,
        score: dto.score,
        comment: dto.comment?.trim() ?? null,
      });

      let saved: SellerRating;
      try {
        saved = await em.save(row);
      } catch (e) {
        const err = e as { code?: string };
        if (err.code === '23505') {
          const again = await em.findOne(SellerRating, {
            where: {
              request: { id: dto.request_id },
              rater: { id: raterId },
            },
            relations: { seller: true },
          });
          if (again) {
            return {
              id: again.id,
              request_id: dto.request_id,
              seller_id: again.seller.id,
              score: again.score,
              comment: again.comment,
              created_at: again.createdAt.toISOString(),
              idempotent: true as const,
            };
          }
        }
        throw e;
      }

      await this.refreshAggregate(em, sellerId);

      return {
        id: saved.id,
        request_id: dto.request_id,
        seller_id: sellerId,
        score: saved.score,
        comment: saved.comment,
        created_at: saved.createdAt.toISOString(),
      };
    });
  }

  private async refreshAggregate(
    em: import('typeorm').EntityManager,
    sellerId: string,
  ): Promise<void> {
    const raw = await em
      .createQueryBuilder(SellerRating, 'r')
      .select('COUNT(*)', 'cnt')
      .addSelect('AVG(r.score)', 'avg')
      .where('r.seller_id = :sid', { sid: sellerId })
      .getRawOne<{ cnt: string; avg: string }>();

    const ratingCount = Number(raw?.cnt ?? 0);
    const avgScore =
      ratingCount === 0 ? 0 : Number.parseFloat(String(raw?.avg ?? '0'));
    const rounded = Math.round(avgScore * 1000) / 1000;

    let agg = await em.findOne(SellerRatingAggregate, {
      where: { sellerId },
    });
    if (!agg) {
      agg = em.create(SellerRatingAggregate, {
        sellerId,
        avgScore: '0.000',
        ratingCount: 0,
      });
    }
    agg.avgScore = rounded.toFixed(3);
    agg.ratingCount = ratingCount;
    await em.save(agg);
  }
}
