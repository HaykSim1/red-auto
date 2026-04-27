import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpStatus,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiException } from '../common/exceptions/api.exception';
import {
  AdminAnalyticsFunnelResponseDto,
  AdminAnalyticsRebuildResponseDto,
  AdminAnalyticsSellersResponseDto,
  AdminAnalyticsSeriesResponseDto,
  AdminAnalyticsSummaryResponseDto,
} from '../common/dto/responses.dto';
import { UserRole } from '../database/enums';
import {
  ANALYTICS_MAX_RANGE_DAYS,
  AnalyticsQueryService,
} from './analytics-query.service';
import { AnalyticsRollupService } from './analytics-rollup.service';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Roles(UserRole.ADMIN)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(
    private readonly query: AnalyticsQueryService,
    private readonly rollup: AnalyticsRollupService,
  ) {}

  private parseRangeOrThrow(fromRaw?: string, toRaw?: string, region?: string) {
    try {
      return this.query.parseRange(fromRaw, toRaw, region);
    } catch (e) {
      const code = (e as Error).message;
      if (code === 'invalid_date') {
        throw new ApiException(
          'invalid_date',
          'Invalid from or to date.',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (code === 'from_after_to') {
        throw new ApiException(
          'invalid_range',
          '`from` must be before `to`.',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (code === 'range_too_large') {
        throw new ApiException(
          'range_too_large',
          `Maximum range is ${ANALYTICS_MAX_RANGE_DAYS} days.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      throw e;
    }
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Marketplace analytics summary (aggregated)',
    description:
      'Liquidity, selection, timing, features, quality headline. Uses daily rollups plus range queries for medians.',
  })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'region', required: false, description: 'ALL or e.g. AM' })
  @ApiOkResponse({ type: AdminAnalyticsSummaryResponseDto })
  summary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('region') region?: string,
  ) {
    const range = this.parseRangeOrThrow(from, to, region);
    return this.query.getSummary(range);
  }

  @Get('funnel')
  @ApiOperation({
    summary: 'Funnel and drop-off metrics',
    description:
      'Server-derived steps from requests/offers/selections; app_open requires future client events.',
  })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'region', required: false })
  @ApiOkResponse({ type: AdminAnalyticsFunnelResponseDto })
  funnel(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('region') region?: string,
  ) {
    const range = this.parseRangeOrThrow(from, to, region);
    return this.query.getFunnel(range);
  }

  @Get('sellers')
  @ApiOperation({ summary: 'Per-seller performance in range (paginated)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'region', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiOkResponse({ type: AdminAnalyticsSellersResponseDto })
  sellers(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('region') region?: string,
  ) {
    const range = this.parseRangeOrThrow(from, to, region);
    return this.query.getSellers(range, limit, offset);
  }

  @Get('series')
  @ApiOperation({ summary: 'Daily series for one metric (from rollup table)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'region', required: false })
  @ApiQuery({
    name: 'metric',
    required: false,
    description:
      'requests_created | offers_created | requests_with_offer | requests_with_selection | active_sellers',
  })
  @ApiOkResponse({ type: AdminAnalyticsSeriesResponseDto })
  series(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('region') region?: string,
    @Query('metric') metric?: string,
  ) {
    const range = this.parseRangeOrThrow(from, to, region);
    return this.query.getSeries(range, metric ?? 'requests_created');
  }

  @Post('rebuild')
  @ApiOperation({
    summary: 'Recompute daily rollup rows (admin backfill)',
    description:
      'Rebuilds `analytics_marketplace_daily` for each UTC day in the range (inclusive).',
  })
  @ApiQuery({
    name: 'from',
    required: true,
    description: 'ISO date or datetime',
  })
  @ApiQuery({ name: 'to', required: true })
  @ApiOkResponse({ type: AdminAnalyticsRebuildResponseDto })
  async rebuild(@Query('from') from: string, @Query('to') to: string) {
    const fromD = new Date(from);
    const toD = new Date(to);
    if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) {
      throw new ApiException(
        'invalid_date',
        'Invalid from or to date.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (fromD.getTime() > toD.getTime()) {
      throw new ApiException(
        'invalid_range',
        '`from` must be before `to`.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const days = (toD.getTime() - fromD.getTime()) / (24 * 60 * 60 * 1000) + 1;
    if (days > ANALYTICS_MAX_RANGE_DAYS) {
      throw new ApiException(
        'range_too_large',
        `Maximum range is ${ANALYTICS_MAX_RANGE_DAYS} days.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const n = await this.rollup.recomputeRangeUtc(fromD, toD);
    return { days_processed: n };
  }
}
