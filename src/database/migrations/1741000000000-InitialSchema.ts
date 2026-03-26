import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1741000000000 implements MigrationInterface {
  name = 'InitialSchema1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "user_role_enum" AS ENUM ('user', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TYPE "preferred_locale_enum" AS ENUM ('hy', 'ru', 'en')`,
    );
    await queryRunner.query(
      `CREATE TYPE "part_request_status_enum" AS ENUM ('open', 'closed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "moderation_state_enum" AS ENUM ('visible', 'hidden')`,
    );
    await queryRunner.query(
      `CREATE TYPE "offer_condition_enum" AS ENUM ('new', 'used')`,
    );
    await queryRunner.query(
      `CREATE TYPE "offer_delivery_enum" AS ENUM ('available', 'pickup_only')`,
    );
    await queryRunner.query(
      `CREATE TYPE "device_platform_enum" AS ENUM ('ios', 'android')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "phone" text NOT NULL,
        "role" "user_role_enum" NOT NULL DEFAULT 'user',
        "blocked_at" TIMESTAMPTZ,
        "display_name" text,
        "preferred_locale" "preferred_locale_enum",
        "seller_phone" text,
        "seller_telegram" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_phone" UNIQUE ("phone")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_users_role" ON "users" ("role")`,
    );

    await queryRunner.query(`
      CREATE TABLE "otp_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "phone" text NOT NULL,
        "code_hash" text NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "attempt_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_otp_sessions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "vehicles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "brand" text,
        "model" text,
        "year" smallint,
        "engine" text,
        "vin" text,
        "label" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vehicles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vehicles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_vehicles_identity" CHECK (
          ("vin" IS NOT NULL AND btrim("vin") <> '')
          OR ("brand" IS NOT NULL AND "model" IS NOT NULL AND "year" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_vehicles_user_id" ON "vehicles" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "part_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "author_id" uuid NOT NULL,
        "vehicle_id" uuid,
        "description" text NOT NULL,
        "vin_text" text,
        "part_number" text,
        "status" "part_request_status_enum" NOT NULL DEFAULT 'open',
        "region" text NOT NULL DEFAULT 'AM',
        "moderation_state" "moderation_state_enum" NOT NULL DEFAULT 'visible',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_part_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_part_requests_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_part_requests_vehicle" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_part_requests_status_region" ON "part_requests" ("status", "region")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_part_requests_author_created" ON "part_requests" ("author_id", "created_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE "request_photos" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "request_id" uuid NOT NULL,
        "storage_key" text NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_request_photos" PRIMARY KEY ("id"),
        CONSTRAINT "FK_request_photos_request" FOREIGN KEY ("request_id") REFERENCES "part_requests"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_request_photos_request_sort" ON "request_photos" ("request_id", "sort_order")`,
    );

    await queryRunner.query(`
      CREATE TABLE "offers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "request_id" uuid NOT NULL,
        "seller_id" uuid NOT NULL,
        "price_amount" decimal(12,2) NOT NULL,
        "price_currency" char(3) NOT NULL DEFAULT 'AMD',
        "condition" "offer_condition_enum" NOT NULL,
        "delivery" "offer_delivery_enum" NOT NULL,
        "description" text NOT NULL,
        "moderation_state" "moderation_state_enum" NOT NULL DEFAULT 'visible',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_offers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_offers_request_seller" UNIQUE ("request_id", "seller_id"),
        CONSTRAINT "FK_offers_request" FOREIGN KEY ("request_id") REFERENCES "part_requests"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_offers_seller" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_offers_request_id" ON "offers" ("request_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_offers_seller_id" ON "offers" ("seller_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "offer_photos" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "offer_id" uuid NOT NULL,
        "storage_key" text NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_offer_photos" PRIMARY KEY ("id"),
        CONSTRAINT "FK_offer_photos_offer" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_offer_photos_offer_sort" ON "offer_photos" ("offer_id", "sort_order")`,
    );

    await queryRunner.query(`
      CREATE TABLE "selections" (
        "request_id" uuid NOT NULL,
        "chosen_offer_id" uuid NOT NULL,
        "selected_at" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_selections" PRIMARY KEY ("request_id"),
        CONSTRAINT "FK_selections_request" FOREIGN KEY ("request_id") REFERENCES "part_requests"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_selections_offer" FOREIGN KEY ("chosen_offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "seller_ratings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "request_id" uuid NOT NULL,
        "rater_id" uuid NOT NULL,
        "seller_id" uuid NOT NULL,
        "score" smallint NOT NULL,
        "comment" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_seller_ratings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_seller_ratings_request_rater" UNIQUE ("request_id", "rater_id"),
        CONSTRAINT "FK_seller_ratings_request" FOREIGN KEY ("request_id") REFERENCES "part_requests"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_seller_ratings_rater" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_seller_ratings_seller" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "seller_rating_aggregate" (
        "seller_id" uuid NOT NULL,
        "avg_score" decimal(4,3) NOT NULL,
        "rating_count" integer NOT NULL,
        CONSTRAINT "PK_seller_rating_aggregate" PRIMARY KEY ("seller_id"),
        CONSTRAINT "FK_seller_rating_aggregate_seller" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "devices" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "expo_push_token" text NOT NULL,
        "platform" "device_platform_enum" NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_devices" PRIMARY KEY ("id"),
        CONSTRAINT "FK_devices_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_devices_user_id" ON "devices" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "devices"`);
    await queryRunner.query(`DROP TABLE "seller_rating_aggregate"`);
    await queryRunner.query(`DROP TABLE "seller_ratings"`);
    await queryRunner.query(`DROP TABLE "selections"`);
    await queryRunner.query(`DROP TABLE "offer_photos"`);
    await queryRunner.query(`DROP TABLE "offers"`);
    await queryRunner.query(`DROP TABLE "request_photos"`);
    await queryRunner.query(`DROP TABLE "part_requests"`);
    await queryRunner.query(`DROP TABLE "vehicles"`);
    await queryRunner.query(`DROP TABLE "otp_sessions"`);
    await queryRunner.query(`DROP TABLE "users"`);

    await queryRunner.query(`DROP TYPE "device_platform_enum"`);
    await queryRunner.query(`DROP TYPE "offer_delivery_enum"`);
    await queryRunner.query(`DROP TYPE "offer_condition_enum"`);
    await queryRunner.query(`DROP TYPE "moderation_state_enum"`);
    await queryRunner.query(`DROP TYPE "part_request_status_enum"`);
    await queryRunner.query(`DROP TYPE "preferred_locale_enum"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
  }
}
