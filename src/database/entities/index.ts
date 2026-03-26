import { Device } from './device.entity';
import { OfferPhoto } from './offer-photo.entity';
import { Offer } from './offer.entity';
import { OtpSession } from './otp-session.entity';
import { PartRequest } from './part-request.entity';
import { RequestPhoto } from './request-photo.entity';
import { Selection } from './selection.entity';
import { SellerApplication } from './seller-application.entity';
import { SellerRatingAggregate } from './seller-rating-aggregate.entity';
import { SellerRating } from './seller-rating.entity';
import { User } from './user.entity';
import { Vehicle } from './vehicle.entity';

export const typeOrmEntities = [
  User,
  OtpSession,
  Vehicle,
  PartRequest,
  RequestPhoto,
  Offer,
  OfferPhoto,
  Selection,
  SellerRating,
  SellerRatingAggregate,
  Device,
  SellerApplication,
] as const;

export {
  Device,
  Offer,
  OfferPhoto,
  OtpSession,
  PartRequest,
  RequestPhoto,
  Selection,
  SellerApplication,
  SellerRating,
  SellerRatingAggregate,
  User,
  Vehicle,
};
