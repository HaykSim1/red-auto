import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTOs for OpenAPI spec generation.
 * These classes are not used at runtime validation — only for Swagger schema output.
 */

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
  @ApiPropertyOptional({ type: String, nullable: true }) logo_storage_key: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) rejection_reason: string | null;
  @ApiProperty() created_at: string;
}

export class MeResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() phone: string;
  @ApiProperty({ enum: ['user', 'seller', 'admin'] }) role: string;
  @ApiPropertyOptional({ type: String, nullable: true }) display_name: string | null;
  @ApiPropertyOptional({ type: String, enum: ['hy', 'ru', 'en'], nullable: true }) preferred_locale: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seller_phone: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seller_telegram: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_name: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_address: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_logo_storage_key: string | null;
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
  @ApiPropertyOptional({ type: String, nullable: true }) shop_logo_storage_key: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) rating_avg: number | null;
  @ApiProperty() rating_count: number;
}

export class ShopReviewDto {
  @ApiProperty() id: string;
  @ApiProperty() score: number;
  @ApiPropertyOptional({ type: String, nullable: true }) comment: string | null;
  @ApiProperty() created_at: string;
}

export class ShopDetailResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() shop_name: string;
  @ApiPropertyOptional({ type: String, nullable: true }) shop_logo_storage_key: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) description: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) rating_avg: number | null;
  @ApiProperty() rating_count: number;
  @ApiProperty({ type: [ShopReviewDto] }) reviews: ShopReviewDto[];
}

// ── Offers (serialized) ──

export class OfferSellerDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional({ type: String, nullable: true }) display_name: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) rating_avg: number | null;
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
  @ApiPropertyOptional({ type: String, nullable: true }) variant_label: string | null;
  @ApiProperty() moderation_state: string;
  @ApiProperty() created_at: string;
  @ApiProperty({ type: [PhotoDto] }) photos: PhotoDto[];
  @ApiProperty({ type: () => OfferSellerDto }) seller: OfferSellerDto;
  @ApiPropertyOptional({ type: Boolean }) seller_identity_hidden: boolean;
}

// ── Requests ──

export class RequestListItemDto {
  @ApiProperty() id: string;
  @ApiProperty() description: string;
  @ApiProperty() status: string;
  @ApiProperty() region: string;
  @ApiProperty() moderation_state: string;
  @ApiProperty() created_at: string;
  @ApiProperty({ type: String, nullable: true }) cover_storage_key: string | null;
  @ApiProperty({ type: () => VehicleDto, nullable: true }) vehicle: VehicleDto | null;
}

export class PaginatedRequestListDto {
  @ApiProperty({ type: [RequestListItemDto] }) items: RequestListItemDto[];
  @ApiProperty({ type: String, nullable: true }) next_cursor: string | null;
}

export class RequestPublicDto {
  @ApiProperty() id: string;
  @ApiProperty() description: string;
  @ApiPropertyOptional({ type: String, nullable: true }) vin_text: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) part_number: string | null;
  @ApiProperty() status: string;
  @ApiProperty() region: string;
  @ApiProperty() created_at: string;
  @ApiPropertyOptional({ type: String, nullable: true }) cover_storage_key: string | null;
  @ApiPropertyOptional({ type: () => VehicleDto, nullable: true }) vehicle: VehicleDto | null;
  @ApiProperty({ type: [PhotoDto] }) photos: PhotoDto[];
}

export class RequestAuthorDetailDto extends RequestPublicDto {
  @ApiProperty({ type: [OfferDto] }) offers: OfferDto[];
  @ApiPropertyOptional({ type: String, nullable: true }) active_acceptance_offer_id: string | null;
}

// ── Selection ──

export class SellerContactDto {
  @ApiPropertyOptional({ type: String, nullable: true }) seller_phone: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) seller_telegram: string | null;
}

export class SelectionResponseDto {
  @ApiProperty() request_id: string;
  @ApiProperty() offer_id: string;
  @ApiProperty() selected_at: string;
  @ApiProperty({ type: () => SellerContactDto }) seller_contact: SellerContactDto;
  @ApiPropertyOptional({ type: Boolean }) provisional: boolean;
  @ApiPropertyOptional({ type: Boolean }) buyer_marked_complete: boolean;
  @ApiPropertyOptional({ type: Boolean }) seller_marked_complete: boolean;
  @ApiPropertyOptional({ type: Boolean }) buyer_marked_cancel: boolean;
  @ApiPropertyOptional({ type: Boolean }) seller_marked_cancel: boolean;
  @ApiPropertyOptional({ type: String, enum: ['buyer', 'seller'], nullable: true }) waiting_for_complete: string | null;
  @ApiPropertyOptional({ type: String, enum: ['buyer', 'seller'], nullable: true }) waiting_for_cancel: string | null;
}

// ── Presign ──

export class PresignResponseDto {
  @ApiProperty() url: string;
  @ApiProperty({ enum: ['PUT'] }) method: string;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } }) headers: Record<string, string>;
  @ApiProperty() storage_key: string;
  @ApiProperty() expires_in: number;
}
