import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HomeBanner } from '../database/entities/home-banner.entity';
import { Offer } from '../database/entities/offer.entity';
import { PartRequest } from '../database/entities/part-request.entity';
import { SellerRating } from '../database/entities/seller-rating.entity';
import { User } from '../database/entities/user.entity';
import { HomeBannersService } from './home-banners.service';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { ShopsController } from './shops.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PartRequest,
      Offer,
      User,
      SellerRating,
      HomeBanner,
    ]),
  ],
  controllers: [HomeController, ShopsController],
  providers: [HomeService, HomeBannersService],
  exports: [HomeBannersService],
})
export class HomeModule {}
