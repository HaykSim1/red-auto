import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Offer } from '../database/entities/offer.entity';
import { PartRequest } from '../database/entities/part-request.entity';
import { User } from '../database/entities/user.entity';
import { OffersModule } from '../offers/offers.module';
import { RequestsModule } from '../requests/requests.module';
import { SelectionsModule } from '../selections/selections.module';
import { OperatorController } from './operator.controller';
import { OperatorService } from './operator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Offer, PartRequest]),
    OffersModule,
    RequestsModule,
    SelectionsModule,
  ],
  controllers: [OperatorController],
  providers: [OperatorService],
})
export class OperatorModule {}
