import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('analytics_marketplace_daily')
@Unique('UQ_analytics_marketplace_daily_bucket_region', [
  'bucketDate',
  'region',
])
@Index('IDX_analytics_marketplace_daily_bucket', ['bucketDate'])
export class AnalyticsMarketplaceDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date', name: 'bucket_date' })
  bucketDate: string;

  /** `ALL` = all regions; otherwise matches `part_requests.region` (e.g. AM). */
  @Column({ type: 'text' })
  region: string;

  @Column({ type: 'int', name: 'requests_created', default: 0 })
  requestsCreated: number;

  @Column({ type: 'int', name: 'offers_created', default: 0 })
  offersCreated: number;

  @Column({ type: 'int', name: 'requests_with_offer', default: 0 })
  requestsWithOffer: number;

  @Column({ type: 'int', name: 'requests_with_selection', default: 0 })
  requestsWithSelection: number;

  @Column({ type: 'bigint', name: 'sum_sec_to_first_offer', default: 0 })
  sumSecToFirstOffer: string;

  @Column({ type: 'int', name: 'n_sec_to_first_offer', default: 0 })
  nSecToFirstOffer: number;

  @Column({
    type: 'numeric',
    precision: 20,
    scale: 4,
    name: 'median_sec_to_first_offer',
    nullable: true,
  })
  medianSecToFirstOffer: string | null;

  @Column({
    type: 'bigint',
    name: 'sum_sec_first_offer_to_selection',
    default: 0,
  })
  sumSecFirstOfferToSelection: string;

  @Column({ type: 'int', name: 'n_sec_first_offer_to_selection', default: 0 })
  nSecFirstOfferToSelection: number;

  @Column({ type: 'int', name: 'active_sellers', default: 0 })
  activeSellers: number;

  @Column({ type: 'int', name: 'ratings_submitted', default: 0 })
  ratingsSubmitted: number;

  @Column({ type: 'int', name: 'requests_with_photo', default: 0 })
  requestsWithPhoto: number;

  @Column({ type: 'int', name: 'requests_with_vehicle', default: 0 })
  requestsWithVehicle: number;

  @Column({ type: 'int', name: 'vin_entered_requests', default: 0 })
  vinEnteredRequests: number;

  @Column({ type: 'int', name: 'vehicles_created', default: 0 })
  vehiclesCreated: number;

  @Column({ type: 'int', name: 'distinct_vehicle_owners', default: 0 })
  distinctVehicleOwners: number;

  @Column({ type: 'timestamptz', name: 'computed_at', default: () => 'now()' })
  computedAt: Date;
}
