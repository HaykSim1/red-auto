import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import { decodeCursor, encodeCursor } from '../common/utils/cursor-pagination';
import { PartRequest } from '../database/entities/part-request.entity';
import { RequestPhoto } from '../database/entities/request-photo.entity';
import { Vehicle } from '../database/entities/vehicle.entity';
import {
  ModerationState,
  PartRequestStatus,
  UserRole,
} from '../database/enums';
import { MineListScope } from './dto/mine-query.dto';
import { OffersService } from '../offers/offers.service';
import { PushService } from '../push/push.service';
import { RealtimeService } from '../realtime/realtime.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { AddRequestPhotosDto } from './dto/add-request-photos.dto';
import { CreateRequestDto } from './dto/create-request.dto';
import { PatchRequestDto } from './dto/patch-request.dto';

const DEFAULT_LIMIT = 20;

function assertSellerFeedAccess(role: UserRole): void {
  if (role === UserRole.USER) {
    throw new ApiException(
      'seller_feed_required',
      'Seller or admin access is required to browse open requests.',
      HttpStatus.FORBIDDEN,
    );
  }
}

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(PartRequest)
    private readonly requests: Repository<PartRequest>,
    @InjectRepository(RequestPhoto)
    private readonly photos: Repository<RequestPhoto>,
    private readonly vehicles: VehiclesService,
    private readonly offers: OffersService,
    private readonly realtime: RealtimeService,
    private readonly push: PushService,
  ) {}

  async listMine(
    userId: string,
    limit = DEFAULT_LIMIT,
    cursor?: string,
    scope: MineListScope = MineListScope.ACTIVE,
  ): Promise<{
    items: ReturnType<RequestsService['serializeListItem']>[];
    next_cursor: string | null;
  }> {
    const take = Math.min(Math.max(limit, 1), 100);
    const qb = this.requests
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.vehicle', 'vehicle')
      .leftJoinAndSelect('r.photos', 'photos')
      .where('r.author_id = :uid', { uid: userId })
      .orderBy('r.createdAt', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .take(take + 1);

    if (scope === MineListScope.HISTORY) {
      qb.andWhere('r.status IN (:...hist)', {
        hist: [PartRequestStatus.CLOSED, PartRequestStatus.CANCELLED],
      });
    } else {
      qb.andWhere('r.status = :open', { open: PartRequestStatus.OPEN });
    }

    if (cursor) {
      const p = decodeCursor(cursor);
      if (p) {
        qb.andWhere(
          '(r.created_at < :ct OR (r.created_at = :ct AND r.id < :cid))',
          { ct: new Date(p.t), cid: p.id },
        );
      }
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const last = page[page.length - 1];
    const next_cursor =
      hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

    const ids = page.map((r) => r.id);
    const offerCounts = await this.offers.countVisibleOffersByRequestIds(ids);

    return {
      items: page.map((r) => this.serializeListItem(r, offerCounts[r.id] ?? 0)),
      next_cursor,
    };
  }

  async mineOfferStats(
    userId: string,
  ): Promise<{ total_offer_count: number }> {
    const total_offer_count =
      await this.offers.countVisibleOffersForUserOpenRequests(userId);
    return { total_offer_count };
  }

  async listOpen(
    userId: string,
    role: UserRole,
    limit = DEFAULT_LIMIT,
    cursor?: string,
  ): Promise<{
    items: ReturnType<RequestsService['serializePublic']>[];
    next_cursor: string | null;
  }> {
    assertSellerFeedAccess(role);
    const take = Math.min(Math.max(limit, 1), 100);
    const qb = this.requests
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.author', 'author')
      .leftJoinAndSelect('r.vehicle', 'vehicle')
      .leftJoinAndSelect('r.photos', 'photos')
      .where('r.status = :st', { st: PartRequestStatus.OPEN })
      .andWhere('r.moderation_state = :ms', {
        ms: ModerationState.VISIBLE,
      })
      .andWhere('r.region = :rg', { rg: 'AM' })
      .andWhere('r.author_id != :uid', { uid: userId })
      .orderBy('r.createdAt', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .take(take + 1);

    if (cursor) {
      const p = decodeCursor(cursor);
      if (p) {
        qb.andWhere(
          '(r.created_at < :ct OR (r.created_at = :ct AND r.id < :cid))',
          { ct: new Date(p.t), cid: p.id },
        );
      }
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const last = page[page.length - 1];
    const next_cursor =
      hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

    const ids = page.map((r) => r.id);
    const offerCounts = await this.offers.countVisibleOffersByRequestIds(ids);

    return {
      items: page.map((r) =>
        this.serializePublic(r, offerCounts[r.id] ?? 0, 'seller'),
      ),
      next_cursor,
    };
  }

  async create(userId: string, dto: CreateRequestDto) {
    if (dto.vehicle_id) {
      await this.vehicles.assertOwnerVehicle(userId, dto.vehicle_id);
    }

    const r = this.requests.create({
      author: { id: userId },
      vehicle: dto.vehicle_id ? ({ id: dto.vehicle_id } as Vehicle) : null,
      description: dto.description.trim(),
      vinText: dto.vin_text?.trim() ?? null,
      partNumber: dto.part_number?.trim() ?? null,
      region: 'AM',
      status: PartRequestStatus.OPEN,
      moderationState: ModerationState.VISIBLE,
    });
    const saved = await this.requests.save(r);

    if (dto.photo_storage_keys?.length) {
      await this.photos.save(
        dto.photo_storage_keys.map((storage_key, i) =>
          this.photos.create({
            request: saved,
            storageKey: storage_key,
            sortOrder: i,
          }),
        ),
      );
    }

    const full = await this.loadWithPhotosAndVehicle(saved.id);

    this.realtime.emit('request.created', {
      request_id: saved.id,
      region: saved.region,
    });

    void this.push.broadcastNewRequest(userId, {
      request_id: saved.id,
      region: saved.region,
    });

    return this.serializeAuthorDetail(full!, userId, false);
  }

  async getAuthorDetail(
    id: string,
    userId: string,
    includeHiddenOffers: boolean,
  ) {
    const r = await this.loadWithPhotosAndVehicle(id);
    if (!r || r.author.id !== userId) {
      throw new ApiException(
        'not_found',
        'Request not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.serializeAuthorDetail(r, userId, includeHiddenOffers);
  }

  async getPublicForSeller(id: string, userId: string, role: UserRole) {
    assertSellerFeedAccess(role);
    const r = await this.loadWithPhotosAndVehicle(id);
    if (!r) {
      throw new ApiException(
        'not_found',
        'Request not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    const openAndVisible =
      r.status === PartRequestStatus.OPEN &&
      r.moderationState === ModerationState.VISIBLE;
    if (!openAndVisible) {
      const historyAccess = await this.offers.sellerHasHistoryAccessToRequest(
        r.id,
        userId,
      );
      if (!historyAccess) {
        throw new ApiException(
          'not_found',
          'Request not found.',
          HttpStatus.NOT_FOUND,
        );
      }
    }
    const [offerCounts, my_offers] = await Promise.all([
      this.offers.countVisibleOffersByRequestIds([r.id]),
      this.offers.getSellerOffersOnRequest(id, userId),
    ]);
    const base = this.serializePublic(r, offerCounts[r.id] ?? 0, 'seller');
    return { ...base, my_offers };
  }

  async patchAuthor(id: string, userId: string, dto: PatchRequestDto) {
    const r = await this.requests.findOne({
      where: { id, author: { id: userId } },
      relations: {
        author: true,
        vehicle: true,
        photos: true,
        activeAcceptanceOffer: true,
      },
    });
    if (!r) {
      throw new ApiException(
        'not_found',
        'Request not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (dto.status === PartRequestStatus.CANCELLED) {
      if (r.status !== PartRequestStatus.OPEN) {
        throw new ApiException(
          'bad_request',
          'Only open requests can be cancelled.',
          HttpStatus.BAD_REQUEST,
        );
      }
      r.status = PartRequestStatus.CANCELLED;
      r.activeAcceptanceOffer = null;
    } else if (dto.status != null && dto.status !== r.status) {
      throw new ApiException(
        'bad_request',
        'Cannot change status except to cancelled.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (r.status === PartRequestStatus.OPEN) {
      if (dto.description !== undefined) r.description = dto.description.trim();
      if (dto.vin_text !== undefined) r.vinText = dto.vin_text?.trim() ?? null;
      if (dto.part_number !== undefined)
        r.partNumber = dto.part_number?.trim() ?? null;
    } else if (
      dto.description !== undefined ||
      dto.vin_text !== undefined ||
      dto.part_number !== undefined
    ) {
      throw new ApiException(
        'bad_request',
        'Can only edit description fields while request is open.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.requests.save(r);
    const full = await this.loadWithPhotosAndVehicle(id);
    return this.serializeAuthorDetail(full!, userId, false);
  }

  async addPhotos(
    id: string,
    userId: string,
    dto: AddRequestPhotosDto,
  ): Promise<{ ok: true }> {
    const r = await this.requests.findOne({
      where: { id, author: { id: userId } },
      relations: { photos: true },
    });
    if (!r) {
      throw new ApiException(
        'not_found',
        'Request not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (r.status !== PartRequestStatus.OPEN) {
      throw new ApiException(
        'bad_request',
        'Request is not open.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const start = r.photos?.length ?? 0;
    await this.photos.save(
      dto.photo_storage_keys.map((storage_key, i) =>
        this.photos.create({
          request: r,
          storageKey: storage_key,
          sortOrder: start + i,
        }),
      ),
    );
    return { ok: true };
  }

  private async loadWithPhotosAndVehicle(
    id: string,
  ): Promise<PartRequest | null> {
    return this.requests.findOne({
      where: { id },
      relations: {
        author: true,
        vehicle: true,
        photos: true,
        activeAcceptanceOffer: true,
      },
    });
  }

  private coverStorageKey(r: PartRequest): string | null {
    const ph = [...(r.photos ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    return ph[0]?.storageKey ?? null;
  }

  private serializeListItem(r: PartRequest, offersCount: number) {
    const photoCount = (r.photos ?? []).length;
    return {
      id: r.id,
      description: r.description,
      status: r.status,
      region: r.region,
      moderation_state: r.moderationState,
      created_at: r.createdAt.toISOString(),
      cover_storage_key: this.coverStorageKey(r),
      vehicle: r.vehicle ? this.serializeVehicle(r.vehicle) : null,
      photo_count: photoCount,
      offers_count: offersCount,
    };
  }

  serializePublic(
    r: PartRequest,
    offersCount = 0,
    audience: 'seller' | 'buyer' = 'buyer',
  ) {
    const ph = [...(r.photos ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      id: r.id,
      description: r.description,
      vin_text: r.vinText,
      part_number: r.partNumber,
      status: r.status,
      region: r.region,
      created_at: r.createdAt.toISOString(),
      cover_storage_key: ph[0]?.storageKey ?? null,
      vehicle: r.vehicle ? this.serializeVehicle(r.vehicle) : null,
      photos: ph.map((p) => ({
        id: p.id,
        storage_key: p.storageKey,
        sort_order: p.sortOrder,
      })),
      photo_count: ph.length,
      offers_count: offersCount,
      ...(audience === 'seller' && r.author
        ? { buyer_is_special: Boolean(r.author.isSpecialBuyer) }
        : {}),
    };
  }

  private async serializeAuthorDetail(
    r: PartRequest,
    userId: string,
    includeHiddenOffers: boolean,
  ) {
    const [offerCounts, offers] = await Promise.all([
      this.offers.countVisibleOffersByRequestIds([r.id]),
      this.offers.listForAuthor(r.id, userId, includeHiddenOffers),
    ]);
    return {
      ...this.serializePublic(r, offerCounts[r.id] ?? 0, 'buyer'),
      active_acceptance_offer_id: r.activeAcceptanceOffer?.id ?? null,
      offers,
    };
  }

  private serializeVehicle(v: Vehicle) {
    return {
      id: v.id,
      brand: v.brand,
      model: v.model,
      year: v.year,
      engine: v.engine,
      vin: v.vin,
      label: v.label,
    };
  }
}
