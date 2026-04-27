import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Offer } from '../database/entities/offer.entity';
import { PartRequest } from '../database/entities/part-request.entity';
import { SellerRating } from '../database/entities/seller-rating.entity';
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

export type PublicShopReview = {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
};

/** Public shop profile (phone for calls; no messengers in JSON). */
export type PublicShopDetail = {
  id: string;
  shop_name: string;
  shop_logo_storage_key: string | null;
  /** Shop bio / marketing copy when available; null in MVP. */
  description: string | null;
  shop_address: string | null;
  seller_phone: string | null;
  is_featured: boolean;
  rating_avg: number | null;
  rating_count: number;
  reviews: PublicShopReview[];
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
    @InjectRepository(SellerRating)
    private readonly sellerRatings: Repository<SellerRating>,
  ) {}

  async getSummary(
    userId: string,
    role: UserRole,
  ): Promise<HomeSummaryResponse> {
    const isSeller = role === UserRole.SELLER || role === UserRole.ADMIN;

    const openOffersQuery = isSeller
      ? this.offers
          .createQueryBuilder('o')
          .innerJoin('o.request', 'r')
          .where('o.seller_id = :uid', { uid: userId })
          .andWhere('r.status = :st', { st: PartRequestStatus.OPEN })
          .andWhere('o.moderation_state = :ms', { ms: ModerationState.VISIBLE })
          .getCount()
      : Promise.resolve(0);

    const [myOpenRequestsCount, pendingOffersOnMyRequests, myOpenOffersCount] =
      await Promise.all([
        this.requests.count({
          where: { author: { id: userId }, status: PartRequestStatus.OPEN },
        }),
        this.offers
          .createQueryBuilder('o')
          .innerJoin('o.request', 'r')
          .where('r.author_id = :uid', { uid: userId })
          .andWhere('r.status = :st', { st: PartRequestStatus.OPEN })
          .andWhere('o.interaction_state = :none', {
            none: OfferInteractionState.NONE,
          })
          .getCount(),
        openOffersQuery,
      ]);

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
        AND u.is_featured = true
        AND u.shop_name IS NOT NULL
        AND btrim(u.shop_name) <> ''
      ORDER BY agg.avg_score DESC NULLS LAST,
               u.created_at ASC
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

  async getPublicShopDetail(sellerId: string): Promise<PublicShopDetail> {
    const rows = await this.users.query(
      `
      SELECT u.id,
             u.shop_name AS shop_name,
             u.shop_address AS shop_address,
             u.seller_phone AS seller_phone,
             u.shop_logo_storage_key AS shop_logo_storage_key,
             u.is_featured AS is_featured,
             agg.avg_score AS rating_avg,
             COALESCE(agg.rating_count, 0)::int AS rating_count
      FROM users u
      LEFT JOIN seller_rating_aggregate agg ON agg.seller_id = u.id
      WHERE u.id = $1
        AND u.role = $2
        AND u.shop_name IS NOT NULL
        AND btrim(u.shop_name) <> ''
      `,
      [sellerId, UserRole.SELLER],
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException();
    }

    const addr = row.shop_address?.trim() ?? '';
    const phone = row.seller_phone?.trim() ?? '';

    const reviewRows = await this.sellerRatings.find({
      where: { seller: { id: sellerId } },
      relations: { rater: true },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return {
      id: row.id,
      shop_name: row.shop_name,
      shop_logo_storage_key: row.shop_logo_storage_key,
      description: null,
      shop_address: addr.length > 0 ? addr : null,
      seller_phone: phone.length > 0 ? phone : null,
      is_featured: row.is_featured === true,
      rating_avg:
        row.rating_avg != null && row.rating_avg !== ''
          ? Number(row.rating_avg)
          : null,
      rating_count: row.rating_count ?? 0,
      reviews: reviewRows.map((r) => ({
        id: r.id,
        score: r.score,
        comment: r.comment,
        rater_name: r.rater?.displayName?.trim() || null,
        created_at: r.createdAt.toISOString(),
      })),
    };
  }
}
