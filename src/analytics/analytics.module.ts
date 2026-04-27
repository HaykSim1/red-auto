import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsMarketplaceDaily } from '../database/entities/analytics-marketplace-daily.entity';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AnalyticsQueryService } from './analytics-query.service';
import { AnalyticsRollupService } from './analytics-rollup.service';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsMarketplaceDaily])],
  controllers: [AdminAnalyticsController],
  providers: [AnalyticsRollupService, AnalyticsQueryService],
  exports: [AnalyticsRollupService, AnalyticsQueryService],
})
export class AnalyticsModule {}
