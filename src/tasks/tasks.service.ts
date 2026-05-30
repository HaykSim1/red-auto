import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PartRequestStatus } from '../database/enums';

const STALE_DAYS = 14;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** 04:00 UTC daily — close OPEN requests that have been waiting longer than 14 days. */
  @Cron('0 4 * * *', { timeZone: 'UTC' })
  async autoCloseStaleRequests(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.ds.query<{ rowCount: number }>(
      `UPDATE part_requests
          SET status = $1,
              active_acceptance_offer_id = NULL
        WHERE status = $2
          AND created_at < $3`,
      [PartRequestStatus.CLOSED, PartRequestStatus.OPEN, cutoff],
    );
    const affected: number = (result as unknown as { rowCount: number }).rowCount ?? 0;
    if (affected > 0) {
      this.logger.log(`Auto-closed ${affected} stale request(s) older than ${STALE_DAYS} days.`);
    }
  }
}
