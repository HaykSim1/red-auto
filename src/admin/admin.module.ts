import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AppVersionConfig } from '../database/entities/app-version-config.entity';
import { Offer } from '../database/entities/offer.entity';
import { PartRequest } from '../database/entities/part-request.entity';
import { SellerApplication } from '../database/entities/seller-application.entity';
import { User } from '../database/entities/user.entity';
import { HomeModule } from '../home/home.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, PartRequest, Offer, SellerApplication, AppVersionConfig]),
    AuthModule,
    HomeModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
