import { HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import { Offer } from '../database/entities/offer.entity';
import { PartRequest } from '../database/entities/part-request.entity';
import { Selection } from '../database/entities/selection.entity';
import { User } from '../database/entities/user.entity';
import {
  ModerationState,
  OfferInteractionState,
  PartRequestStatus,
  UserRole,
} from '../database/enums';
import { OffersService } from '../offers/offers.service';
import { PushService } from '../push/push.service';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class SelectionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly offers: OffersService,
    private readonly realtime: RealtimeService,
    private readonly push: PushService,
  ) {}

  /** Buyer: mark deal complete; finalizes only when seller has also marked complete. */
  async createOrReplace(requestId: string, authorId: string, offerId: string) {
    return this.dataSource.transaction(async (em) => {
      const req = await em.findOne(PartRequest, {
        where: { id: requestId },
        relations: { author: true, activeAcceptanceOffer: true },
      });
      if (!req || req.author.id !== authorId) {
        throw new ApiException(
          'not_found',
          'Request not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (req.status === PartRequestStatus.CANCELLED) {
        throw new ApiException(
          'bad_request',
          'Request is cancelled.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const existingSel = await em.findOne(Selection, { where: { requestId } });
      if (
        existingSel &&
        existingSel.chosenOfferId === offerId &&
        req.author.id === authorId
      ) {
        return this.buildSelectionResponse(requestId, authorId, em);
      }

      const offer = await em.findOne(Offer, {
        where: { id: offerId, request: { id: requestId } },
        relations: { seller: true },
      });
      if (!offer || offer.moderationState !== ModerationState.VISIBLE) {
        throw new ApiException(
          'not_found',
          'Offer not found.',
          HttpStatus.NOT_FOUND,
        );
      }

      if (req.activeAcceptanceOffer?.id !== offerId) {
        throw new ApiException(
          'must_accept_offer_first',
          'Accept an offer first before completing the purchase.',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (offer.interactionState !== OfferInteractionState.CONTACT_REVEALED) {
        throw new ApiException(
          'bad_request',
          'This offer is not in an active accepted deal.',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.offers.assertNoConflictingDealIntent(offer, 'complete');

      if (!offer.buyerDealCompleteAt) {
        offer.buyerDealCompleteAt = new Date();
        await em.save(offer);
        if (!offer.sellerDealCompleteAt) {
          void this.push.sendToUserIds([offer.seller.id], {
            title: 'Deal update',
            body: 'The buyer marked the deal complete. Confirm on your side to close.',
            data: { request_id: requestId, offer_id: offerId },
          });
        }
      }

      const offerFresh = await em.findOne(Offer, {
        where: { id: offerId },
        relations: { seller: true },
      });
      if (offerFresh?.buyerDealCompleteAt && offerFresh?.sellerDealCompleteAt) {
        await this.finalizeDealAfterMutualComplete(
          em,
          req,
          offerFresh,
          offerId,
          requestId,
        );
      }

      return this.buildSelectionResponse(requestId, authorId, em);
    });
  }

  /** Seller: mark deal complete; finalizes when buyer has also marked complete. */
  async sellerMarkDealComplete(
    sellerId: string,
    offerId: string,
    role: UserRole,
  ): Promise<{ ok: true; finalized: boolean }> {
    this.offers.assertSellerRole(role);
    return this.dataSource.transaction(async (em) => {
      const offer = await em.findOne(Offer, {
        where: { id: offerId, seller: { id: sellerId } },
        relations: { seller: true, request: true },
      });
      if (!offer) {
        throw new ApiException(
          'not_found',
          'Offer not found.',
          HttpStatus.NOT_FOUND,
        );
      }

      const req = await em.findOne(PartRequest, {
        where: { id: offer.request.id },
        relations: { author: true, activeAcceptanceOffer: true },
      });
      if (!req) {
        throw new ApiException(
          'not_found',
          'Request not found.',
          HttpStatus.NOT_FOUND,
        );
      }

      if (req.activeAcceptanceOffer?.id !== offerId) {
        throw new ApiException(
          'bad_request',
          'No active accepted deal for this offer.',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (offer.interactionState !== OfferInteractionState.CONTACT_REVEALED) {
        throw new ApiException(
          'bad_request',
          'This offer is not in an active accepted deal.',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.offers.assertNoConflictingDealIntent(offer, 'complete');

      let finalized = false;
      if (!offer.sellerDealCompleteAt) {
        offer.sellerDealCompleteAt = new Date();
        await em.save(offer);
        if (!offer.buyerDealCompleteAt) {
          void this.push.sendToUserIds([req.author.id], {
            title: 'Deal update',
            body: 'The seller marked the deal complete. Confirm on your side to close.',
            data: { request_id: req.id, offer_id: offerId },
          });
        }
      }

      const offerFresh = await em.findOne(Offer, {
        where: { id: offerId },
        relations: { seller: true },
      });
      if (offerFresh?.buyerDealCompleteAt && offerFresh?.sellerDealCompleteAt) {
        await this.finalizeDealAfterMutualComplete(
          em,
          req,
          offerFresh,
          offerId,
          req.id,
        );
        finalized = true;
      }

      return { ok: true, finalized };
    });
  }

  private async finalizeDealAfterMutualComplete(
    em: EntityManager,
    req: PartRequest,
    offer: Offer,
    offerId: string,
    requestId: string,
  ): Promise<void> {
    const existing = await em.findOne(Selection, { where: { requestId } });

    if (!existing) {
      if (req.status !== PartRequestStatus.OPEN) {
        throw new ApiException(
          'bad_request',
          'Request is not open for selection.',
          HttpStatus.BAD_REQUEST,
        );
      }
      req.status = PartRequestStatus.CLOSED;
      const row = em.create(Selection, {
        requestId,
        chosenOfferId: offerId,
        selectedAt: new Date(),
      });
      await em.save(row);
    } else {
      existing.chosenOfferId = offerId;
      existing.selectedAt = new Date();
      await em.save(existing);
      if (req.status === PartRequestStatus.OPEN) {
        req.status = PartRequestStatus.CLOSED;
      }
    }

    req.activeAcceptanceOffer = null;
    await em.save(req);
    await this.offers.finalizeOffersAfterDeal(em, requestId, offerId);

    const sellerId = offer.seller.id;
    this.realtime.emit('selection.created', {
      request_id: requestId,
      offer_id: offerId,
      seller_id: sellerId,
    });
    this.realtime.emitToRequestRoom(requestId, 'selection.created', {
      request_id: requestId,
      offer_id: offerId,
      seller_id: sellerId,
    });

    void this.push.sendToUserIds([sellerId], {
      title: 'Offer selected',
      body: 'A buyer selected your offer.',
      data: { request_id: requestId, offer_id: offerId },
    });
  }

  async getForAuthor(requestId: string, authorId: string) {
    return this.buildSelectionResponse(
      requestId,
      authorId,
      this.dataSource.manager,
    );
  }

  private async buildSelectionResponse(
    requestId: string,
    authorId: string,
    em: EntityManager,
  ) {
    const req = await em.findOne(PartRequest, {
      where: { id: requestId },
      relations: { author: true, activeAcceptanceOffer: true },
    });
    if (!req || req.author.id !== authorId) {
      throw new ApiException(
        'forbidden',
        'Only the request author can view selection.',
        HttpStatus.FORBIDDEN,
      );
    }

    const sel = await em.findOne(Selection, { where: { requestId } });
    const provisionalOfferId = req.activeAcceptanceOffer?.id;

    if (!sel && provisionalOfferId) {
      const offer = await em.findOne(Offer, {
        where: { id: provisionalOfferId },
        relations: { seller: true },
      });
      if (!offer) {
        throw new ApiException(
          'not_found',
          'No selection yet.',
          HttpStatus.NOT_FOUND,
        );
      }
      const seller = await em.findOne(User, {
        where: { id: offer.seller.id },
      });
      if (!seller) {
        throw new ApiException(
          'not_found',
          'Seller not found.',
          HttpStatus.NOT_FOUND,
        );
      }

      const waitingForComplete = !offer.buyerDealCompleteAt
        ? 'buyer'
        : !offer.sellerDealCompleteAt
          ? 'seller'
          : null;

      let waitingForCancel: 'buyer' | 'seller' | null = null;
      if (offer.buyerDealCancelAt && !offer.sellerDealCancelAt) {
        waitingForCancel = 'seller';
      } else if (offer.sellerDealCancelAt && !offer.buyerDealCancelAt) {
        waitingForCancel = 'buyer';
      }

      return {
        request_id: requestId,
        offer_id: offer.id,
        selected_at:
          offer.buyerAcceptedAt?.toISOString() ?? new Date().toISOString(),
        seller_contact: {
          seller_phone: seller.sellerPhone ?? seller.phone,
          seller_telegram: seller.sellerTelegram,
        },
        provisional: true,
        buyer_marked_complete: Boolean(offer.buyerDealCompleteAt),
        seller_marked_complete: Boolean(offer.sellerDealCompleteAt),
        buyer_marked_cancel: Boolean(offer.buyerDealCancelAt),
        seller_marked_cancel: Boolean(offer.sellerDealCancelAt),
        waiting_for_complete: waitingForComplete,
        waiting_for_cancel: waitingForCancel,
      };
    }

    if (!sel) {
      throw new ApiException(
        'not_found',
        'No selection yet.',
        HttpStatus.NOT_FOUND,
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

    const seller = await em.findOne(User, {
      where: { id: offer.seller.id },
    });
    if (!seller) {
      throw new ApiException(
        'not_found',
        'Seller not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      request_id: requestId,
      offer_id: sel.chosenOfferId,
      selected_at: sel.selectedAt.toISOString(),
      seller_contact: {
        seller_phone: seller.sellerPhone ?? seller.phone,
        seller_telegram: seller.sellerTelegram,
      },
      provisional: false,
      buyer_marked_complete: true,
      seller_marked_complete: true,
      buyer_marked_cancel: false,
      seller_marked_cancel: false,
      waiting_for_complete: null,
      waiting_for_cancel: null,
    };
  }
}
