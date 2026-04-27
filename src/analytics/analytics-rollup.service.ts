import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** Visible offer: matches `OffersService.countVisibleOffersByRequestIds`. */
const OFFER_VISIBLE_SQL = `
  o.moderation_state = 'visible'
  AND o.interaction_state != 'mutually_cancelled'
`;

interface SqlRegionRow {
  region: string;
}

interface SqlCountRow {
  c: number;
}

interface SqlTimeAggRow {
  sum_sec: string | null;
  n: number;
  median_sec: string | null;
}

interface SqlSelTimeAggRow {
  sum_sec: string;
  n: number;
}

interface SqlVehiclePairRow {
  c: number;
  u: number;
}

export interface DayBucketBounds {
  start: Date;
  end: Date;
  bucketDate: string;
}

@Injectable()
export class AnalyticsRollupService {
  private readonly log = new Logger(AnalyticsRollupService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private async sql<T extends object>(
    q: string,
    params: unknown[],
  ): Promise<T[]> {
    const raw: unknown = await this.ds.query(q, params);
    return raw as T[];
  }

  static utcDayBounds(d: Date): DayBucketBounds {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const day = d.getUTCDate();
    const start = new Date(Date.UTC(y, m, day, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, day + 1, 0, 0, 0, 0));
    const bucketDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { start, end, bucketDate };
  }

  /** Regions with marketplace activity on this UTC day (requests or offers). */
  async distinctRegionsForDay(start: Date, end: Date): Promise<string[]> {
    const rows = await this.sql<SqlRegionRow>(
      `
      SELECT DISTINCT region FROM (
        SELECT pr.region FROM part_requests pr
        WHERE pr.created_at >= $1 AND pr.created_at < $2
        UNION
        SELECT pr2.region FROM offers o
        INNER JOIN part_requests pr2 ON pr2.id = o.request_id
        WHERE o.created_at >= $1 AND o.created_at < $2
      ) u
      ORDER BY 1
      `,
      [start, end],
    );
    return rows.map((r) => r.region).filter(Boolean);
  }

  async recomputeDayUtc(day: Date): Promise<void> {
    const { start, end, bucketDate } = AnalyticsRollupService.utcDayBounds(day);
    const regions = await this.distinctRegionsForDay(start, end);
    const targets: Array<{ regionKey: string; regionFilter: string | null }> = [
      { regionKey: 'ALL', regionFilter: null },
      ...regions.map((r) => ({ regionKey: r, regionFilter: r })),
    ];
    for (const t of targets) {
      const row = await this.computeMetricsForBucket(
        start,
        end,
        t.regionFilter,
      );
      await this.upsertRow(bucketDate, t.regionKey, row);
    }
    this.log.log(
      `Analytics rollup done for ${bucketDate} (${targets.length} region rows).`,
    );
  }

  /** 02:15 UTC — recompute previous UTC day after traffic settles. */
  @Cron('15 2 * * *', { timeZone: 'UTC' })
  async nightlyRollup(): Promise<void> {
    const y = new Date();
    y.setUTCDate(y.getUTCDate() - 1);
    await this.recomputeDayUtc(y);
  }

  async recomputeRangeUtc(fromDay: Date, toDay: Date): Promise<number> {
    let n = 0;
    const cur = new Date(
      Date.UTC(
        fromDay.getUTCFullYear(),
        fromDay.getUTCMonth(),
        fromDay.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const endLimit = new Date(
      Date.UTC(
        toDay.getUTCFullYear(),
        toDay.getUTCMonth(),
        toDay.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    while (cur.getTime() <= endLimit.getTime()) {
      await this.recomputeDayUtc(new Date(cur));
      n += 1;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return n;
  }

  private async upsertRow(
    bucketDate: string,
    regionKey: string,
    row: Awaited<ReturnType<AnalyticsRollupService['computeMetricsForBucket']>>,
  ): Promise<void> {
    await this.ds.query(
      `
      INSERT INTO analytics_marketplace_daily (
        bucket_date, region,
        requests_created, offers_created, requests_with_offer, requests_with_selection,
        sum_sec_to_first_offer, n_sec_to_first_offer, median_sec_to_first_offer,
        sum_sec_first_offer_to_selection, n_sec_first_offer_to_selection,
        active_sellers, ratings_submitted,
        requests_with_photo, requests_with_vehicle, vin_entered_requests,
        vehicles_created, distinct_vehicle_owners,
        computed_at
      ) VALUES (
        $1::date, $2,
        $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11,
        $12, $13,
        $14, $15, $16,
        $17, $18,
        now()
      )
      ON CONFLICT (bucket_date, region) DO UPDATE SET
        requests_created = EXCLUDED.requests_created,
        offers_created = EXCLUDED.offers_created,
        requests_with_offer = EXCLUDED.requests_with_offer,
        requests_with_selection = EXCLUDED.requests_with_selection,
        sum_sec_to_first_offer = EXCLUDED.sum_sec_to_first_offer,
        n_sec_to_first_offer = EXCLUDED.n_sec_to_first_offer,
        median_sec_to_first_offer = EXCLUDED.median_sec_to_first_offer,
        sum_sec_first_offer_to_selection = EXCLUDED.sum_sec_first_offer_to_selection,
        n_sec_first_offer_to_selection = EXCLUDED.n_sec_first_offer_to_selection,
        active_sellers = EXCLUDED.active_sellers,
        ratings_submitted = EXCLUDED.ratings_submitted,
        requests_with_photo = EXCLUDED.requests_with_photo,
        requests_with_vehicle = EXCLUDED.requests_with_vehicle,
        vin_entered_requests = EXCLUDED.vin_entered_requests,
        vehicles_created = EXCLUDED.vehicles_created,
        distinct_vehicle_owners = EXCLUDED.distinct_vehicle_owners,
        computed_at = now()
      `,
      [
        bucketDate,
        regionKey,
        row.requests_created,
        row.offers_created,
        row.requests_with_offer,
        row.requests_with_selection,
        row.sum_sec_to_first_offer,
        row.n_sec_to_first_offer,
        row.median_sec_to_first_offer,
        row.sum_sec_first_offer_to_selection,
        row.n_sec_first_offer_to_selection,
        row.active_sellers,
        row.ratings_submitted,
        row.requests_with_photo,
        row.requests_with_vehicle,
        row.vin_entered_requests,
        row.vehicles_created,
        row.distinct_vehicle_owners,
      ],
    );
  }

  private async computeMetricsForBucket(
    start: Date,
    end: Date,
    regionFilter: string | null,
  ): Promise<{
    requests_created: number;
    offers_created: number;
    requests_with_offer: number;
    requests_with_selection: number;
    sum_sec_to_first_offer: number;
    n_sec_to_first_offer: number;
    median_sec_to_first_offer: number | null;
    sum_sec_first_offer_to_selection: number;
    n_sec_first_offer_to_selection: number;
    active_sellers: number;
    ratings_submitted: number;
    requests_with_photo: number;
    requests_with_vehicle: number;
    vin_entered_requests: number;
    vehicles_created: number;
    distinct_vehicle_owners: number;
  }> {
    const rf = regionFilter;

    const [reqRow] = await this.sql<SqlCountRow>(
      `
      SELECT COUNT(*)::int AS c FROM part_requests pr
      WHERE pr.created_at >= $1 AND pr.created_at < $2
        AND ($3::text IS NULL OR pr.region = $3)
      `,
      [start, end, rf],
    );

    const [offRow] = await this.sql<SqlCountRow>(
      `
      SELECT COUNT(*)::int AS c FROM offers o
      INNER JOIN part_requests pr ON pr.id = o.request_id
      WHERE o.created_at >= $1 AND o.created_at < $2
        AND ($3::text IS NULL OR pr.region = $3)
      `,
      [start, end, rf],
    );

    const [withOfferRow] = await this.sql<SqlCountRow>(
      `
      SELECT COUNT(*)::int AS c FROM part_requests pr
      WHERE pr.created_at >= $1 AND pr.created_at < $2
        AND ($3::text IS NULL OR pr.region = $3)
        AND EXISTS (
          SELECT 1 FROM offers o
          WHERE o.request_id = pr.id AND ${OFFER_VISIBLE_SQL.replace(/\n/g, ' ')}
        )
      `,
      [start, end, rf],
    );

    const [withSelRow] = await this.sql<SqlCountRow>(
      `
      SELECT COUNT(*)::int AS c
      FROM part_requests pr
      INNER JOIN selections s ON s.request_id = pr.id
      WHERE pr.created_at >= $1 AND pr.created_at < $2
        AND ($3::text IS NULL OR pr.region = $3)
      `,
      [start, end, rf],
    );

    const [timeAgg] = await this.sql<SqlTimeAggRow>(
      `
      WITH pr_day AS (
        SELECT pr.id, pr.created_at AS req_created
        FROM part_requests pr
        WHERE pr.created_at >= $1 AND pr.created_at < $2
          AND ($3::text IS NULL OR pr.region = $3)
      ),
      first_off AS (
        SELECT DISTINCT ON (o.request_id) o.request_id, o.created_at AS first_at
        FROM offers o
        INNER JOIN pr_day p ON p.id = o.request_id
        WHERE ${OFFER_VISIBLE_SQL}
        ORDER BY o.request_id, o.created_at ASC
      ),
      deltas AS (
        SELECT EXTRACT(EPOCH FROM (f.first_at - p.req_created))::double precision AS sec
        FROM pr_day p
        INNER JOIN first_off f ON f.request_id = p.id
      )
      SELECT
        COALESCE(SUM(sec)::bigint, 0) AS sum_sec,
        COUNT(*)::int AS n,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY sec) AS median_sec
      FROM deltas
      `,
      [start, end, rf],
    );

    const [selTimeAgg] = await this.sql<SqlSelTimeAggRow>(
      `
      WITH pr_day AS (
        SELECT pr.id, pr.created_at AS req_created
        FROM part_requests pr
        WHERE pr.created_at >= $1 AND pr.created_at < $2
          AND ($3::text IS NULL OR pr.region = $3)
      ),
      first_off AS (
        SELECT DISTINCT ON (o.request_id) o.request_id, o.created_at AS first_at
        FROM offers o
        INNER JOIN pr_day p ON p.id = o.request_id
        WHERE ${OFFER_VISIBLE_SQL}
        ORDER BY o.request_id, o.created_at ASC
      )
      SELECT
        COALESCE(SUM(
          EXTRACT(EPOCH FROM (s.selected_at - f.first_at))::bigint
        ), 0)::bigint AS sum_sec,
        COUNT(*)::int AS n
      FROM selections s
      INNER JOIN pr_day p ON p.id = s.request_id
      INNER JOIN first_off f ON f.request_id = p.id
      `,
      [start, end, rf],
    );

    const [sellersRow] = await this.sql<SqlCountRow>(
      `
      SELECT COUNT(DISTINCT o.seller_id)::int AS c
      FROM offers o
      INNER JOIN part_requests pr ON pr.id = o.request_id
      WHERE o.created_at >= $1 AND o.created_at < $2
        AND ($3::text IS NULL OR pr.region = $3)
      `,
      [start, end, rf],
    );

    const [ratingsRow] = await this.sql<SqlCountRow>(
      `
      SELECT COUNT(*)::int AS c
      FROM seller_ratings sr
      INNER JOIN part_requests pr ON pr.id = sr.request_id
      WHERE sr.created_at >= $1 AND sr.created_at < $2
        AND ($3::text IS NULL OR pr.region = $3)
      `,
      [start, end, rf],
    );

    const [photoRow] = await this.sql<SqlCountRow>(
      `
      SELECT COUNT(*)::int AS c
      FROM part_requests pr
      WHERE pr.created_at >= $1 AND pr.created_at < $2
        AND ($3::text IS NULL OR pr.region = $3)
        AND EXISTS (SELECT 1 FROM request_photos rp WHERE rp.request_id = pr.id)
      `,
      [start, end, rf],
    );

    const [vehRow] = await this.sql<SqlCountRow>(
      `
      SELECT COUNT(*)::int AS c
      FROM part_requests pr
      WHERE pr.created_at >= $1 AND pr.created_at < $2
        AND ($3::text IS NULL OR pr.region = $3)
        AND pr.vehicle_id IS NOT NULL
      `,
      [start, end, rf],
    );

    const [vinRow] = await this.sql<SqlCountRow>(
      `
      SELECT COUNT(*)::int AS c
      FROM part_requests pr
      LEFT JOIN vehicles v ON v.id = pr.vehicle_id
      WHERE pr.created_at >= $1 AND pr.created_at < $2
        AND ($3::text IS NULL OR pr.region = $3)
        AND (
          (pr.vin_text IS NOT NULL AND btrim(pr.vin_text) <> '')
          OR (v.vin IS NOT NULL AND btrim(v.vin) <> '')
        )
      `,
      [start, end, rf],
    );

    let vehicles_created = 0;
    let distinct_vehicle_owners = 0;
    if (rf === null) {
      const [vRow] = await this.sql<SqlVehiclePairRow>(
        `
        SELECT COUNT(*)::int AS c, COUNT(DISTINCT user_id)::int AS u
        FROM vehicles v
        WHERE v.created_at >= $1 AND v.created_at < $2
        `,
        [start, end],
      );
      vehicles_created = vRow?.c ?? 0;
      distinct_vehicle_owners = vRow?.u ?? 0;
    }

    const sumSec = timeAgg?.sum_sec != null ? BigInt(timeAgg.sum_sec) : 0n;
    const medianParsed =
      timeAgg?.median_sec != null && timeAgg.median_sec !== ''
        ? Number(timeAgg.median_sec)
        : null;

    return {
      requests_created: reqRow?.c ?? 0,
      offers_created: offRow?.c ?? 0,
      requests_with_offer: withOfferRow?.c ?? 0,
      requests_with_selection: withSelRow?.c ?? 0,
      sum_sec_to_first_offer: Number(sumSec),
      n_sec_to_first_offer: timeAgg?.n ?? 0,
      median_sec_to_first_offer: medianParsed,
      sum_sec_first_offer_to_selection: Number(
        selTimeAgg?.sum_sec != null ? BigInt(selTimeAgg.sum_sec) : 0n,
      ),
      n_sec_first_offer_to_selection: selTimeAgg?.n ?? 0,
      active_sellers: sellersRow?.c ?? 0,
      ratings_submitted: ratingsRow?.c ?? 0,
      requests_with_photo: photoRow?.c ?? 0,
      requests_with_vehicle: vehRow?.c ?? 0,
      vin_entered_requests: vinRow?.c ?? 0,
      vehicles_created,
      distinct_vehicle_owners,
    };
  }
}
