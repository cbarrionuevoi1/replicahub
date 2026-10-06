import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1727982000000 implements MigrationInterface {
  name = 'InitialSchema1727982000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // clients
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clients" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "businessName" character varying,
        "ruc" character varying,
        "contact" character varying,
        "email" character varying,
        "phone" character varying,
        "notes" text,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_clients" PRIMARY KEY ("id")
      )
    `);

    // repeaters
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "repeaters" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "description" character varying,
        "type" character varying NOT NULL,
        "url" character varying NOT NULL,
        "method" character varying NOT NULL DEFAULT 'POST',
        "timeout" integer NOT NULL DEFAULT 5000,
        "headers" json,
        "auth" json,
        "maxRetries" integer NOT NULL DEFAULT 3,
        "config" json,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_repeaters" PRIMARY KEY ("id")
      )
    `);

    // units
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "units" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "plate" character varying NOT NULL,
        "imei" character varying NOT NULL,
        "clientId" uuid,
        "alias" character varying,
        "active" boolean NOT NULL DEFAULT true,
        "firstTransmissionAt" TIMESTAMP,
        "lastTransmissionAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_units_plate" UNIQUE ("plate"),
        CONSTRAINT "UQ_units_imei" UNIQUE ("imei"),
        CONSTRAINT "PK_units" PRIMARY KEY ("id"),
        CONSTRAINT "FK_units_client" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL
      )
    `);

    // unit_repeaters
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "unit_repeaters" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "unitId" uuid NOT NULL,
        "repeaterId" uuid NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_unit_repeaters" PRIMARY KEY ("id"),
        CONSTRAINT "FK_unit_repeaters_unit" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_unit_repeaters_repeater" FOREIGN KEY ("repeaterId") REFERENCES "repeaters"("id") ON DELETE CASCADE
      )
    `);

    // detected_units
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "detected_units" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "imei" character varying NOT NULL,
        "firstSeenAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lastSeenAt" TIMESTAMP NOT NULL DEFAULT now(),
        "totalMessages" integer NOT NULL DEFAULT 0,
        "linked" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_detected_units" PRIMARY KEY ("id")
      )
    `);

    // raw_messages
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "raw_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "imei" character varying NOT NULL,
        "rawData" text NOT NULL,
        "receivedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_raw_messages" PRIMARY KEY ("id")
      )
    `);

    // positions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "positions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "unitId" uuid,
        "imei" character varying NOT NULL,
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "speed" double precision,
        "heading" double precision,
        "altitude" double precision,
        "satellites" integer,
        "accuracy" double precision,
        "eventTime" TIMESTAMP NOT NULL,
        "receivedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "rawData" json,
        CONSTRAINT "PK_positions" PRIMARY KEY ("id")
      )
    `);

    // transmissions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transmissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "unitId" uuid NOT NULL,
        "plate" character varying NOT NULL,
        "imei" character varying NOT NULL,
        "clientName" character varying,
        "repeaterId" uuid NOT NULL,
        "repeaterName" character varying NOT NULL,
        "status" character varying NOT NULL,
        "httpCode" integer,
        "durationMs" integer,
        "attempts" integer NOT NULL DEFAULT 1,
        "eventTime" TIMESTAMP,
        "receivedAt" TIMESTAMP,
        "payloadSent" json,
        "responseReceived" json,
        "error" text,
        "positionId" uuid,
        "rawMessageId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transmissions" PRIMARY KEY ("id")
      )
    `);

    // users
    await queryRunner.query(`
      CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'OPERATOR')
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "username" character varying NOT NULL,
        "email" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'OPERATOR',
        "active" boolean NOT NULL DEFAULT true,
        "lastLoginAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // user_sessions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "refreshTokenHash" character varying NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "ipAddress" character varying,
        "userAgent" character varying,
        "revokedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_sessions_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // audit_logs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid,
        "action" character varying NOT NULL,
        "entityType" character varying,
        "entityId" character varying,
        "details" json,
        "ipAddress" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_logs_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // report_exports
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_exports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "format" character varying NOT NULL,
        "filters" json,
        "rowCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_exports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_report_exports_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX "IDX_users_role" ON "users" ("role")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_active" ON "users" ("active")`);
    await queryRunner.query(`CREATE INDEX "IDX_transmissions_createdAt" ON "transmissions" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_transmissions_unitId" ON "transmissions" ("unitId")`);
    await queryRunner.query(`CREATE INDEX "IDX_transmissions_repeaterId" ON "transmissions" ("repeaterId")`);
    await queryRunner.query(`CREATE INDEX "IDX_transmissions_status" ON "transmissions" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_units_clientId" ON "units" ("clientId")`);
    await queryRunner.query(`CREATE INDEX "IDX_report_exports_userId" ON "report_exports" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_userId" ON "audit_logs" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_createdAt" ON "audit_logs" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "report_exports"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transmissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "positions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "raw_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "detected_units"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "unit_repeaters"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "units"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "repeaters"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clients"`);
  }
}
