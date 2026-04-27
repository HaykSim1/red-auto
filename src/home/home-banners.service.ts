import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiException } from '../common/exceptions/api.exception';
import { HomeBanner } from '../database/entities/home-banner.entity';

export const HOME_BANNER_STORAGE_PREFIX = 'home_banners/';

function assertHomeBannerKey(key: string): void {
  if (!key.startsWith(HOME_BANNER_STORAGE_PREFIX)) {
    throw new ApiException(
      'bad_request',
      'storage_key must be under home_banners/',
      HttpStatus.BAD_REQUEST,
    );
  }
}

@Injectable()
export class HomeBannersService {
  constructor(
    @InjectRepository(HomeBanner)
    private readonly repo: Repository<HomeBanner>,
  ) {}

  async listPublic() {
    const rows = await this.repo.find({
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return { items: rows.map((r) => this.serialize(r)) };
  }

  async listAdmin() {
    const rows = await this.repo.find({
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return {
      items: rows.map((r) => ({
        ...this.serialize(r),
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt.toISOString(),
      })),
    };
  }

  async create(body: {
    storage_key: string;
    title: string;
    subtitle?: string | null;
  }) {
    assertHomeBannerKey(body.storage_key);
    const title = (body.title ?? '').trim();
    const subtitle =
      body.subtitle === undefined || body.subtitle === null
        ? null
        : body.subtitle.trim() || null;
    const last = await this.repo.find({
      order: { sortOrder: 'DESC' },
      take: 1,
    });
    const nextOrder = last.length ? last[0].sortOrder + 1 : 0;
    const row = this.repo.create({
      storageKey: body.storage_key.trim(),
      title,
      subtitle,
      sortOrder: nextOrder,
    });
    const saved = await this.repo.save(row);
    return this.serialize(saved);
  }

  async update(
    id: string,
    body: {
      title?: string;
      subtitle?: string | null;
      sort_order?: number;
      storage_key?: string;
    },
  ) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new ApiException(
        'not_found',
        'Banner not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (body.storage_key !== undefined) {
      assertHomeBannerKey(body.storage_key);
      row.storageKey = body.storage_key.trim();
    }
    if (body.title !== undefined) row.title = body.title.trim();
    if (body.subtitle !== undefined) {
      row.subtitle =
        body.subtitle === null || body.subtitle === ''
          ? null
          : String(body.subtitle).trim();
    }
    if (body.sort_order !== undefined) {
      if (!Number.isFinite(body.sort_order)) {
        throw new ApiException(
          'bad_request',
          'Invalid sort_order',
          HttpStatus.BAD_REQUEST,
        );
      }
      row.sortOrder = Math.trunc(body.sort_order);
    }
    const saved = await this.repo.save(row);
    return this.serialize(saved);
  }

  async remove(id: string) {
    const res = await this.repo.delete({ id });
    if (!res.affected) {
      throw new ApiException(
        'not_found',
        'Banner not found',
        HttpStatus.NOT_FOUND,
      );
    }
    return { ok: true as const };
  }

  async reorder(orderedIds: string[]) {
    const allRows = await this.repo.find({ select: ['id'] });
    const allIds = new Set(allRows.map((r) => r.id));
    if (orderedIds.length !== allIds.size) {
      throw new ApiException(
        'bad_request',
        'ordered_ids must list every banner exactly once',
        HttpStatus.BAD_REQUEST,
      );
    }
    const seen = new Set<string>();
    for (const id of orderedIds) {
      if (!allIds.has(id) || seen.has(id)) {
        throw new ApiException(
          'bad_request',
          'ordered_ids must list every banner exactly once',
          HttpStatus.BAD_REQUEST,
        );
      }
      seen.add(id);
    }
    await this.repo.manager.transaction(async (em) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await em.update(HomeBanner, { id: orderedIds[i] }, { sortOrder: i });
      }
    });
    return { ok: true as const };
  }

  private serialize(r: HomeBanner) {
    return {
      id: r.id,
      storage_key: r.storageKey,
      title: r.title,
      subtitle: r.subtitle,
      sort_order: r.sortOrder,
    };
  }
}
