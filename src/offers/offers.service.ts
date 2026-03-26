import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import { OfferPhoto } from '../database/entities/offer-photo.entity';
import { Offer } from '../database/entities/offer.entity';
import { PartRequest } from '../database/entities/part-request.entity';
import { Selection } from '../database/entities/selection.entity';
import { SellerRatingAggregate } from '../database/entities/seller-rating-aggregate.entity';
import { User } from '../database/entities/user.entity';
import {
  ModerationState,
  OfferInteractionState,
  PartRequestStatus,
  UserRole,
} from '../database/enums';
import { PushService } from '../push/push.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { PatchOfferDto } from './dto/patch-offer.dto';

/** Max “stuck” offers per seller before blocking new offers (see docs). */
export const STUCK_OFFER_LIMIT = 3;

export type AuthorOfferListMask = {
  activeAcceptanceOfferId: string | null;
  chosenOfferId: string | null;
  requestStatus: PartRequestStatus;
};

@Injectable()
export class OffersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Offer)
    private readonly offers: Repository<Offer>,
    @InjectRepository(OfferPhoto)
    private readonly offerPhotos: Repository<OfferPhoto>,
    @InjectRepository(PartRequest)
    private readonly requests: Repository<PartRequest>,
    @InjectRepository(Selection)
    private readonly selections: Repository<Selection>,
    @InjectRepository(SellerRatingAggregate)
    private readonly aggregates: Repository<SellerRatingAggregate>,
    private readonly realtime: RealtimeService,
    private readonly push: PushService,
  ) {}

  assertSellerRole(role: UserRole): void {
    if (role !== UserRole.SELLER) {
      throw new ApiException(
        'seller_required',
        'Only users with the seller role can submit or manage offers.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  /** Throws if the other party started the opposite deal action (complete vs cancel). */
  assertNoConflictingDealIntent(offer: Offer, intent: 'complete' | 'cancel'): void {
    const hasComplete = Boolean(
      offer.buyerDealCompleteAt || offer.sellerDealCompleteAt,
    );
    const hasCancel = Boolean(offer.buyerDealCancelAt || offer.sellerDealCancelAt);
    if (intent === 'complete' && hasCancel) {
      throw new ApiException(
        'deal_action_conflict',
        'A cancellation is in progress for this deal.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (intent === 'cancel' && hasComplete) {
      throw new ApiException(
        'deal_action_conflict',
        'A completion confirmation is in progress for this deal.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async finishMutualCancel(
    em: EntityManager,
    req: PartRequest,
    offer: Offer,
  ): Promise<void> {
    req.activeAcceptanceOffer = null;
    offer.interactionState = OfferInteractionState.MUTUALLY_CANCELLED;
    offer.buyerDealCompleteAt = null;
    offer.sellerDealCompleteAt = null;
    await em.save(offer);
    await em.save(req);
  }

  async countStuckOffersForSeller(sellerId: string): Promise<number> {
    return this.offers
      .createQueryBuilder('o')
      .where('o.seller_id = :sid', { sid: sellerId })
      .andWhere(
        '(o.interaction_state = :contact OR (o.interaction_state = :cancelled AND o.seller_acknowledged_at IS NULL))',
        {
          contact: OfferInteractionState.CONTACT_REVEALED,
          cancelled: OfferInteractionState.BUYER_CANCELLED,
        },
      )
      .getCount();
  }

  /** After buyer completes purchase: mark losers superseded, winner completed. */
  async finalizeOffersAfterDeal(
    em: EntityManager,
    requestId: string,
    chosenOfferId: string,
  ): Promise<void> {
    await em
      .createQueryBuilder()
      .update(Offer)
      .set({ interactionState: OfferInteractionState.SUPERSEDED })
      .where('request_id = :rid', { rid: requestId })
      .andWhere('id != :cid', { cid: chosenOfferId })
      .execute();

    await em.update(
      Offer,
      { id: chosenOfferId },
      { interactionState: OfferInteractionState.DEAL_COMPLETED },
    );
  }

  async acknowledgeBuyerCancellation(
    sellerId: string,
    offerId: string,
    role: UserRole,
  ): Promise<{ ok: true }> {
    this.assertSellerRole(role);
    const offer = await this.offers.findOne({
      where: { id: offerId, seller: { id: sellerId } },
      relations: { request: true },
    });
    if (!offer) {
      throw new ApiException('not_found', 'Offer not found.', HttpStatus.NOT_FOUND);
    }
    if (offer.interactionState !== OfferInteractionState.BUYER_CANCELLED) {
      throw new ApiException(
        'bad_request',
        'Nothing to acknowledge for this offer.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (offer.sellerAcknowledgedAt) {
      return { ok: true };
    }
    offer.sellerAcknowledgedAt = new Date();
    await this.offers.save(offer);
    return { ok: true };
  }

  async acceptOfferByBuyer(
    requestId: string,
    authorId: string,
    offerId: string,
  ): Promise<void> {
    let notifySellerId: string | null = null;
    await this.dataSource.transaction(async (em) => {
      const req = await em.findOne(PartRequest, {
        where: { id: requestId, author: { id: authorId } },
        relations: { author: true, activeAcceptanceOffer: true },
      });
      if (!req) {
        throw new ApiException('not_found', 'Request not found.', HttpStatus.NOT_FOUND);
      }
      if (req.status !== PartRequestStatus.OPEN) {
        throw new ApiException(
          'bad_request',
          'Request is not open.',
          HttpStatus.BAD_REQUEST,
        );
      }
      const aid = req.activeAcceptanceOffer?.id ?? null;
      if (aid === offerId) {
        return;
      }
      if (aid) {
        throw new ApiException(
          'offer_acceptance_active',
          'You already accepted an offer. Finish or cancel it before accepting another.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const offer = await em.findOne(Offer, {
        where: { id: offerId, request: { id: requestId } },
        relations: { seller: true },
      });
      if (!offer || offer.moderationState !== ModerationState.VISIBLE) {
        throw new ApiException('not_found', 'Offer not found.', HttpStatus.NOT_FOUND);
      }

      offer.interactionState = OfferInteractionState.CONTACT_REVEALED;
      offer.buyerAcceptedAt = new Date();
      offer.buyerDealCompleteAt = null;
      offer.sellerDealCompleteAt = null;
      offer.buyerDealCancelAt = null;
      offer.sellerDealCancelAt = null;
      offer.buyerDealCancelReason = null;
      offer.sellerDealCancelReason = null;
      await em.save(offer);

      req.activeAcceptanceOffer = offer;
      await em.save(req);
      notifySellerId = offer.seller.id;
    });
    if (notifySellerId) {
      void this.push.sendToUserIds([notifySellerId], {
        title: 'Offer accepted',
        body: 'A buyer accepted your offer. Open the request to complete or cancel the deal.',
        data: { request_id: requestId, offer_id: offerId },
      });
    }
  }

  async cancelAcceptedOfferByBuyer(
    requestId: string,
    authorId: string,
    cancelReason: string,
  ): Promise<void> {
    const reason = cancelReason.trim();
    if (!reason) {
      throw new ApiException(
        'bad_request',
        'cancel_reason is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const notifySellerRef: {
      current: { sellerId: string; offerId: string } | null;
    } = { current: null };

    await this.dataSource.transaction(async (em) => {
      const req = await em.findOne(PartRequest, {
        where: { id: requestId, author: { id: authorId } },
        relations: { activeAcceptanceOffer: true },
      });
      if (!req) {
        throw new ApiException('not_found', 'Request not found.', HttpStatus.NOT_FOUND);
      }
      const aid = req.activeAcceptanceOffer?.id;
      if (!aid) {
        throw new ApiException(
          'bad_request',
          'No accepted offer to cancel.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const offer = await em.findOne(Offer, {
        where: { id: aid, request: { id: requestId } },
        relations: { seller: true },
      });
      if (!offer) {
        throw new ApiException('not_found', 'Offer not found.', HttpStatus.NOT_FOUND);
      }

      if (offer.interactionState !== OfferInteractionState.CONTACT_REVEALED) {
        throw new ApiException(
          'bad_request',
          'This deal cannot be cancelled this way.',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.assertNoConflictingDealIntent(offer, 'cancel');

      if (offer.buyerDealCancelAt) {
        return;
      }

      offer.buyerDealCancelReason = reason;
      offer.buyerDealCancelAt = new Date();
      await em.save(offer);

      const fresh = await em.findOne(Offer, {
        where: { id: offer.id },
        relations: { seller: true },
      });
      if (!fresh) {
        return;
      }
      if (fresh.sellerDealCancelAt) {
        await this.finishMutualCancel(em, req, fresh);
      } else {
        notifySellerRef.current = {
          sellerId: fresh.seller.id,
          offerId: fresh.id,
        };
      }
    });

    const ns = notifySellerRef.current;
    if (ns) {
      void this.push.sendToUserIds([ns.sellerId], {
        title: 'Deal update',
        body: 'The buyer proposed to cancel. Submit your cancel reason to finish.',
        data: { request_id: requestId, offer_id: ns.offerId },
      });
    }
  }

  async cancelAcceptedOfferBySeller(
    sellerId: string,
    offerId: string,
    role: UserRole,
    cancelReason: string,
  ): Promise<void> {
    this.assertSellerRole(role);
    const reason = cancelReason.trim();
    if (!reason) {
      throw new ApiException(
        'bad_request',
        'cancel_reason is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const notifyBuyerRef: {
      current: { buyerId: string; requestId: string; offerId: string } | null;
    } = { current: null };

    await this.dataSource.transaction(async (em) => {
      const offer = await em.findOne(Offer, {
        where: { id: offerId, seller: { id: sellerId } },
        relations: { seller: true, request: { author: true } },
      });
      if (!offer) {
        throw new ApiException('not_found', 'Offer not found.', HttpStatus.NOT_FOUND);
      }

      const req = await em.findOne(PartRequest, {
        where: { id: offer.request.id },
        relations: { activeAcceptanceOffer: true, author: true },
      });
      if (!req || req.activeAcceptanceOffer?.id !== offerId) {
        throw new ApiException(
          'bad_request',
          'No active accepted deal for this offer.',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (offer.interactionState !== OfferInteractionState.CONTACT_REVEALED) {
        throw new ApiException(
          'bad_request',
          'This deal cannot be cancelled this way.',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.assertNoConflictingDealIntent(offer, 'cancel');

      if (offer.sellerDealCancelAt) {
        return;
      }

      offer.sellerDealCancelReason = reason;
      offer.sellerDealCancelAt = new Date();
      await em.save(offer);

      const fresh = await em.findOne(Offer, { where: { id: offer.id } });
      if (!fresh) {
        return;
      }
      if (fresh.buyerDealCancelAt) {
        await this.finishMutualCancel(em, req, fresh);
      } else {
        notifyBuyerRef.current = {
          buyerId: req.author.id,
          requestId: req.id,
          offerId: fresh.id,
        };
      }
    });

    const nb = notifyBuyerRef.current;
    if (nb) {
      void this.push.sendToUserIds([nb.buyerId], {
        title: 'Deal update',
        body: 'The seller proposed to cancel. Submit your cancel reason to finish.',
        data: {
          request_id: nb.requestId,
          offer_id: nb.offerId,
        },
      });
    }
  }

  async assertOfferVisibleToSeller(req: PartRequest): Promise<void> {
    if (req.status !== PartRequestStatus.OPEN) {
      throw new ApiException(
        'request_not_open',
        'Request is not open.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (req.moderationState !== ModerationState.VISIBLE) {
      throw new ApiException('not_found', 'Request not found.', HttpStatus.NOT_FOUND);
    }
  }

  async create(
    requestId: string,
    sellerId: string,
    role: UserRole,
    dto: CreateOfferDto,
  ): Promise<ReturnType<OffersService['serializeOffer']>> {
    this.assertSellerRole(role);
    const req = await this.requests.findOne({
      where: { id: requestId },
      relations: { author: true },
    });
    if (!req) {
      throw new ApiException('not_found', 'Request not found.', HttpStatus.NOT_FOUND);
    }
    await this.assertOfferVisibleToSeller(req);
    if (req.author.id === sellerId) {
      throw new ApiException(
        'offer_own_request',
        'You cannot submit an offer on your own request.',
        HttpStatus.FORBIDDEN,
      );
    }

    const existingForSeller = await this.offers.findOne({
      where: {
        request: { id: requestId },
        seller: { id: sellerId },
      },
      relations: { request: { author: true }, photos: true, seller: true },
    });
    if (existingForSeller) {
      if (
        existingForSeller.interactionState ===
        OfferInteractionState.MUTUALLY_CANCELLED
      ) {
        return this.reviseOfferAfterMutualCancel(
          existingForSeller,
          dto,
          sellerId,
        );
      }
      throw new ApiException(
        'offer_duplicate',
        'You already submitted an offer for this request.',
        HttpStatus.CONFLICT,
      );
    }

    const stuck = await this.countStuckOffersForSeller(sellerId);
    if (stuck >= STUCK_OFFER_LIMIT) {
      throw new ApiException(
        'seller_stuck_offers_limit',
        `You have ${STUCK_OFFER_LIMIT} or more open offers awaiting resolution. Resolve them before adding new offers.`,
        HttpStatus.FORBIDDEN,
      );
    }

    const currency = (dto.price_currency ?? 'AMD').toUpperCase().slice(0, 3);
    const offer = this.offers.create({
      request: req,
      seller: { id: sellerId } as User,
      priceAmount: dto.price_amount.toFixed(2),
      priceCurrency: currency,
      condition: dto.condition,
      delivery: dto.delivery,
      description: dto.description,
      moderationState: ModerationState.VISIBLE,
      interactionState: OfferInteractionState.NONE,
    });

    let saved: Offer;
    try {
      saved = await this.offers.save(offer);
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === '23505') {
        throw new ApiException(
          'offer_duplicate',
          'You already submitted an offer for this request.',
          HttpStatus.CONFLICT,
        );
      }
      throw e;
    }

    if (dto.photo_storage_keys?.length) {
      await this.offerPhotos.save(
        dto.photo_storage_keys.map((storage_key, i) =>
          this.offerPhotos.create({
            offer: saved,
            storageKey: storage_key,
            sortOrder: i,
          }),
        ),
      );
    }

    return this.afterNewOfferSaved(saved, requestId, sellerId, req.author.id, 'created');
  }

  private async reviseOfferAfterMutualCancel(
    existing: Offer,
    dto: CreateOfferDto,
    sellerId: string,
  ): Promise<ReturnType<OffersService['serializeOffer']>> {
    const req = existing.request;
    await this.assertOfferVisibleToSeller(req);
    if (req.author.id === sellerId) {
      throw new ApiException(
        'offer_own_request',
        'You cannot submit an offer on your own request.',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.offerPhotos.delete({ offer: { id: existing.id } });

    existing.priceAmount = dto.price_amount.toFixed(2);
    existing.priceCurrency = (dto.price_currency ?? 'AMD').toUpperCase().slice(0, 3);
    existing.condition = dto.condition;
    existing.delivery = dto.delivery;
    existing.description = dto.description;
    existing.moderationState = ModerationState.VISIBLE;
    existing.interactionState = OfferInteractionState.NONE;
    existing.buyerAcceptedAt = null;
    existing.buyerCancelReason = null;
    existing.buyerCancelledAt = null;
    existing.sellerAcknowledgedAt = null;
    existing.buyerDealCompleteAt = null;
    existing.sellerDealCompleteAt = null;
    existing.buyerDealCancelReason = null;
    existing.buyerDealCancelAt = null;
    existing.sellerDealCancelReason = null;
    existing.sellerDealCancelAt = null;

    const saved = await this.offers.save(existing);

    if (dto.photo_storage_keys?.length) {
      await this.offerPhotos.save(
        dto.photo_storage_keys.map((storage_key, i) =>
          this.offerPhotos.create({
            offer: saved,
            storageKey: storage_key,
            sortOrder: i,
          }),
        ),
      );
    }

    return this.afterNewOfferSaved(saved, req.id, sellerId, req.author.id, 'updated');
  }

  private async afterNewOfferSaved(
    saved: Offer,
    requestId: string,
    sellerId: string,
    authorId: string,
    event: 'created' | 'updated',
  ): Promise<ReturnType<OffersService['serializeOffer']>> {
    const full = await this.loadOfferWithPhotos(saved.id);
    const evt = event === 'created' ? 'offer.created' : 'offer.updated';
    this.realtime.emit(evt, {
      request_id: requestId,
      offer_id: saved.id,
    });
    this.realtime.emitToRequestRoom(requestId, evt, {
      request_id: requestId,
      offer_id: saved.id,
    });

    void this.push.sendToUserIds([authorId], {
      title: event === 'created' ? 'New offer' : 'Offer updated',
      body:
        event === 'created'
          ? 'A seller submitted an offer on your request.'
          : 'A seller updated their offer on your request.',
      data: {
        type: event === 'created' ? 'offer.created' : 'offer.updated',
        request_id: requestId,
        offer_id: saved.id,
      },
    });

    const agMap = await this.loadAggregates([sellerId]);
    return this.serializeOffer(full!, sellerId, agMap, requestId);
  }

  async listForAuthor(
    requestId: string,
    authorId: string,
    includeHidden: boolean,
  ) {
    const req = await this.requests.findOne({
      where: { id: requestId, author: { id: authorId } },
      relations: { activeAcceptanceOffer: true },
    });
    if (!req) {
      throw new ApiException('not_found', 'Request not found.', HttpStatus.NOT_FOUND);
    }

    const selection = await this.selections.findOne({
      where: { requestId },
    });

    const authorMask: AuthorOfferListMask = {
      activeAcceptanceOfferId: req.activeAcceptanceOffer?.id ?? null,
      chosenOfferId: selection?.chosenOfferId ?? null,
      requestStatus: req.status,
    };

    const qb = this.offers
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.seller', 'seller')
      .leftJoinAndSelect('o.photos', 'photos')
      .where('o.request_id = :rid', { rid: requestId })
      .andWhere('o.moderation_state = :vis', {
        vis: ModerationState.VISIBLE,
      })
      .orderBy('o.createdAt', 'ASC');

    if (selection && !includeHidden) {
      qb.andWhere('o.id = :cid', { cid: selection.chosenOfferId });
    }

    const list = await qb.getMany();

    const sellerIds = [...new Set(list.map((o) => o.seller.id))];
    const agMap = await this.loadAggregates(sellerIds);

    return list.map((o) =>
      this.serializeOffer(o, authorId, agMap, requestId, authorMask),
    );
  }

  private async loadAggregates(
    sellerIds: string[],
  ): Promise<Map<string, SellerRatingAggregate>> {
    const map = new Map<string, SellerRatingAggregate>();
    if (!sellerIds.length) return map;
    const rows = await this.aggregates
      .createQueryBuilder('a')
      .where('a.seller_id IN (:...ids)', { ids: sellerIds })
      .getMany();
    for (const a of rows) map.set(a.sellerId, a);
    return map;
  }

  async patch(
    sellerId: string,
    offerId: string,
    role: UserRole,
    dto: PatchOfferDto,
  ) {
    this.assertSellerRole(role);
    const offer = await this.offers.findOne({
      where: { id: offerId, seller: { id: sellerId } },
      relations: { request: { author: true, activeAcceptanceOffer: true }, photos: true },
    });
    if (!offer) {
      throw new ApiException('not_found', 'Offer not found.', HttpStatus.NOT_FOUND);
    }
    if (offer.request.activeAcceptanceOffer?.id === offer.id) {
      throw new ApiException(
        'bad_request',
        'You cannot edit an offer while the buyer has an active deal with it.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (offer.request.status !== PartRequestStatus.OPEN) {
      throw new ApiException(
        'request_not_open',
        'Request is no longer open.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.price_amount !== undefined)
      offer.priceAmount = dto.price_amount.toFixed(2);
    if (dto.price_currency !== undefined)
      offer.priceCurrency = dto.price_currency.toUpperCase().slice(0, 3);
    if (dto.condition !== undefined) offer.condition = dto.condition;
    if (dto.delivery !== undefined) offer.delivery = dto.delivery;
    if (dto.description !== undefined) offer.description = dto.description;

    await this.offers.save(offer);

    if (dto.photo_storage_keys !== undefined) {
      await this.offerPhotos.delete({ offer: { id: offer.id } });
      if (dto.photo_storage_keys.length) {
        await this.offerPhotos.save(
          dto.photo_storage_keys.map((storage_key, i) =>
            this.offerPhotos.create({
              offer,
              storageKey: storage_key,
              sortOrder: i,
            }),
          ),
        );
      }
    }

    const full = await this.loadOfferWithPhotos(offer.id);
    this.realtime.emit('offer.updated', {
      request_id: offer.request.id,
      offer_id: offer.id,
    });
    this.realtime.emitToRequestRoom(offer.request.id, 'offer.updated', {
      request_id: offer.request.id,
      offer_id: offer.id,
    });

    const agMap = await this.loadAggregates([offer.seller.id]);
    return this.serializeOffer(
      full!,
      sellerId,
      agMap,
      offer.request.id,
    );
  }

  async softDelete(
    sellerId: string,
    offerId: string,
    role: UserRole,
  ): Promise<void> {
    this.assertSellerRole(role);
    const offer = await this.offers.findOne({
      where: { id: offerId, seller: { id: sellerId } },
      relations: { request: true },
    });
    if (!offer) {
      throw new ApiException('not_found', 'Offer not found.', HttpStatus.NOT_FOUND);
    }
    offer.moderationState = ModerationState.HIDDEN;
    await this.offers.save(offer);
  }

  private async loadOfferWithPhotos(id: string): Promise<Offer | null> {
    return this.offers.findOne({
      where: { id },
      relations: { seller: true, photos: true, request: true },
    });
  }

  serializeOffer(
    o: Offer,
    _viewerUserId: string,
    agMap?: Map<string, SellerRatingAggregate>,
    requestIdFallback?: string,
    authorMask?: AuthorOfferListMask,
  ) {
    const agg = agMap?.get(o.seller.id) ?? null;
    const rid = o.request?.id ?? requestIdFallback;
    let contactVisible = true;
    if (authorMask) {
      contactVisible =
        authorMask.activeAcceptanceOfferId === o.id ||
        (authorMask.requestStatus === PartRequestStatus.CLOSED &&
          authorMask.chosenOfferId === o.id);
    }
    return {
      id: o.id,
      request_id: rid,
      seller_id: o.seller.id,
      price_amount: o.priceAmount,
      price_currency: o.priceCurrency,
      condition: o.condition,
      delivery: o.delivery,
      description: o.description,
      moderation_state: o.moderationState,
      created_at: o.createdAt.toISOString(),
      photos: (o.photos ?? []).map((p) => ({
        id: p.id,
        storage_key: p.storageKey,
        sort_order: p.sortOrder,
      })),
      seller: {
        id: o.seller.id,
        display_name: contactVisible ? o.seller.displayName : null,
        rating_avg: agg ? Number(agg.avgScore) : null,
        rating_count: agg ? agg.ratingCount : 0,
      },
      seller_identity_hidden: Boolean(authorMask && !contactVisible),
    };
  }

  async getVisibleByIdForSeller(offerId: string, sellerView: boolean): Promise<Offer | null> {
    const o = await this.offers.findOne({
      where: { id: offerId },
      relations: { request: true, seller: true, photos: true },
    });
    if (!o) return null;
    if (o.moderationState === ModerationState.HIDDEN && !sellerView) return null;
    return o;
  }

  /** Seller's own offer on an open request (for GET /requests/:id/public). */
  async getSellerOfferOnRequest(
    requestId: string,
    sellerId: string,
  ): Promise<
    | (ReturnType<OffersService['serializeOffer']> & {
        buyer_cancel_pending_ack: boolean;
        deal_active: boolean;
        buyer_marked_complete: boolean;
        seller_marked_complete: boolean;
        buyer_marked_cancel: boolean;
        seller_marked_cancel: boolean;
      })
    | null
  > {
    const o = await this.offers.findOne({
      where: {
        request: { id: requestId },
        seller: { id: sellerId },
        moderationState: ModerationState.VISIBLE,
      },
      relations: { seller: true, photos: true, request: true },
    });
    if (!o) return null;

    const partReq = await this.requests.findOne({
      where: { id: requestId },
      relations: { activeAcceptanceOffer: true },
    });
    const activeId = partReq?.activeAcceptanceOffer?.id ?? null;
    const deal_active =
      activeId === o.id &&
      o.interactionState === OfferInteractionState.CONTACT_REVEALED;

    const agMap = await this.loadAggregates([sellerId]);
    const base = this.serializeOffer(o, sellerId, agMap, requestId);
    return {
      ...base,
      buyer_cancel_pending_ack:
        o.interactionState === OfferInteractionState.BUYER_CANCELLED &&
        !o.sellerAcknowledgedAt,
      deal_active,
      buyer_marked_complete: Boolean(o.buyerDealCompleteAt),
      seller_marked_complete: Boolean(o.sellerDealCompleteAt),
      buyer_marked_cancel: Boolean(o.buyerDealCancelAt),
      seller_marked_cancel: Boolean(o.sellerDealCancelAt),
    };
  }
}
