import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import { SellerRating } from '../database/entities/seller-rating.entity';
import { SellerRatingAggregate } from '../database/entities/seller-rating-aggregate.entity';
import { User } from '../database/entities/user.entity';
import { UserRole } from '../database/enums';
import { CreateRatingDto } from './dto/create-rating.dto';

const COOLDOWN_DAYS = 10;

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(SellerRating)
    private readonly ratings: Repository<SellerRating>,
    @InjectRepository(SellerRatingAggregate)
    private readonly aggregates: Repository<SellerRatingAggregate>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async create(raterId: string, dto: CreateRatingDto) {
    if (raterId === dto.seller_id) {
      throw new ApiException(
        'rating_self',
        'You cannot rate yourself.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const seller = await this.users.findOne({ where: { id: dto.seller_id } });
    if (!seller || seller.role !== UserRole.SELLER) {
      throw new ApiException(
        'not_found',
        'Seller not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    // Enforce 10-day cooldown per (rater, seller) pair
    const cooldownFrom = new Date();
    cooldownFrom.setDate(cooldownFrom.getDate() - COOLDOWN_DAYS);

    const recent = await this.ratings.findOne({
      where: {
        rater: { id: raterId },
        seller: { id: dto.seller_id },
      },
      order: { createdAt: 'DESC' },
    });

    if (recent && recent.createdAt > cooldownFrom) {
      throw new ApiException(
        'rating_cooldown',
        `You can rate this seller once every ${COOLDOWN_DAYS} days.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const row = this.ratings.create({
      rater: { id: raterId } as User,
      seller: { id: dto.seller_id } as User,
      request: null,
      score: dto.score,
      comment: dto.comment?.trim() ?? null,
    });

    const saved = await this.ratings.save(row);
    await this.refreshAggregate(dto.seller_id);

    return {
      id: saved.id,
      seller_id: dto.seller_id,
      score: saved.score,
      comment: saved.comment,
      created_at: saved.createdAt.toISOString(),
    };
  }

  private async refreshAggregate(sellerId: string): Promise<void> {
    const raw = await this.ratings
      .createQueryBuilder('r')
      .select('COUNT(*)', 'cnt')
      .addSelect('AVG(r.score)', 'avg')
      .where('r.seller_id = :sid', { sid: sellerId })
      .getRawOne<{ cnt: string; avg: string }>();

    const ratingCount = Number(raw?.cnt ?? 0);
    const avgScore =
      ratingCount === 0 ? 0 : Number.parseFloat(String(raw?.avg ?? '0'));
    const rounded = Math.round(avgScore * 1000) / 1000;

    let agg = await this.aggregates.findOne({ where: { sellerId } });
    if (!agg) {
      agg = this.aggregates.create({
        sellerId,
        avgScore: '0.000',
        ratingCount: 0,
      });
    }
    agg.avgScore = rounded.toFixed(3);
    agg.ratingCount = ratingCount;
    await this.aggregates.save(agg);
  }
}
