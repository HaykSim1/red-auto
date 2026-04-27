import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerRating } from '../database/entities/seller-rating.entity';
import { SellerRatingAggregate } from '../database/entities/seller-rating-aggregate.entity';
import { User } from '../database/entities/user.entity';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  imports: [TypeOrmModule.forFeature([SellerRating, SellerRatingAggregate, User])],
  controllers: [RatingsController],
  providers: [RatingsService],
})
export class RatingsModule {}
