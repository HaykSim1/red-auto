import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartRequest } from '../database/entities/part-request.entity';
import { RequestPhoto } from '../database/entities/request-photo.entity';
import { OffersModule } from '../offers/offers.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PartRequest, RequestPhoto]),
    VehiclesModule,
    OffersModule,
    RealtimeModule,
  ],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
