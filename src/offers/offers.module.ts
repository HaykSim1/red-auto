import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SelectionsModule } from '../selections/selections.module';
import { OfferPhoto } from '../database/entities/offer-photo.entity';
import { Offer } from '../database/entities/offer.entity';
import { PartRequest } from '../database/entities/part-request.entity';
import { Selection } from '../database/entities/selection.entity';
import { SellerRatingAggregate } from '../database/entities/seller-rating-aggregate.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { OffersController, OffersOnRequestController } from './offers.controller';
import { OffersService } from './offers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Offer,
      OfferPhoto,
      PartRequest,
      Selection,
      SellerRatingAggregate,
    ]),
    RealtimeModule,
    forwardRef(() => SelectionsModule),
  ],
  controllers: [OffersOnRequestController, OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
