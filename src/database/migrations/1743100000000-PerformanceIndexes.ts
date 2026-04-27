import { MigrationInterface, QueryRunner } from 'typeorm';

export class PerformanceIndexes1743100000000 implements MigrationInterface {
  name = 'PerformanceIndexes1743100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Offer feed counter: countVisibleOffersByRequestIds filters on
    // (request_id, moderation_state, interaction_state) on every list page load.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_offers_req_mod_state"
       ON "offers" ("request_id", "moderation_state", "interaction_state")`,
    );

    // Stuck-offer guard: countStuckOffersForSeller filters on
    // (seller_id, interaction_state); existing index covers only seller_id.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_offers_seller_interaction"
       ON "offers" ("seller_id", "interaction_state")`,
    );

    // Request author + status: used by HomeService.getSummary counts and
    // countVisibleOffersForUserOpenRequests; existing index covers (author_id, created_at).
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_part_requests_author_status"
       ON "part_requests" ("author_id", "status")`,
    );

    // Open-request feed: listOpen filters status + moderation_state + region then
    // orders by created_at DESC; existing index covers only (status, region).
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_part_requests_open_feed"
       ON "part_requests" ("status", "moderation_state", "region", "created_at" DESC)`,
    );

    // OTP cleanup: cleanupExpired deletes WHERE expires_at < now(); no index existed.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_otp_sessions_expires_at"
       ON "otp_sessions" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_otp_sessions_expires_at"`);
    await queryRunner.query(`DROP INDEX "IDX_part_requests_open_feed"`);
    await queryRunner.query(`DROP INDEX "IDX_part_requests_author_status"`);
    await queryRunner.query(`DROP INDEX "IDX_offers_seller_interaction"`);
    await queryRunner.query(`DROP INDEX "IDX_offers_req_mod_state"`);
  }
}
