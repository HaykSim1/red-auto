import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTOs for OpenAPI spec generation.
 * These classes are not used at runtime validation — only for Swagger schema output.
 */

// ── App version ──

export class AppVersionCheckDto {
  @ApiProperty({ enum: ['none', 'hard'] }) action: 'none' | 'hard';
  @ApiPropertyOptional({ type: String, nullable: true }) store_url: string | null;
}

// ── Shared primitives ──

export class PhotoDto {
  @ApiProperty() id: string;
  @ApiProperty() storage_key: string;
  @ApiProperty() sort_order: number;
}

export class VehicleDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional({ type: String, nullable: true }) brand: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) model: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) year: number | null;
  @ApiPropertyOptional({ type: String, nullable: true }) engine: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) vin: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) label: string | null;
}

// ── /me ──

export class SellerApplicationMeDto {
  @ApiProperty({ enum: ['pending', 'rejected'] }) status: string;
  @ApiProperty() shop_name: string;
  @ApiProperty() shop_address: string;
  @ApiProperty() shop_phone: string;
  @ApiPropertyOptional({ type: String, nullable: true }) logo_storage_key:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) rejection_reason:
    | string
    | null;
  @ApiProperty() created_at: string;
}

/** User payload returned with POST /auth/otp/verify (subset of profile). */
export class AuthOtpVerifyUserDto {
  @ApiProperty() id: string;
  @ApiProperty() phone: string;
  @ApiProperty({ enum: ['user', 'seller', 'admin'] }) role: string;
  @ApiPropertyOptional({ type: String, nullable: true }) display_name:
    | string
    | null;
  @ApiPropertyOptional({
    type: String,
    enum: ['hy', 'ru', 'en'],
    nullable: true,
  })
  preferred_locale: string | null;
}

export class AuthOtpVerifyResponseDto {
  @ApiProperty() access_token: string;
  @ApiProperty({ type: () => AuthOtpVerifyUserDto }) user: AuthOtpVerifyUserDto;
}

/** POST /auth/refresh — new JWT with role from current DB state */
export class AuthRefreshResponseDto {
  @ApiProperty() access_token: string;
}

export class MeResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() phone: string;
  @ApiProperty({ enum: ['user', 'seller', 'admin'] }) role: string;
  @ApiPropertyOptional({ type: String, nullable: true }) display_name:
    | string
    | null;
  @ApiPropertyOptional({
    type: String,
    enum: ['hy', 'ru', 'en'],
    nullable: true,
  })
  preferred_locale: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seller_phone:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seller_telegram:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_name:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_address:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_logo_storage_key:
    | string
    | null;
  @ApiPropertyOptional({ type: () => SellerApplicationMeDto, nullable: true })
  seller_application: SellerApplicationMeDto | null;
  @ApiProperty() created_at: string;
}

// ── /home/summary ──

export class HomeSummaryResponseDto {
  @ApiProperty() my_open_requests_count: number;
  @ApiProperty() pending_offers_on_my_requests: number;
  @ApiProperty() my_open_offers_count: number;
}

// ── /shops ──

export class FeaturedShopItemDto {
  @ApiProperty() id: string;
  @ApiProperty() shop_name: string;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_logo_storage_key:
    | string
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) rating_avg:
    | number
    | null;
  @ApiProperty() rating_count: number;
}

export class ShopReviewDto {
  @ApiProperty() id: string;
  @ApiProperty() score: number;
  @ApiPropertyOptional({ type: String, nullable: true }) comment: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) rater_name: string | null;
  @ApiProperty() created_at: string;
}

export class ShopDetailResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() shop_name: string;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_logo_storage_key:
    | string
    | null;
  /** Optional marketing / bio text when a dedicated column exists; null in MVP. */
  @ApiPropertyOptional({ type: String, nullable: true }) description:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_address:
    | string
    | null;
  /** Seller’s public contact phone (E.164); shown on shop profile for calls. */
  @ApiPropertyOptional({ type: String, nullable: true }) seller_phone:
    | string
    | null;
  /** Seller’s Telegram handle (without @); shown on shop profile. */
  @ApiPropertyOptional({ type: String, nullable: true }) seller_telegram:
    | string
    | null;
  /** Admin-curated featured flag; clients may show a “verified” style badge. */
  @ApiProperty() is_featured: boolean;
  @ApiPropertyOptional({ type: Number, nullable: true }) rating_avg:
    | number
    | null;
  @ApiProperty() rating_count: number;
  @ApiProperty({ type: [ShopReviewDto] }) reviews: ShopReviewDto[];
}

// ── Offers (serialized) ──

export class OfferSellerDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional({ type: String, nullable: true }) display_name:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_name:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seller_phone:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seller_telegram:
    | string
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) rating_avg:
    | number
    | null;
  @ApiProperty() rating_count: number;
}

export class OfferDto {
  @ApiProperty() id: string;
  @ApiProperty() request_id: string;
  @ApiProperty() seller_id: string;
  @ApiProperty() price_amount: string;
  @ApiProperty() price_currency: string;
  @ApiProperty() condition: string;
  @ApiProperty() delivery: string;
  @ApiProperty() description: string;
  @ApiPropertyOptional({ type: String, nullable: true }) variant_label:
    | string
    | null;
  @ApiProperty() moderation_state: string;
  @ApiProperty() created_at: string;
  @ApiProperty({ type: [PhotoDto] }) photos: PhotoDto[];
  @ApiProperty({ type: () => OfferSellerDto }) seller: OfferSellerDto;
  @ApiPropertyOptional({ type: Boolean }) seller_identity_hidden: boolean;
}

// ── Requests ──

/** GET /requests/mine/stats */
export class RequestMineStatsResponseDto {
  @ApiProperty({
    description:
      'Total visible offers across all of the user’s open requests (excludes mutually cancelled).',
  })
  total_offer_count: number;
}

export class RequestListItemDto {
  @ApiProperty() id: string;
  @ApiProperty() description: string;
  @ApiProperty() status: string;
  @ApiProperty() region: string;
  @ApiProperty() moderation_state: string;
  @ApiProperty() created_at: string;
  @ApiProperty({ type: String, nullable: true }) cover_storage_key:
    | string
    | null;
  @ApiProperty({ type: () => VehicleDto, nullable: true })
  vehicle: VehicleDto | null;
  @ApiProperty({ description: 'Number of photos attached to the request' })
  photo_count: number;
  @ApiProperty({
    description:
      'Count of visible offers (excludes mutually cancelled); 0 if none',
  })
  offers_count: number;
  @ApiPropertyOptional({
    description:
      'Seller-only: true when the request author is marked as a special buyer in admin.',
  })
  buyer_is_special?: boolean;
}

export class PaginatedRequestListDto {
  @ApiProperty({ type: [RequestListItemDto] }) items: RequestListItemDto[];
  @ApiProperty({ type: String, nullable: true }) next_cursor: string | null;
}

/** Seller History tab: one row per terminal offer on a request. */
export class SellerOfferHistoryItemDto {
  @ApiProperty() offer_id: string;
  @ApiProperty() request_id: string;
  @ApiProperty({
    enum: ['success', 'canceled'],
    description:
      'success = deal_completed; canceled = mutually_cancelled or acknowledged buyer_cancelled',
  })
  outcome: string;
  @ApiProperty() description: string;
  @ApiPropertyOptional({ type: String, nullable: true }) cover_storage_key:
    | string
    | null;
  @ApiPropertyOptional({ type: () => VehicleDto, nullable: true })
  vehicle: VehicleDto | null;
  @ApiProperty() price_amount: string;
  @ApiProperty() price_currency: string;
  @ApiPropertyOptional({ type: String, nullable: true }) variant_label:
    | string
    | null;
  @ApiProperty({
    description:
      'When the offer reached this terminal state (offer updated_at)',
  })
  closed_at: string;
}

export class PaginatedSellerOfferHistoryDto {
  @ApiProperty({ type: [SellerOfferHistoryItemDto] })
  items: SellerOfferHistoryItemDto[];
  @ApiProperty({ type: String, nullable: true }) next_cursor: string | null;
}

export class RequestPublicDto {
  @ApiProperty() id: string;
  @ApiProperty() description: string;
  @ApiPropertyOptional({ type: String, nullable: true }) vin_text:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) part_number:
    | string
    | null;
  @ApiProperty() status: string;
  @ApiProperty() region: string;
  @ApiProperty() created_at: string;
  @ApiPropertyOptional({ type: String, nullable: true }) cover_storage_key:
    | string
    | null;
  @ApiPropertyOptional({ type: () => VehicleDto, nullable: true })
  vehicle: VehicleDto | null;
  @ApiProperty({ type: [PhotoDto] }) photos: PhotoDto[];
  @ApiProperty({
    description: 'Same as photos.length; denormalized for clients',
  })
  photo_count: number;
  @ApiProperty({
    description:
      'Visible offers count (excludes mutually cancelled); list rows match this',
  })
  offers_count: number;
  @ApiPropertyOptional({
    description:
      'Seller-only: true when the request author is marked as a special buyer in admin.',
  })
  buyer_is_special?: boolean;
}

export class RequestAuthorDetailDto extends RequestPublicDto {
  @ApiProperty({ type: [OfferDto] }) offers: OfferDto[];
  @ApiPropertyOptional({ type: String, nullable: true })
  active_acceptance_offer_id: string | null;
}

// ── Selection ──

export class SellerContactDto {
  @ApiPropertyOptional({ type: String, nullable: true }) seller_phone:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seller_telegram:
    | string
    | null;
}

export class SelectionResponseDto {
  @ApiProperty() request_id: string;
  @ApiProperty() offer_id: string;
  @ApiProperty() selected_at: string;
  @ApiProperty({ type: () => SellerContactDto })
  seller_contact: SellerContactDto;
  @ApiPropertyOptional({ type: Boolean }) provisional: boolean;
  @ApiPropertyOptional({ type: Boolean }) buyer_marked_complete: boolean;
  @ApiPropertyOptional({ type: Boolean }) seller_marked_complete: boolean;
  @ApiPropertyOptional({ type: Boolean }) buyer_marked_cancel: boolean;
  @ApiPropertyOptional({ type: Boolean }) seller_marked_cancel: boolean;
  @ApiPropertyOptional({
    type: String,
    enum: ['buyer', 'seller'],
    nullable: true,
  })
  waiting_for_complete: string | null;
  @ApiPropertyOptional({
    type: String,
    enum: ['buyer', 'seller'],
    nullable: true,
  })
  waiting_for_cancel: string | null;
}

// ── Admin: Featured shops ──

export class AdminFeaturedShopRowDto {
  @ApiProperty() id: string;
  @ApiProperty() phone: string;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_name:
    | string
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) rating_avg:
    | number
    | null;
  @ApiProperty() rating_count: number;
  @ApiProperty() is_featured: boolean;
  @ApiProperty() created_at: string;
}

export class AdminFeaturedShopListDto {
  @ApiProperty({ type: [AdminFeaturedShopRowDto] })
  items: AdminFeaturedShopRowDto[];
  @ApiProperty() total: number;
}

export class AdminSpecialBuyerResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() is_special_buyer: boolean;
}

// ── Home banners ──

export class HomeBannerItemDto {
  @ApiProperty() id: string;
  @ApiProperty() storage_key: string;
  @ApiProperty() title: string;
  @ApiPropertyOptional({ type: String, nullable: true }) subtitle:
    | string
    | null;
  @ApiProperty() sort_order: number;
}

export class HomeBannerListDto {
  @ApiProperty({ type: [HomeBannerItemDto] }) items: HomeBannerItemDto[];
}

export class AdminHomeBannerRowDto extends HomeBannerItemDto {
  @ApiProperty() created_at: string;
  @ApiProperty() updated_at: string;
}

export class AdminHomeBannerListDto {
  @ApiProperty({ type: [AdminHomeBannerRowDto] })
  items: AdminHomeBannerRowDto[];
}

// ── Presign ──

export class PresignResponseDto {
  @ApiProperty() url: string;
  @ApiProperty({ enum: ['PUT'] }) method: string;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  headers: Record<string, string>;
  @ApiProperty() storage_key: string;
  @ApiProperty() expires_in: number;
}

// ── Admin analytics (aggregates only) ──

export class AdminAnalyticsDefinitionsDto {
  @ApiProperty() offer_selected: string;
  @ApiProperty() denominators: string;
}

export class AdminAnalyticsCoreDto {
  @ApiProperty() requests_created: number;
  @ApiProperty() offers_created: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) offers_per_request:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  requests_with_offers_rate: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  requests_without_offers_rate: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  avg_time_to_first_offer_sec: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  avg_time_to_select_offer_sec: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  median_time_to_first_offer_sec: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  request_to_selection_rate: number | null;
}

export class AdminAnalyticsSellersAggregateDto {
  @ApiProperty() active_sellers_distinct_in_period: number;
  @ApiProperty() sum_daily_active_seller_slots: number;
  @ApiPropertyOptional({ type: Number, nullable: true })
  seller_response_rate: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  avg_seller_response_time_sec: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) offers_per_seller:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  seller_selection_rate: number | null;
}

export class AdminAnalyticsFeaturesDto {
  @ApiProperty() car_added: number;
  @ApiProperty() car_selected_requests: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) car_selected_rate:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) avg_cars_per_user:
    | number
    | null;
  @ApiProperty() vin_entered_requests: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) vin_autofill_success:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) vin_autofill_fail:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) vin_usage_rate:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) photo_uploaded:
    | number
    | null;
  @ApiProperty() requests_with_photo: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) photo_usage_rate:
    | number
    | null;
}

export class AdminAnalyticsQualityDto {
  @ApiPropertyOptional({ type: Number, nullable: true }) avg_seller_rating:
    | number
    | null;
  @ApiProperty() ratings_count: number;
  @ApiProperty() ignored_offers: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) rejected_offers:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) mismatch_rate:
    | number
    | null;
}

export class AdminAnalyticsGrowthDto {
  @ApiPropertyOptional({ type: Number, nullable: true }) dau: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) wau: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) mau: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) sessions_per_user:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  avg_session_duration_sec: number | null;
  @ApiPropertyOptional({ type: String, nullable: true }) note: string | null;
}

export class AdminAnalyticsPushDto {
  @ApiPropertyOptional({ type: Number, nullable: true }) push_sent:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) push_open_rate:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) push_to_action_rate:
    | number
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) note: string | null;
}

export class AdminAnalyticsDerivedDto {
  @ApiPropertyOptional({ type: Number, nullable: true }) liquidity_score:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) supply_demand_ratio:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) speed_score:
    | number
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) speed_score_note:
    | string
    | null;
}

export class AdminAnalyticsSummaryResponseDto {
  @ApiProperty() schema_version: number;
  @ApiProperty() from: string;
  @ApiProperty() to: string;
  @ApiProperty() region: string;
  @ApiProperty({ type: () => AdminAnalyticsDefinitionsDto })
  definitions: AdminAnalyticsDefinitionsDto;
  @ApiProperty({ type: () => AdminAnalyticsCoreDto })
  core: AdminAnalyticsCoreDto;
  @ApiProperty({ type: () => AdminAnalyticsSellersAggregateDto })
  sellers_aggregate: AdminAnalyticsSellersAggregateDto;
  @ApiProperty({ type: () => AdminAnalyticsFeaturesDto })
  features: AdminAnalyticsFeaturesDto;
  @ApiProperty({ type: () => AdminAnalyticsQualityDto })
  quality: AdminAnalyticsQualityDto;
  @ApiProperty({ type: () => AdminAnalyticsGrowthDto })
  growth: AdminAnalyticsGrowthDto;
  @ApiProperty({ type: () => AdminAnalyticsPushDto })
  push: AdminAnalyticsPushDto;
  @ApiProperty({ type: () => AdminAnalyticsDerivedDto })
  derived: AdminAnalyticsDerivedDto;
}

export class AdminAnalyticsFunnelStepsDto {
  @ApiPropertyOptional({ type: Number, nullable: true }) app_open:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) request_started:
    | number
    | null;
  @ApiProperty() request_created: number;
  @ApiProperty() offer_received: number;
  @ApiProperty() offer_selected: number;
}

export class AdminAnalyticsDropoffsDto {
  @ApiPropertyOptional({ type: Number, nullable: true })
  open_to_request_dropoff: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  request_to_offer_dropoff: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  offer_to_selection_dropoff: number | null;
}

export class AdminAnalyticsTimeMetricsDto {
  @ApiPropertyOptional({ type: Number, nullable: true })
  time_to_create_request_sec_avg: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  time_to_select_offer_sec_avg: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true })
  median_time_to_first_offer_sec: number | null;
}

export class AdminAnalyticsFunnelNotesDto {
  @ApiPropertyOptional({ type: String, nullable: true }) app_open:
    | string
    | null;
}

export class AdminAnalyticsFunnelResponseDto {
  @ApiProperty() schema_version: number;
  @ApiProperty() from: string;
  @ApiProperty() to: string;
  @ApiProperty() region: string;
  @ApiProperty({ type: () => AdminAnalyticsFunnelStepsDto })
  funnel: AdminAnalyticsFunnelStepsDto;
  @ApiProperty({ type: () => AdminAnalyticsDropoffsDto })
  dropoffs: AdminAnalyticsDropoffsDto;
  @ApiProperty({ type: () => AdminAnalyticsTimeMetricsDto })
  time_metrics: AdminAnalyticsTimeMetricsDto;
  @ApiProperty({ type: () => AdminAnalyticsFunnelNotesDto })
  notes: AdminAnalyticsFunnelNotesDto;
}

export class AdminAnalyticsSellerRowDto {
  @ApiProperty() seller_id: string;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_name:
    | string
    | null;
  @ApiProperty() phone: string;
  @ApiProperty() offers_count: number;
  @ApiProperty() wins: number;
  @ApiProperty() offers_per_seller_local: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) seller_win_rate:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) seller_selection_rate:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) avg_response_sec:
    | number
    | null;
}

export class AdminAnalyticsSellersTotalsDto {
  @ApiProperty() distinct_sellers: number;
  @ApiProperty() offers_created: number;
  @ApiProperty() wins: number;
}

export class AdminAnalyticsSellersResponseDto {
  @ApiProperty() schema_version: number;
  @ApiProperty() from: string;
  @ApiProperty() to: string;
  @ApiProperty() region: string;
  @ApiProperty({ type: () => AdminAnalyticsSellersTotalsDto })
  totals: AdminAnalyticsSellersTotalsDto;
  @ApiProperty({ type: [AdminAnalyticsSellerRowDto] })
  items: AdminAnalyticsSellerRowDto[];
  @ApiProperty() total: number;
}

export class AdminAnalyticsSeriesPointDto {
  @ApiProperty() day: string;
  @ApiProperty() value: number;
}

export class AdminAnalyticsSeriesResponseDto {
  @ApiProperty() schema_version: number;
  @ApiProperty() from: string;
  @ApiProperty() to: string;
  @ApiProperty() region: string;
  @ApiProperty() metric: string;
  @ApiProperty({ type: [AdminAnalyticsSeriesPointDto] })
  points: AdminAnalyticsSeriesPointDto[];
}

export class AdminAnalyticsRebuildResponseDto {
  @ApiProperty() days_processed: number;
}
