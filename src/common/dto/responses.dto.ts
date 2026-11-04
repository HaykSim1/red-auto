import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTOs for OpenAPI spec generation.
 * These classes are not used at runtime validation — only for Swagger schema output.
 */

// ── App version ──

export class AppVersionCheckDto {
  @ApiProperty({ enum: ['none', 'hard'] }) action: 'none' | 'hard';
  @ApiPropertyOptional({ type: String, nullable: true }) store_url:
    | string
    | null;
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
  @ApiProperty({ enum: ['user', 'seller', 'admin', 'operator'] })
  role: string;
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
  @ApiProperty() refresh_token: string;
  @ApiProperty({ type: () => AuthOtpVerifyUserDto }) user: AuthOtpVerifyUserDto;
}

/** POST /auth/refresh — new access + refresh token pair (rotation) */
export class AuthRefreshResponseDto {
  @ApiProperty() access_token: string;
  @ApiProperty() refresh_token: string;
}

export class MeResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() phone: string;
  @ApiProperty({ enum: ['user', 'seller', 'admin', 'operator'] })
  role: string;
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
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Request holding the most recent untouched offer; null when there are none.',
  })
  latest_pending_offer_request_id: string | null;
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
  @ApiPropertyOptional({ type: String, nullable: true }) rater_name:
    | string
    | null;
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
  /** Number of active inventory items in the shop catalog. */
  @ApiProperty() items_count: number;
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
  @ApiPropertyOptional({ type: String, nullable: true }) city: string | null;
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
  @ApiProperty({ default: 1 }) quantity: number;
  @ApiPropertyOptional({ type: String, nullable: true }) city: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) vin_text:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) part_number:
    | string
    | null;
  @ApiProperty() status: string;
  @ApiProperty() region: string;
  @ApiProperty() created_at: string;
  @ApiProperty({ description: 'Bumped when the author edits the request' })
  updated_at: string;
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

/** Seller feed page — rows carry the public shape (photos, vin_text, part_number, quantity). */
export class PaginatedRequestPublicListDto {
  @ApiProperty({ type: [RequestPublicDto] }) items: RequestPublicDto[];
  @ApiProperty({ type: String, nullable: true }) next_cursor: string | null;
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
  @ApiProperty() is_managed_shop: boolean;
  @ApiProperty() created_at: string;
  @ApiPropertyOptional({ type: String, nullable: true }) display_name:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_address:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_logo_storage_key:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seller_phone:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seller_telegram:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) blocked_at:
    | string
    | null;
}

export class AdminManagedShopRowDto {
  @ApiProperty() id: string;
  @ApiProperty() phone: string;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_name:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_address:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_logo_storage_key:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seller_phone:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seller_telegram:
    | string
    | null;
  @ApiProperty() is_featured: boolean;
  @ApiProperty() is_managed_shop: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) blocked_at:
    | string
    | null;
  @ApiProperty() created_at: string;
}

export class AdminManagedShopListDto {
  @ApiProperty({ type: [AdminManagedShopRowDto] })
  items: AdminManagedShopRowDto[];
  @ApiProperty() total: number;
}

export class AdminOperatorRowDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() phone: string;
  @ApiPropertyOptional({ type: String, nullable: true }) display_name:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) blocked_at:
    | string
    | null;
  @ApiProperty() created_at: string;
}

export class AdminOperatorListDto {
  @ApiProperty({ type: [AdminOperatorRowDto] })
  items: AdminOperatorRowDto[];
  @ApiProperty() total: number;
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

// ── Admin: Shop detail ──

export class AdminShopPerformanceDto {
  @ApiProperty() offers_count: number;
  @ApiProperty() wins: number;
  @ApiPropertyOptional({ type: Number, nullable: true }) win_rate:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) avg_response_sec:
    | number
    | null;
}

export class AdminShopDetailResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() phone: string;
  @ApiPropertyOptional({ type: String, nullable: true }) display_name:
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
  @ApiPropertyOptional({ type: String, nullable: true }) seller_phone:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seller_telegram:
    | string
    | null;
  @ApiProperty() is_featured: boolean;
  @ApiProperty() is_managed_shop: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) blocked_at:
    | string
    | null;
  @ApiProperty() created_at: string;
  @ApiPropertyOptional({ type: Number, nullable: true }) rating_avg:
    | number
    | null;
  @ApiProperty() rating_count: number;
  @ApiProperty({ type: () => AdminShopPerformanceDto })
  performance: AdminShopPerformanceDto;
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

// ── Admin: Request detail ──

export class AdminRequestDetailAuthorDto {
  @ApiProperty() id: string;
  @ApiProperty() phone: string;
  @ApiPropertyOptional({ type: String, nullable: true }) display_name:
    | string
    | null;
}

export class AdminRequestDetailVehicleDto {
  @ApiPropertyOptional({ type: String, nullable: true }) brand: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) model: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) year: number | null;
  @ApiPropertyOptional({ type: String, nullable: true }) engine: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) vin: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) label: string | null;
}

export class AdminRequestDetailPhotoDto {
  @ApiProperty() storage_key: string;
  @ApiProperty() sort_order: number;
}

export class AdminRequestDetailResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() description: string;
  @ApiPropertyOptional({ type: String, nullable: true }) vin_text:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) part_number:
    | string
    | null;
  @ApiProperty() quantity: number;
  @ApiPropertyOptional({ type: String, nullable: true }) city: string | null;
  @ApiProperty() region: string;
  @ApiProperty() status: string;
  @ApiProperty() moderation_state: string;
  @ApiProperty() created_at: string;
  @ApiProperty() updated_at: string;
  @ApiProperty({ type: () => AdminRequestDetailAuthorDto })
  author: AdminRequestDetailAuthorDto;
  @ApiProperty({ type: () => AdminRequestDetailVehicleDto, nullable: true })
  vehicle: AdminRequestDetailVehicleDto | null;
  @ApiProperty({ type: [AdminRequestDetailPhotoDto] })
  photos: AdminRequestDetailPhotoDto[];
  @ApiPropertyOptional({ type: String, nullable: true })
  active_acceptance_offer_id: string | null;
}

// ── Admin: Request offers ──

export class AdminRequestOfferPhotoDto {
  @ApiProperty() storage_key: string;
  @ApiProperty() sort_order: number;
}

export class AdminRequestOfferRowDto {
  @ApiProperty() id: string;
  @ApiProperty() request_id: string;
  @ApiProperty() seller_id: string;
  @ApiProperty() title: string;
  @ApiProperty() request_summary: string;
  @ApiProperty() seller_label: string;
  @ApiProperty({
    description: 'True when staff created the offer for a managed shop',
  })
  created_by_operator: boolean;
  @ApiProperty() moderation_state: string;
  @ApiProperty() price_amount: string;
  @ApiPropertyOptional({ type: String, nullable: true }) variant_label:
    | string
    | null;
  @ApiProperty() created_at: string;
  @ApiProperty({ type: [AdminRequestOfferPhotoDto] })
  photos: AdminRequestOfferPhotoDto[];
}

export class AdminRequestOffersResponseDto {
  @ApiProperty({ type: [AdminRequestOfferRowDto] })
  items: AdminRequestOfferRowDto[];
  @ApiProperty() total: number;
}

// ── Admin: Shop ratings moderation ──

export class AdminShopRatingRaterDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional({ type: String, nullable: true }) display_name:
    | string
    | null;
  @ApiProperty() phone: string;
}

export class AdminShopRatingRowDto {
  @ApiProperty() id: string;
  @ApiProperty() score: number;
  @ApiPropertyOptional({ type: String, nullable: true }) comment: string | null;
  @ApiProperty() moderation_state: string;
  @ApiProperty() created_at: string;
  @ApiProperty({ type: () => AdminShopRatingRaterDto })
  rater: AdminShopRatingRaterDto;
  @ApiPropertyOptional({ type: String, nullable: true }) request_id:
    | string
    | null;
}

export class AdminShopRatingsResponseDto {
  @ApiProperty({ type: [AdminShopRatingRowDto] })
  items: AdminShopRatingRowDto[];
  @ApiProperty() total: number;
}

export class AdminModerationResultDto {
  @ApiProperty() id: string;
  @ApiProperty() moderation_state: string;
}

// ── Operator (staff acting for managed shop personas) ──

export class OperatorShopDto {
  @ApiProperty() id: string;
  @ApiProperty() phone: string;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_name:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_address:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seller_phone:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seller_telegram:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  shop_logo_storage_key: string | null;
}

export class OperatorShopListDto {
  @ApiProperty({ type: [OperatorShopDto] }) items: OperatorShopDto[];
}

export class OperatorRequestRowDto extends RequestPublicDto {
  @ApiProperty({
    type: [String],
    description: 'Managed shops that already have a live offer on this request',
  })
  answered_by_shop_ids: string[];
}

export class PaginatedOperatorRequestListDto {
  @ApiProperty({ type: [OperatorRequestRowDto] })
  items: OperatorRequestRowDto[];
  @ApiProperty({ type: String, nullable: true }) next_cursor: string | null;
}

/** Offer by a managed shop, with seller-side deal flags and audit. */
export class OperatorOfferDto extends OfferDto {
  @ApiProperty() interaction_state: string;
  @ApiProperty() buyer_cancel_pending_ack: boolean;
  @ApiProperty() deal_active: boolean;
  @ApiProperty() buyer_marked_complete: boolean;
  @ApiProperty() seller_marked_complete: boolean;
  @ApiProperty() buyer_marked_cancel: boolean;
  @ApiProperty() seller_marked_cancel: boolean;
  @ApiPropertyOptional({ type: String, nullable: true }) created_by_user_id:
    | string
    | null;
  @ApiProperty() request_summary: string;
  @ApiProperty() request_status: string;
}

export class OperatorRequestDetailDto extends RequestPublicDto {
  @ApiProperty({ type: [OperatorOfferDto] })
  persona_offers: OperatorOfferDto[];
  @ApiPropertyOptional({ type: String, nullable: true })
  active_acceptance_offer_id: string | null;
}

export class OperatorOffersResponseDto {
  @ApiProperty() total: number;
  @ApiProperty({ type: [OperatorOfferDto] }) items: OperatorOfferDto[];
}

export class OkResponseDto {
  @ApiProperty({ example: true }) ok: boolean;
}

export class OperatorDealCompleteResultDto {
  @ApiProperty() ok: boolean;
  @ApiProperty() finalized: boolean;
}

// ── Inventory ──

export class CategoryLabelsDto {
  @ApiProperty() hy: string;
  @ApiProperty() ru: string;
  @ApiProperty() en: string;
}

export class PartCategoryDto {
  @ApiProperty() key: string;
  @ApiProperty({ type: CategoryLabelsDto }) labels: CategoryLabelsDto;
}

export class PartCategoryGroupDto extends PartCategoryDto {
  @ApiProperty({ type: [PartCategoryDto] }) children: PartCategoryDto[];
}

export class InventoryFitmentDto {
  @ApiProperty() make: string;
  @ApiPropertyOptional({ type: String, nullable: true }) model: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) year_from:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) year_to: number | null;
  @ApiPropertyOptional({ type: String, nullable: true }) engine: string | null;
}

export class InventoryItemPhotoDto {
  @ApiProperty() storage_key: string;
  @ApiProperty() sort_order: number;
}

export class InventoryItemDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ['draft', 'active', 'archived'] })
  status: 'draft' | 'active' | 'archived';
  @ApiPropertyOptional({ type: String, nullable: true }) brand: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) part_number:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  part_number_normalized: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) barcode: string | null;
  @ApiProperty({ type: [String] }) oem_numbers: string[];
  @ApiProperty() name: string;
  @ApiPropertyOptional({ type: String, nullable: true }) name_hy: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) name_en: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) category_key:
    | string
    | null;
  @ApiProperty({ type: [InventoryFitmentDto] })
  fitments: InventoryFitmentDto[];
  @ApiPropertyOptional({ type: String, nullable: true }) fitment_note:
    | string
    | null;
  @ApiProperty({ enum: ['new', 'used'] }) condition: 'new' | 'used';
  @ApiPropertyOptional({ type: Number, nullable: true }) price_amount:
    | number
    | null;
  @ApiProperty() price_currency: string;
  @ApiProperty() quantity: number;
  @ApiPropertyOptional({ type: String, nullable: true }) shelf_location:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) note: string | null;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'number' },
    nullable: true,
  })
  ai_confidence: Record<string, number> | null;
  @ApiProperty({ type: [String] }) needs_review: string[];
  @ApiPropertyOptional({ type: String, nullable: true }) recognition_id:
    | string
    | null;
  @ApiProperty({ type: [InventoryItemPhotoDto] })
  photos: InventoryItemPhotoDto[];
  @ApiProperty() created_at: string;
  @ApiProperty() updated_at: string;
}

export class InventoryItemListResponseDto {
  @ApiProperty({ type: [InventoryItemDto] }) items: InventoryItemDto[];
  @ApiPropertyOptional({ type: String, nullable: true }) next_cursor:
    | string
    | null;
}

export class InventoryStatsDto {
  @ApiProperty() active: number;
  @ApiProperty() drafts: number;
  @ApiProperty() out_of_stock: number;
}

export class ShopCatalogItemDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ type: String, nullable: true }) name_hy: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) name_en: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) brand: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) part_number:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) barcode: string | null;
  @ApiProperty({ type: [String] }) oem_numbers: string[];
  @ApiPropertyOptional({ type: String, nullable: true }) category_key:
    | string
    | null;
  @ApiProperty({ type: [InventoryFitmentDto] })
  fitments: InventoryFitmentDto[];
  @ApiPropertyOptional({ type: String, nullable: true }) fitment_note:
    | string
    | null;
  @ApiProperty({ enum: ['new', 'used'] }) condition: 'new' | 'used';
  @ApiPropertyOptional({ type: Number, nullable: true }) price_amount:
    | number
    | null;
  @ApiProperty() price_currency: string;
  @ApiProperty() in_stock: boolean;
  @ApiProperty({ type: [InventoryItemPhotoDto] })
  photos: InventoryItemPhotoDto[];
  @ApiProperty() created_at: string;
}

export class ShopCatalogListResponseDto {
  @ApiProperty({ type: [ShopCatalogItemDto] }) items: ShopCatalogItemDto[];
  @ApiPropertyOptional({ type: String, nullable: true }) next_cursor:
    | string
    | null;
}

export class RecognitionFitmentDto {
  @ApiProperty() make: string;
  @ApiPropertyOptional({ type: String, nullable: true }) model: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) year_from:
    | number
    | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) year_to: number | null;
  @ApiPropertyOptional({ type: String, nullable: true }) engine: string | null;
}

export class RecognitionConfidenceDto {
  @ApiProperty({ minimum: 0, maximum: 1 }) brand: number;
  @ApiProperty({ minimum: 0, maximum: 1 }) part_number: number;
  @ApiProperty({ minimum: 0, maximum: 1 }) barcode: number;
  @ApiProperty({ minimum: 0, maximum: 1 }) name: number;
  @ApiProperty({ minimum: 0, maximum: 1 }) category_key: number;
  @ApiProperty({ minimum: 0, maximum: 1 }) fitments: number;
}

export class RecognitionResultDto {
  @ApiPropertyOptional({ type: String, nullable: true }) brand: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) part_number:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) barcode: string | null;
  @ApiProperty({ description: 'Russian name' }) name: string;
  @ApiPropertyOptional({ type: String, nullable: true }) name_en: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) name_hy: string | null;
  @ApiProperty() category_key: string;
  @ApiProperty({ type: [String] }) oem_numbers: string[];
  @ApiProperty({ type: [RecognitionFitmentDto] })
  fitments: RecognitionFitmentDto[];
  @ApiPropertyOptional({ type: String, nullable: true }) fitment_note:
    | string
    | null;
  @ApiProperty({ enum: ['new', 'used'] }) condition: 'new' | 'used';
  @ApiProperty({ type: RecognitionConfidenceDto })
  confidence: RecognitionConfidenceDto;
  @ApiProperty({ type: [String] }) needs_review: string[];
  @ApiPropertyOptional({ type: String, nullable: true }) notes_for_seller:
    | string
    | null;
}

export class InventoryRecognitionDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ['pending', 'processing', 'done', 'failed'] })
  status: 'pending' | 'processing' | 'done' | 'failed';
  @ApiPropertyOptional({ type: RecognitionResultDto, nullable: true })
  result: RecognitionResultDto | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  possible_duplicate_item_id: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) error_code:
    | string
    | null;
  @ApiProperty({ type: [String] }) photo_storage_keys: string[];
  @ApiPropertyOptional({ type: String, nullable: true }) barcode_hint:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) text_hint:
    | string
    | null;
  @ApiProperty() created_at: string;
  @ApiPropertyOptional({ type: String, nullable: true }) finished_at:
    | string
    | null;
}
