import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository, Between } from 'typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import type { JwtUserPayload } from '../common/interfaces/jwt-user-payload.interface';
import { AppVersionConfig } from '../database/entities/app-version-config.entity';
import { Offer } from '../database/entities/offer.entity';
import { PartRequest } from '../database/entities/part-request.entity';
import { SellerApplication } from '../database/entities/seller-application.entity';
import { User } from '../database/entities/user.entity';
import { SellerApplicationStatus, UserRole } from '../database/enums';
import { PushService } from '../push/push.service';
import { PatchModerationDto } from './dto/patch-moderation.dto';
import { UpdateAppVersionDto } from './dto/update-app-version.dto';

function previewText(text: string | null | undefined, max: number): string {
  const t = (text ?? '').trim();
  if (!t) return '';
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(PartRequest)
    private readonly requests: Repository<PartRequest>,
    @InjectRepository(Offer)
    private readonly offers: Repository<Offer>,
    @InjectRepository(SellerApplication)
    private readonly sellerApplications: Repository<SellerApplication>,
    @InjectRepository(AppVersionConfig)
    private readonly appVersionConfigs: Repository<AppVersionConfig>,
    private readonly push: PushService,
    private readonly jwt: JwtService,
  ) {}

  async adminLogin(email: string, password: string) {
    const user = await this.users.findOne({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || user.role !== UserRole.ADMIN || !user.passwordHash) {
      throw new ApiException(
        'invalid_credentials',
        'Invalid email or password.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new ApiException(
        'invalid_credentials',
        'Invalid email or password.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.blockedAt) {
      throw new ApiException(
        'user_blocked',
        'User is blocked.',
        HttpStatus.FORBIDDEN,
      );
    }

    const payload: JwtUserPayload = {
      sub: user.id,
      role: user.role,
      phone_verified: true,
    };

    const access_token = await this.jwt.signAsync({
      sub: payload.sub,
      role: payload.role,
      phone_verified: payload.phone_verified,
    });

    return {
      access_token,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        display_name: user.displayName,
        preferred_locale: user.preferredLocale,
      },
    };
  }

  sendTestPush(targetUserId: string) {
    return this.push.sendTestToUser(targetUserId);
  }

  async listUsers(limit: number, offset: number) {
    const [rows, total] = await this.users.findAndCount({
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 100),
      skip: offset,
    });
    return {
      total,
      items: rows.map((u) => ({
        id: u.id,
        phone: u.phone,
        role: u.role,
        blocked_at: u.blockedAt?.toISOString() ?? null,
        display_name: u.displayName,
        is_special_buyer: u.isSpecialBuyer,
        created_at: u.createdAt.toISOString(),
      })),
    };
  }

  async blockUser(id: string): Promise<void> {
    const u = await this.users.findOne({ where: { id } });
    if (!u) {
      throw new ApiException(
        'not_found',
        'User not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    u.blockedAt = new Date();
    await this.users.save(u);
  }

  async unblockUser(id: string): Promise<void> {
    const u = await this.users.findOne({ where: { id } });
    if (!u) {
      throw new ApiException(
        'not_found',
        'User not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    u.blockedAt = null;
    await this.users.save(u);
  }

  async setSpecialBuyer(id: string, isSpecial: boolean) {
    const u = await this.users.findOne({ where: { id } });
    if (!u) {
      throw new ApiException(
        'not_found',
        'User not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (u.role !== UserRole.USER) {
      throw new ApiException(
        'not_a_buyer',
        'Special buyer flag applies only to buyer accounts.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    u.isSpecialBuyer = isSpecial;
    await this.users.save(u);
    return {
      id: u.id,
      is_special_buyer: u.isSpecialBuyer,
    };
  }

  async listRequests(limit: number, offset: number) {
    const [rows, total] = await this.requests.findAndCount({
      relations: { author: true },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 100),
      skip: offset,
    });
    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        author_id: r.author.id,
        author_display_name: r.author.displayName,
        title: previewText(r.description, 120) || '(No description)',
        description: r.description,
        status: r.status,
        moderation_state: r.moderationState,
        created_at: r.createdAt.toISOString(),
      })),
    };
  }

  async patchRequest(id: string, dto: PatchModerationDto) {
    const r = await this.requests.findOne({ where: { id } });
    if (!r) {
      throw new ApiException(
        'not_found',
        'Request not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    r.moderationState = dto.moderation_state;
    await this.requests.save(r);
    return { id: r.id, moderation_state: r.moderationState };
  }

  async listOffers(limit: number, offset: number) {
    const [rows, total] = await this.offers.findAndCount({
      relations: { request: true, seller: true },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 100),
      skip: offset,
    });
    return {
      total,
      items: rows.map((o) => {
        const label = o.variantLabel?.trim();
        const priceBit = `${o.priceAmount} AMD`;
        const title = label
          ? `${o.seller.displayName?.trim() || o.seller.phone} · ${label} · ${priceBit}`
          : `${o.seller.displayName?.trim() || o.seller.phone} · ${priceBit}`;
        return {
          id: o.id,
          request_id: o.request.id,
          seller_id: o.seller.id,
          title,
          request_summary:
            previewText(o.request.description, 100) || '(No description)',
          seller_label: o.seller.displayName?.trim() || o.seller.phone,
          moderation_state: o.moderationState,
          price_amount: o.priceAmount,
          variant_label: o.variantLabel,
          created_at: o.createdAt.toISOString(),
        };
      }),
    };
  }

  async patchOffer(id: string, dto: PatchModerationDto) {
    const o = await this.offers.findOne({ where: { id } });
    if (!o) {
      throw new ApiException(
        'not_found',
        'Offer not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    o.moderationState = dto.moderation_state;
    await this.offers.save(o);
    return { id: o.id, moderation_state: o.moderationState };
  }

  async listSellerApplications(
    status: SellerApplicationStatus | undefined,
    limit: number,
    offset: number,
  ) {
    const qb = this.sellerApplications
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.user', 'u')
      .orderBy('a.createdAt', 'DESC')
      .take(Math.min(limit, 100))
      .skip(offset);
    if (status) {
      qb.andWhere('a.status = :status', { status });
    }
    const [rows, total] = await qb.getManyAndCount();
    return {
      total,
      items: rows.map((a) => ({
        id: a.id,
        user_id: a.user.id,
        user_phone: a.user.phone,
        status: a.status,
        shop_name: a.shopName,
        shop_address: a.shopAddress,
        shop_phone: a.shopPhone,
        logo_storage_key: a.logoStorageKey,
        rejection_reason: a.rejectionReason,
        reviewed_at: a.reviewedAt?.toISOString() ?? null,
        created_at: a.createdAt.toISOString(),
      })),
    };
  }

  async approveSellerApplication(id: string) {
    await this.sellerApplications.manager.transaction(async (em) => {
      const app = await em.findOne(SellerApplication, {
        where: { id },
        relations: { user: true },
      });
      if (!app) {
        throw new ApiException(
          'not_found',
          'Seller application not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (app.status !== SellerApplicationStatus.PENDING) {
        throw new ApiException(
          'seller_application_not_pending',
          'Application is not pending.',
          HttpStatus.BAD_REQUEST,
        );
      }
      const u = app.user;
      if (u.role !== UserRole.USER) {
        throw new ApiException(
          'seller_application_invalid_user',
          'User is not a buyer; cannot approve.',
          HttpStatus.BAD_REQUEST,
        );
      }
      app.status = SellerApplicationStatus.APPROVED;
      app.reviewedAt = new Date();
      app.rejectionReason = null;
      await em.save(app);
      u.role = UserRole.SELLER;
      u.shopName = app.shopName;
      u.shopAddress = app.shopAddress;
      u.shopLogoStorageKey = app.logoStorageKey;
      u.sellerPhone = app.shopPhone;
      await em.save(u);
    });
    return { ok: true };
  }

  async rejectSellerApplication(id: string, reason: string) {
    const app = await this.sellerApplications.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!app) {
      throw new ApiException(
        'not_found',
        'Seller application not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (app.status !== SellerApplicationStatus.PENDING) {
      throw new ApiException(
        'seller_application_not_pending',
        'Application is not pending.',
        HttpStatus.BAD_REQUEST,
      );
    }
    app.status = SellerApplicationStatus.REJECTED;
    app.rejectionReason = reason.trim();
    app.reviewedAt = new Date();
    await this.sellerApplications.save(app);
    return { ok: true };
  }

  async statsSummary(from: Date, to: Date) {
    const [users, requests, offers] = await Promise.all([
      this.users.count({ where: { createdAt: Between(from, to) } }),
      this.requests.count({ where: { createdAt: Between(from, to) } }),
      this.offers.count({ where: { createdAt: Between(from, to) } }),
    ]);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      counts: { users, requests, offers },
    };
  }

  async listFeaturedShops(limit: number, offset: number) {
    const [rows, total] = await this.users.findAndCount({
      where: { role: UserRole.SELLER },
      order: { isFeatured: 'DESC', createdAt: 'DESC' },
      take: Math.min(limit, 100),
      skip: offset,
    });

    const ids = rows.map((u) => u.id);
    let ratingMap: Record<
      string,
      { avg_score: string | null; rating_count: number }
    > = {};
    if (ids.length > 0) {
      const agg = (await this.users.query(
        `SELECT seller_id, avg_score, rating_count FROM seller_rating_aggregate WHERE seller_id = ANY($1)`,
        [ids],
      )) as Array<{
        seller_id: string;
        avg_score: string | null;
        rating_count: number;
      }>;
      ratingMap = Object.fromEntries(agg.map((r) => [r.seller_id, r]));
    }

    return {
      total,
      items: rows.map((u) => {
        const agg = ratingMap[u.id];
        return {
          id: u.id,
          phone: u.phone,
          shop_name: u.shopName,
          rating_avg:
            agg?.avg_score != null && agg.avg_score !== ''
              ? Number(agg.avg_score)
              : null,
          rating_count: agg?.rating_count ?? 0,
          is_featured: u.isFeatured,
          created_at: u.createdAt.toISOString(),
        };
      }),
    };
  }

  async featureShop(id: string): Promise<void> {
    const u = await this.users.findOne({ where: { id } });
    if (!u) {
      throw new ApiException(
        'not_found',
        'User not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (u.role !== UserRole.SELLER) {
      throw new ApiException(
        'not_a_seller',
        'User is not a seller.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    u.isFeatured = true;
    await this.users.save(u);
  }

  async unfeatureShop(id: string): Promise<void> {
    const u = await this.users.findOne({ where: { id } });
    if (!u) {
      throw new ApiException(
        'not_found',
        'User not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (u.role !== UserRole.SELLER) {
      throw new ApiException(
        'not_a_seller',
        'User is not a seller.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    u.isFeatured = false;
    await this.users.save(u);
  }

  async getAppVersions(): Promise<AppVersionConfig[]> {
    return this.appVersionConfigs.find();
  }

  async patchAppVersion(
    platform: 'ios' | 'android',
    dto: UpdateAppVersionDto,
  ): Promise<AppVersionConfig> {
    let config = await this.appVersionConfigs.findOne({ where: { platform } });
    if (!config) {
      config = this.appVersionConfigs.create({ platform });
    }
    if (dto.min_build !== undefined) config.minBuild = dto.min_build;
    if (dto.force_update_enabled !== undefined) config.forceUpdateEnabled = dto.force_update_enabled;
    if (dto.store_url !== undefined) config.storeUrl = dto.store_url ?? null;
    return this.appVersionConfigs.save(config);
  }
}
