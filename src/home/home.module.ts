import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Offer } from '../database/entities/offer.entity';
import { PartRequest } from '../database/entities/part-request.entity';
import { User } from '../database/entities/user.entity';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { ShopsController } from './shops.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PartRequest, Offer, User])],
  controllers: [HomeController, ShopsController],
  providers: [HomeService],
})
export class HomeModule {}
