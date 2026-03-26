import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Offer } from '../database/entities/offer.entity';
import { PartRequest } from '../database/entities/part-request.entity';
import { User } from '../database/entities/user.entity';
import {
  ModerationState,
  OfferInteractionState,
  PartRequestStatus,
  UserRole,
} from '../database/enums';

export type HomeSummaryResponse = {
  my_open_requests_count: number;
  pending_offers_on_my_requests: number;
  /** Offers the user placed on others’ open requests (sellers and admins). */
  my_open_offers_count: number;
};

export type FeaturedShopItem = {
  id: string;
  shop_name: string;
  shop_logo_storage_key: string | null;
  rating_avg: number | null;
  rating_count: number;
};

@Injectable()
export class HomeService {
  constructor(
    @InjectRepository(PartRequest)
    private readonly requests: Repository<PartRequest>,
    @InjectRepository(Offer)
    private readonly offers: Repository<Offer>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async getSummary(userId: string, role: UserRole): Promise<HomeSummaryResponse> {
    const myOpenRequestsCount = await this.requests.count({
      where: { author: { id: userId }, status: PartRequestStatus.OPEN },
    });

    const pendingOffersOnMyRequests = await this.offers
      .createQueryBuilder('o')
      .innerJoin('o.request', 'r')
      .where('r.author_id = :uid', { uid: userId })
      .andWhere('r.status = :st', { st: PartRequestStatus.OPEN })
      .andWhere('o.interaction_state = :none', {
        none: OfferInteractionState.NONE,
      })
      .getCount();

    let myOpenOffersCount = 0;
    if (role === UserRole.SELLER || role === UserRole.ADMIN) {
      myOpenOffersCount = await this.offers
        .createQueryBuilder('o')
        .innerJoin('o.request', 'r')
        .where('o.seller_id = :uid', { uid: userId })
        .andWhere('r.status = :st', { st: PartRequestStatus.OPEN })
        .andWhere('o.moderation_state = :ms', {
          ms: ModerationState.VISIBLE,
        })
        .getCount();
    }

    return {
      my_open_requests_count: myOpenRequestsCount,
      pending_offers_on_my_requests: pendingOffersOnMyRequests,
      my_open_offers_count: myOpenOffersCount,
    };
  }

  async getFeaturedShops(): Promise<FeaturedShopItem[]> {
    const rows = (await this.users.query(
      `
      SELECT u.id,
             u.shop_name AS shop_name,
             u.shop_logo_storage_key AS shop_logo_storage_key,
             agg.avg_score AS rating_avg,
             COALESCE(agg.rating_count, 0)::int AS rating_count
      FROM users u
      LEFT JOIN seller_rating_aggregate agg ON agg.seller_id = u.id
      WHERE u.role = $1
        AND u.shop_name IS NOT NULL
        AND btrim(u.shop_name) <> ''
      ORDER BY agg.avg_score DESC NULLS LAST,
               agg.rating_count DESC NULLS LAST,
               u.created_at ASC
      LIMIT 10
      `,
      [UserRole.SELLER],
    )) as Array<{
      id: string;
      shop_name: string;
      shop_logo_storage_key: string | null;
      rating_avg: string | null;
      rating_count: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      shop_name: row.shop_name,
      shop_logo_storage_key: row.shop_logo_storage_key,
      rating_avg:
        row.rating_avg != null && row.rating_avg !== ''
          ? Number(row.rating_avg)
          : null,
      rating_count: row.rating_count ?? 0,
    }));
  }
}
