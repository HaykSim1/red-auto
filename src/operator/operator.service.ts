import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import { Offer } from '../database/entities/offer.entity';
import { PartRequest } from '../database/entities/part-request.entity';
import { User } from '../database/entities/user.entity';
import {
  ModerationState,
  OfferInteractionState,
  PartRequestStatus,
  UserRole,
} from '../database/enums';
import { PatchOfferDto } from '../offers/dto/patch-offer.dto';
import {
  OffersService,
  terminalOfferPredicate,
} from '../offers/offers.service';
import { OpenRequestsQueryDto } from '../requests/dto/open-requests-query.dto';
import { RequestsService } from '../requests/requests.service';
import { SelectionsService } from '../selections/selections.service';
import { OperatorCreateOfferDto } from './dto/operator-create-offer.dto';

const REQUEST_SUMMARY_MAX = 80;

function previewText(text: string | null | undefined, max: number): string {
  const t = (text ?? '').trim();
  if (!t) return '';
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function notFound(): ApiException {
  return new ApiException('not_found', 'Not found.', HttpStatus.NOT_FOUND);
}

/**
 * Staff (role `operator`) acting on behalf of managed shop personas
 * (`users.is_managed_shop`). Every write goes through the regular seller
 * services with the persona as `sellerId`, so pushes, realtime, ratings and
 * the deal flow behave exactly as for a real seller.
 */
@Injectable()
export class OperatorService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Offer)
    private readonly offers: Repository<Offer>,
    @InjectRepository(PartRequest)
    private readonly requests: Repository<PartRequest>,
    private readonly offersService: OffersService,
    private readonly requestsService: RequestsService,
    private readonly selectionsService: SelectionsService,
  ) {}

  // ── Personas ──

  async listShops() {
    const rows = await this.users.find({
      where: { isManagedShop: true, blockedAt: IsNull() },
      order: { shopName: 'ASC' },
    });
    return { items: rows.map((u) => this.serializeShop(u)) };
  }

  private serializeShop(u: User) {
    return {
      id: u.id,
      phone: u.phone,
      shop_name: u.shopName ?? null,
      shop_address: u.shopAddress ?? null,
      seller_phone: u.sellerPhone ?? null,
      seller_telegram: u.sellerTelegram ?? null,
      shop_logo_storage_key: u.shopLogoStorageKey ?? null,
    };
  }

  private async assertPersona(shopId: string): Promise<User> {
    const u = await this.users.findOne({
      where: { id: shopId, role: UserRole.SELLER, isManagedShop: true },
    });
    if (!u) {
      throw new ApiException(
        'managed_shop_not_found',
        'Managed shop not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (u.blockedAt) {
      throw new ApiException(
        'managed_shop_blocked',
        'This managed shop is blocked.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return u;
  }

  /** Returns the persona id owning the offer; 404 for anything that is not a managed shop offer. */
  private async assertOfferBelongsToPersona(offerId: string): Promise<string> {
    const o = await this.offers.findOne({
      where: { id: offerId },
      relations: { seller: true },
    });
    if (!o || !o.seller?.isManagedShop) throw notFound();
    return o.seller.id;
  }

  // ── Requests ──

  async listRequests(operatorId: string, q: OpenRequestsQueryDto) {
    const page = await this.requestsService.listOpen(
      operatorId,
      UserRole.OPERATOR,
      q.limit,
      q.cursor,
      { brand: q.brand, city: q.city },
    );
    const answered = await this.answeredByShopIds(page.items.map((r) => r.id));
    return {
      items: page.items.map((r) => ({
        ...r,
        answered_by_shop_ids: answered[r.id] ?? [],
      })),
      next_cursor: page.next_cursor,
    };
  }

  private async answeredByShopIds(
    requestIds: string[],
  ): Promise<Record<string, string[]>> {
    if (!requestIds.length) return {};
    const rows = await this.offers
      .createQueryBuilder('o')
      .innerJoin('o.seller', 's')
      .select('o.request_id', 'request_id')
      .addSelect('o.seller_id', 'seller_id')
      .where('o.request_id IN (:...ids)', { ids: requestIds })
      .andWhere('o.moderation_state = :vis', { vis: ModerationState.VISIBLE })
      .andWhere('o.interaction_state != :mc', {
        mc: OfferInteractionState.MUTUALLY_CANCELLED,
      })
      .andWhere('s.is_managed_shop = true')
      .getRawMany<{ request_id: string; seller_id: string }>();
    const out: Record<string, string[]> = {};
    for (const r of rows) {
      (out[r.request_id] ??= []).push(r.seller_id);
    }
    return out;
  }

  async getRequest(id: string) {
    const r = await this.requests.findOne({
      where: { id },
      relations: {
        author: true,
        vehicle: true,
        photos: true,
        activeAcceptanceOffer: true,
      },
    });
    if (!r) throw notFound();
    const openAndVisible =
      r.status === PartRequestStatus.OPEN &&
      r.moderationState === ModerationState.VISIBLE;
    if (!openAndVisible && !(await this.managedShopHasHistory(r.id))) {
      throw notFound();
    }
    const [counts, offers] = await Promise.all([
      this.offersService.countVisibleOffersByRequestIds([r.id]),
      this.offers.find({
        where: {
          request: { id: r.id },
          seller: { isManagedShop: true },
          moderationState: ModerationState.VISIBLE,
        },
        relations: { seller: true, photos: true, request: true },
        order: { createdAt: 'ASC' },
      }),
    ]);
    const activeId = r.activeAcceptanceOffer?.id ?? null;
    return {
      ...this.requestsService.serializePublic(r, counts[r.id] ?? 0, 'seller'),
      active_acceptance_offer_id: activeId,
      persona_offers: await this.serializeOffers(offers, activeId),
    };
  }

  private async managedShopHasHistory(requestId: string): Promise<boolean> {
    const cnt = await this.offers
      .createQueryBuilder('o')
      .innerJoin('o.seller', 's')
      .where('o.request_id = :rid', { rid: requestId })
      .andWhere('s.is_managed_shop = true')
      .andWhere('o.moderation_state = :ms', { ms: ModerationState.VISIBLE })
      .andWhere(terminalOfferPredicate())
      .getCount();
    return cnt > 0;
  }

  // ── Offers ──

  async createOffer(
    operatorId: string,
    requestId: string,
    dto: OperatorCreateOfferDto,
  ) {
    const persona = await this.assertPersona(dto.shop_id);
    // CreateOfferDto fields only are read by OffersService.create; shop_id is ignored there.
    return this.offersService.create(
      requestId,
      persona.id,
      UserRole.SELLER,
      dto,
      operatorId,
    );
  }

  async patchOffer(offerId: string, dto: PatchOfferDto) {
    const sellerId = await this.assertOfferBelongsToPersona(offerId);
    return this.offersService.patch(sellerId, offerId, UserRole.SELLER, dto);
  }

  async deleteOffer(offerId: string): Promise<void> {
    const sellerId = await this.assertOfferBelongsToPersona(offerId);
    await this.offersService.softDelete(sellerId, offerId, UserRole.SELLER);
  }

  async acknowledge(offerId: string) {
    const sellerId = await this.assertOfferBelongsToPersona(offerId);
    return this.offersService.acknowledgeBuyerCancellation(
      sellerId,
      offerId,
      UserRole.SELLER,
    );
  }

  async confirmDealComplete(offerId: string) {
    const sellerId = await this.assertOfferBelongsToPersona(offerId);
    return this.selectionsService.sellerMarkDealComplete(
      sellerId,
      offerId,
      UserRole.SELLER,
    );
  }

  async cancelAcceptedOffer(offerId: string, reason: string): Promise<void> {
    const sellerId = await this.assertOfferBelongsToPersona(offerId);
    await this.offersService.cancelAcceptedOfferBySeller(
      sellerId,
      offerId,
      UserRole.SELLER,
      reason,
    );
  }

  async listOffers(limit: number, offset: number) {
    const [rows, total] = await this.offers.findAndCount({
      where: { seller: { isManagedShop: true } },
      relations: {
        seller: true,
        photos: true,
        request: { activeAcceptanceOffer: true },
      },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    const items = await this.serializeOffers(rows);
    return { total, items };
  }

  /** Offer rows with deal flags; `activeId` overrides the per-row request's active offer when given. */
  private async serializeOffers(rows: Offer[], activeId?: string | null) {
    if (!rows.length) return [];
    const agMap = await this.offersService.loadAggregates([
      ...new Set(rows.map((o) => o.seller.id)),
    ]);
    return rows.map((o) => ({
      ...this.offersService.serializeOffer(
        o,
        o.seller.id,
        agMap,
        o.request?.id,
      ),
      ...OffersService.withSellerDealFlags(
        o,
        activeId !== undefined
          ? activeId
          : (o.request?.activeAcceptanceOffer?.id ?? null),
      ),
      interaction_state: o.interactionState,
      created_by_user_id: o.createdByUserId ?? null,
      request_summary: previewText(o.request?.description, REQUEST_SUMMARY_MAX),
      request_status: o.request?.status ?? '',
    }));
  }
}
