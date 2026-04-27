import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AppVersionModule } from './app-version/app-version.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { ClientConfigController } from './client-config/client-config.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { DevicesModule } from './devices/devices.module';
import { HomeModule } from './home/home.module';
import { OffersModule } from './offers/offers.module';
import { PushModule } from './push/push.module';
import { RatingsModule } from './ratings/ratings.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RequestsModule } from './requests/requests.module';
import { SelectionsModule } from './selections/selections.module';
import { SellerApplicationsModule } from './seller-applications/seller-applications.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    CommonModule,
    PushModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.get<number>('THROTTLE_TTL_MS') ?? 60_000,
            limit: config.get<number>('THROTTLE_LIMIT') ?? 60,
          },
        ],
      }),
    }),
    AuthModule,
    UsersModule,
    SellerApplicationsModule,
    VehiclesModule,
    HomeModule,
    RequestsModule,
    OffersModule,
    SelectionsModule,
    RatingsModule,
    DevicesModule,
    UploadsModule,
    RealtimeModule,
    AdminModule,
    AnalyticsModule,
    AppVersionModule,
  ],
  controllers: [AppController, ClientConfigController],
  providers: [AppService],
})
export class AppModule {}
