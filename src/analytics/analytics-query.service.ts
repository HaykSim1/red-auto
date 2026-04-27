import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Between } from 'typeorm';
import { AnalyticsMarketplaceDaily } from '../database/entities/analytics-marketplace-daily.entity';

export const ANALYTICS_MAX_RANGE_DAYS = 366;

const OFFER_VISIBLE_SQL = `
  o.moderation_state = 'visible'
  AND o.interaction_state != 'mutually_cancelled'
`;

interface SqlMedianRow {
  med: string | null;
}

interface SqlCountRow {
  c: number;
}

interface SqlRatingAggRow {
  avg_score: number | null;
  n: number;
}

interface SqlSellerTotalsRow {
  distinct_sellers: number;
  offers_created: number;
  wins: number;
}

interface SqlSellerLeaderRow {
  seller_id: string;
  shop_name: string | null;
  phone: string;
  offers_count: number;
  wins: number;
  avg_resp: number | null;
}

export interface AnalyticsDateRange {
  from: Date;
  to: Date;
  fromIso: string;
  toIso: string;
  regionKey: string;
}

@Injectable()
export class AnalyticsQueryService {
  constructor(
    @InjectRepository(AnalyticsMarketplaceDaily)
    private readonly daily: Repository<AnalyticsMarketplaceDaily>,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  private async sql<T extends object>(
    q: string,
    params: unknown[],
  ): Promise<T[]> {
    const raw: unknown = await this.ds.query(q, params);
    return raw as T[];
  }

  parseRange(
    fromRaw?: string,
    toRaw?: string,
    region?: string,
  ): AnalyticsDateRange {
    const to = toRaw ? new Date(toRaw) : new Date();
    const from = fromRaw
      ? new Date(fromRaw)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error('invalid_date');
    }
    if (from.getTime() > to.getTime()) {
      throw new Error('from_after_to');
    }
    const days = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (days > ANALYTICS_MAX_RANGE_DAYS) {
      throw new Error('range_too_large');
    }
    const fromDay = new Date(from);
    fromDay.setUTCHours(0, 0, 0, 0);
    const toDay = new Date(to);
    toDay.setUTCHours(23, 59, 59, 999);
    const regionKey =
      !region || region.trim() === '' || region.toUpperCase() === 'ALL'
        ? 'ALL'
        : region.trim();
    return {
      from: fromDay,
      to: toDay,
      fromIso: fromDay.toISOString(),
      toIso: toDay.toISOString(),
      regionKey,
    };
  }

  private toDateStr(d: Date): string {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  async sumDailyRows(range: AnalyticsDateRange): Promise<{
    requests_created: number;
    offers_created: number;
    requests_with_offer: number;
    requests_with_selection: number;
    sum_sec_to_first_offer: bigint;
    n_sec_to_first_offer: number;
    sum_sec_first_offer_to_selection: bigint;
    n_sec_first_offer_to_selection: number;
    sum_active_sellers: number;
    ratings_submitted: number;
    requests_with_photo: number;
    requests_with_vehicle: number;
    vin_entered_requests: number;
    vehicles_created: number;
    distinct_vehicle_owners: number;
  }> {
    const fromD = this.toDateStr(range.from);
    const toD = this.toDateStr(range.to);
    const rows = await this.daily.find({
      where: {
        bucketDate: Between(fromD, toD),
        region: range.regionKey,
      },
    });
    const z = {
      requests_created: 0,
      offers_created: 0,
      requests_with_offer: 0,
      requests_with_selection: 0,
      sum_sec_to_first_offer: 0n,
      n_sec_to_first_offer: 0,
      sum_sec_first_offer_to_selection: 0n,
      n_sec_first_offer_to_selection: 0,
      sum_active_sellers: 0,
      ratings_submitted: 0,
      requests_with_photo: 0,
      requests_with_vehicle: 0,
      vin_entered_requests: 0,
      vehicles_created: 0,
      distinct_vehicle_owners: 0,
    };
    for (const r of rows) {
      z.requests_created += r.requestsCreated;
      z.offers_created += r.offersCreated;
      z.requests_with_offer += r.requestsWithOffer;
      z.requests_with_selection += r.requestsWithSelection;
      z.sum_sec_to_first_offer += BigInt(r.sumSecToFirstOffer ?? 0);
      z.n_sec_to_first_offer += r.nSecToFirstOffer;
      z.sum_sec_first_offer_to_selection += BigInt(
        r.sumSecFirstOfferToSelection ?? 0,
      );
      z.n_sec_first_offer_to_selection += r.nSecFirstOfferToSelection;
      z.sum_active_sellers += r.activeSellers;
      z.ratings_submitted += r.ratingsSubmitted;
      z.requests_with_photo += r.requestsWithPhoto;
      z.requests_with_vehicle += r.requestsWithVehicle;
      z.vin_entered_requests += r.vinEnteredRequests;
      z.vehicles_created += r.vehiclesCreated;
      z.distinct_vehicle_owners += r.distinctVehicleOwners;
    }
    return z;
  }

  async rangeMediansAndDistinct(range: AnalyticsDateRange): Promise<{
    median_sec_to_first_offer: number | null;
    distinct_sellers_with_offers: number;
    ignored_offers: number;
    avg_seller_rating: number | null;
    ratings_count_all_time_window: number;
  }> {
    const rf = range.regionKey === 'ALL' ? null : range.regionKey;

    const [medRow] = await this.sql<SqlMedianRow>(
      `
      WITH pr_win AS (
        SELECT pr.id, pr.created_at AS req_created
        FROM part_requests pr
        WHERE pr.created_at >= $1 AND pr.created_at <= $2
          AND ($3::text IS NULL OR pr.region = $3)
      ),
      first_off AS (
        SELECT DISTINCT ON (o.request_id) o.request_id, o.created_at AS first_at
        FROM offers o
        INNER JOIN pr_win p ON p.id = o.request_id
        WHERE ${OFFER_VISIBLE_SQL}
        ORDER BY o.request_id, o.created_at ASC
      ),
      deltas AS (
        SELECT EXTRACT(EPOCH FROM (f.first_at - p.req_created))::double precision AS sec
        FROM pr_win p
        INNER JOIN first_off f ON f.request_id = p.id
      )
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY sec) AS med
      FROM deltas
      `,
      [range.from, range.to, rf],
    );

    const [distSel] = await this.sql<SqlCountRow>(
      `
      SELECT COUNT(DISTINCT o.seller_id)::int AS c
      FROM offers o
      INNER JOIN part_requests pr ON pr.id = o.request_id
      WHERE o.created_at >= $1 AND o.created_at <= $2
        AND ($3::text IS NULL OR pr.region = $3)
      `,
      [range.from, range.to, rf],
    );

    const [ignRow] = await this.sql<SqlCountRow>(
      `
      SELECT COUNT(*)::int AS c
      FROM offers o
      INNER JOIN part_requests pr ON pr.id = o.request_id
      INNER JOIN selections s ON s.request_id = pr.id
      WHERE pr.created_at >= $1 AND pr.created_at <= $2
        AND ($3::text IS NULL OR pr.region = $3)
        AND s.chosen_offer_id IS NOT NULL
        AND s.chosen_offer_id <> o.id
        AND ${OFFER_VISIBLE_SQL}
      `,
      [range.from, range.to, rf],
    );

    const [rateRow] = await this.sql<SqlRatingAggRow>(
      `
      SELECT
        AVG(sr.score)::float AS avg_score,
        COUNT(*)::int AS n
      FROM seller_ratings sr
      INNER JOIN part_requests pr ON pr.id = sr.request_id
      WHERE sr.created_at >= $1 AND sr.created_at <= $2
        AND ($3::text IS NULL OR pr.region = $3)
      `,
      [range.from, range.to, rf],
    );

    return {
      median_sec_to_first_offer:
        medRow?.med != null && medRow.med !== '' ? Number(medRow.med) : null,
      distinct_sellers_with_offers: distSel?.c ?? 0,
      ignored_offers: ignRow?.c ?? 0,
      avg_seller_rating:
        rateRow?.avg_score != null && Number.isFinite(rateRow.avg_score)
          ? rateRow.avg_score
          : null,
      ratings_count_all_time_window: rateRow?.n ?? 0,
    };
  }

  async getSummary(range: AnalyticsDateRange) {
    const s = await this.sumDailyRows(range);
    const extra = await this.rangeMediansAndDistinct(range);

    const tr = s.requests_created;
    const toff = s.offers_created;
    const offers_per_request = tr > 0 ? toff / tr : null;
    const requests_with_offers_rate =
      tr > 0 ? s.requests_with_offer / tr : null;
    const requests_without_offers_rate =
      tr > 0 ? 1 - s.requests_with_offer / tr : null;
    const request_to_selection_rate =
      tr > 0 ? s.requests_with_selection / tr : null;

    const avg_time_to_first_offer_sec =
      s.n_sec_to_first_offer > 0
        ? Number(s.sum_sec_to_first_offer) / s.n_sec_to_first_offer
        : null;
    const avg_time_to_select_offer_sec =
      s.n_sec_first_offer_to_selection > 0
        ? Number(s.sum_sec_first_offer_to_selection) /
          s.n_sec_first_offer_to_selection
        : null;

    const photo_usage_rate = tr > 0 ? s.requests_with_photo / tr : null;
    const vin_usage_rate = tr > 0 ? s.vin_entered_requests / tr : null;
    const car_selected_rate = tr > 0 ? s.requests_with_vehicle / tr : null;

    const avg_cars_per_user =
      s.distinct_vehicle_owners > 0
        ? s.vehicles_created / s.distinct_vehicle_owners
        : null;

    const offers_per_seller =
      extra.distinct_sellers_with_offers > 0
        ? toff / extra.distinct_sellers_with_offers
        : null;

    const seller_response_rate = requests_with_offers_rate;

    const avg_seller_response_time_sec = avg_time_to_first_offer_sec;

    const seller_selection_rate =
      toff > 0 ? s.requests_with_selection / toff : null;

    const supply_demand_ratio =
      tr > 0 ? extra.distinct_sellers_with_offers / tr : null;

    const liquidity_score =
      offers_per_request != null && request_to_selection_rate != null
        ? offers_per_request * request_to_selection_rate
        : null;

    const median_hours =
      extra.median_sec_to_first_offer != null
        ? extra.median_sec_to_first_offer / 3600
        : null;
    const capHours = 72;
    const speed_score =
      median_hours != null
        ? Math.max(
            0,
            Math.min(1, 1 - Math.min(median_hours, capHours) / capHours),
          )
        : null;

    return {
      schema_version: 1 as const,
      from: range.fromIso,
      to: range.toIso,
      region: range.regionKey,
      definitions: {
        offer_selected:
          'Rows in `selections` (deal finalized), not buyer accept-offer alone.',
        denominators:
          'Rates use requests **created** in the range unless noted.',
      },
      core: {
        requests_created: tr,
        offers_created: toff,
        offers_per_request,
        requests_with_offers_rate,
        requests_without_offers_rate,
        avg_time_to_first_offer_sec,
        avg_time_to_select_offer_sec,
        median_time_to_first_offer_sec: extra.median_sec_to_first_offer,
        request_to_selection_rate,
      },
      sellers_aggregate: {
        active_sellers_distinct_in_period: extra.distinct_sellers_with_offers,
        sum_daily_active_seller_slots: s.sum_active_sellers,
        seller_response_rate,
        avg_seller_response_time_sec,
        offers_per_seller,
        seller_selection_rate,
      },
      features: {
        car_added: s.vehicles_created,
        car_selected_requests: s.requests_with_vehicle,
        car_selected_rate,
        avg_cars_per_user,
        vin_entered_requests: s.vin_entered_requests,
        vin_autofill_success: null,
        vin_autofill_fail: null,
        vin_usage_rate,
        photo_uploaded: null,
        requests_with_photo: s.requests_with_photo,
        photo_usage_rate,
      },
      quality: {
        avg_seller_rating: extra.avg_seller_rating,
        ratings_count: extra.ratings_count_all_time_window,
        ignored_offers: extra.ignored_offers,
        rejected_offers: null,
        mismatch_rate: null,
      },
      growth: {
        dau: null,
        wau: null,
        mau: null,
        sessions_per_user: null,
        avg_session_duration_sec: null,
        note: 'Requires client analytics_events; not yet ingested.',
      },
      push: {
        push_sent: null,
        push_open_rate: null,
        push_to_action_rate: null,
        note: 'Requires push delivery logging + client opens.',
      },
      derived: {
        liquidity_score,
        supply_demand_ratio,
        speed_score,
        speed_score_note: `1 = instant median first offer; 0 = median ≥ ${capHours}h (capped).`,
      },
    };
  }

  async getFunnel(range: AnalyticsDateRange) {
    const s = await this.sumDailyRows(range);
    const tr = s.requests_created;
    const withOffer = s.requests_with_offer;
    const withSel = s.requests_with_selection;

    const request_created = tr;
    const offer_received = withOffer;
    const offer_selected = withSel;

    const open_to_request_dropoff = null;
    const request_to_offer_dropoff = tr > 0 ? 1 - withOffer / tr : null;
    const offer_to_selection_dropoff =
      withOffer > 0 ? 1 - withSel / withOffer : null;

    const extra = await this.rangeMediansAndDistinct(range);
    const time_to_select_offer_sec_avg =
      s.n_sec_first_offer_to_selection > 0
        ? Number(s.sum_sec_first_offer_to_selection) /
          s.n_sec_first_offer_to_selection
        : null;

    return {
      schema_version: 1 as const,
      from: range.fromIso,
      to: range.toIso,
      region: range.regionKey,
      funnel: {
        app_open: null,
        request_started: null,
        request_created,
        offer_received,
        offer_selected,
      },
      dropoffs: {
        open_to_request_dropoff,
        request_to_offer_dropoff,
        offer_to_selection_dropoff,
      },
      time_metrics: {
        time_to_create_request_sec_avg: null,
        time_to_select_offer_sec_avg,
        median_time_to_first_offer_sec: extra.median_sec_to_first_offer,
      },
      notes: {
        app_open:
          'Not tracked without mobile analytics_events; add POST /v1/analytics/events in a later phase.',
      },
    };
  }

  async getSellers(
    range: AnalyticsDateRange,
    limit: number,
    offset: number,
  ): Promise<{
    schema_version: 1;
    from: string;
    to: string;
    region: string;
    totals: {
      distinct_sellers: number;
      offers_created: number;
      wins: number;
    };
    items: Array<{
      seller_id: string;
      shop_name: string | null;
      phone: string;
      offers_count: number;
      wins: number;
      offers_per_seller_local: number;
      seller_win_rate: number | null;
      seller_selection_rate: number | null;
      avg_response_sec: number | null;
    }>;
    total: number;
  }> {
    const rf = range.regionKey === 'ALL' ? null : range.regionKey;
    const lim = Math.min(Math.max(limit, 1), 100);
    const off = Math.max(offset, 0);

    const [agg] = await this.sql<SqlSellerTotalsRow>(
      `
      SELECT
        COUNT(DISTINCT o.seller_id)::int AS distinct_sellers,
        COUNT(*)::int AS offers_created,
        COUNT(*) FILTER (WHERE s.chosen_offer_id = o.id)::int AS wins
      FROM offers o
      INNER JOIN part_requests pr ON pr.id = o.request_id
      LEFT JOIN selections s ON s.request_id = pr.id
      WHERE o.created_at >= $1 AND o.created_at <= $2
        AND ($3::text IS NULL OR pr.region = $3)
      `,
      [range.from, range.to, rf],
    );

    const rows = await this.sql<SqlSellerLeaderRow>(
      `
      WITH base AS (
        SELECT
          o.seller_id,
          u.shop_name AS shop_name,
          u.phone AS phone,
          COUNT(*)::int AS offers_count,
          COUNT(*) FILTER (WHERE s.chosen_offer_id = o.id)::int AS wins,
          AVG(EXTRACT(EPOCH FROM (o.created_at - pr.created_at)))::float AS avg_resp
        FROM offers o
        INNER JOIN part_requests pr ON pr.id = o.request_id
        INNER JOIN users u ON u.id = o.seller_id
        LEFT JOIN selections s ON s.request_id = pr.id
        WHERE o.created_at >= $1 AND o.created_at <= $2
          AND ($3::text IS NULL OR pr.region = $3)
        GROUP BY o.seller_id, u.shop_name, u.phone
      )
      SELECT * FROM base
      ORDER BY wins DESC, offers_count DESC
      LIMIT $4 OFFSET $5
      `,
      [range.from, range.to, rf, lim, off],
    );

    const [cntRow] = await this.sql<SqlCountRow>(
      `
      SELECT COUNT(*)::int AS c FROM (
        SELECT o.seller_id
        FROM offers o
        INNER JOIN part_requests pr ON pr.id = o.request_id
        WHERE o.created_at >= $1 AND o.created_at <= $2
          AND ($3::text IS NULL OR pr.region = $3)
        GROUP BY o.seller_id
      ) t
      `,
      [range.from, range.to, rf],
    );

    const items = rows.map((r) => ({
      seller_id: r.seller_id,
      shop_name: r.shop_name,
      phone: r.phone,
      offers_count: r.offers_count,
      wins: r.wins,
      offers_per_seller_local: r.offers_count,
      seller_win_rate:
        agg != null && agg.wins > 0 ? r.wins / agg.wins : r.wins > 0 ? 1 : null,
      seller_selection_rate:
        r.offers_count > 0 ? r.wins / r.offers_count : null,
      avg_response_sec:
        r.avg_resp != null && Number.isFinite(r.avg_resp) ? r.avg_resp : null,
    }));

    return {
      schema_version: 1,
      from: range.fromIso,
      to: range.toIso,
      region: range.regionKey,
      totals: {
        distinct_sellers: agg?.distinct_sellers ?? 0,
        offers_created: agg?.offers_created ?? 0,
        wins: agg?.wins ?? 0,
      },
      items,
      total: cntRow?.c ?? 0,
    };
  }

  async getSeries(range: AnalyticsDateRange, metric: string) {
    const fromD = this.toDateStr(range.from);
    const toD = this.toDateStr(range.to);
    const rows = await this.daily.find({
      where: {
        bucketDate: Between(fromD, toD),
        region: range.regionKey,
      },
      order: { bucketDate: 'ASC' },
    });

    const allowed = new Set([
      'requests_created',
      'offers_created',
      'requests_with_offer',
      'requests_with_selection',
      'active_sellers',
    ]);
    const m = allowed.has(metric) ? metric : 'requests_created';

    const points = rows.map((r) => ({
      day: r.bucketDate,
      value:
        m === 'requests_created'
          ? r.requestsCreated
          : m === 'offers_created'
            ? r.offersCreated
            : m === 'requests_with_offer'
              ? r.requestsWithOffer
              : m === 'requests_with_selection'
                ? r.requestsWithSelection
                : r.activeSellers,
    }));

    return {
      schema_version: 1 as const,
      from: range.fromIso,
      to: range.toIso,
      region: range.regionKey,
      metric: m,
      points,
    };
  }
}
