export enum UserRole {
  USER = 'user',
  SELLER = 'seller',
  ADMIN = 'admin',
}

export enum PreferredLocale {
  HY = 'hy',
  RU = 'ru',
  EN = 'en',
}

export enum PartRequestStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

export enum ModerationState {
  VISIBLE = 'visible',
  HIDDEN = 'hidden',
}

export enum OfferCondition {
  NEW = 'new',
  USED = 'used',
}

export enum OfferDelivery {
  AVAILABLE = 'available',
  PICKUP_ONLY = 'pickup_only',
}

export enum DevicePlatform {
  IOS = 'ios',
  ANDROID = 'android',
}

/** Buyer/seller lifecycle on an offer — see docs/api.md */
export enum OfferInteractionState {
  NONE = 'none',
  CONTACT_REVEALED = 'contact_revealed',
  BUYER_CANCELLED = 'buyer_cancelled',
  /** Both parties cancelled the accepted deal (mutual cancel flow). */
  MUTUALLY_CANCELLED = 'mutually_cancelled',
  DEAL_COMPLETED = 'deal_completed',
  SUPERSEDED = 'superseded',
}

export enum SellerApplicationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}
