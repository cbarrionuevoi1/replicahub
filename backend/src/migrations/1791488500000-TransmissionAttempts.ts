import { MigrationInterface, QueryRunner } from 'typeorm';

/** No elimina información existente; el detalle histórico se llena a partir del despliegue. */
export class TransmissionAttempts1791488500000 implements MigrationInterface {
  name = 'TransmissionAttempts1791488500000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE transmissions ADD COLUMN IF NOT EXISTS "lastAttemptAt" timestamp`);
    await q.query(`ALTER TABLE transmissions ADD COLUMN IF NOT EXISTS "lastResponseAt" timestamp`);
    await q.query(`ALTER TABLE transmissions ADD COLUMN IF NOT EXISTS "cycleAttempts" integer NOT NULL DEFAULT 0`);
    await q.query(`CREATE TABLE IF NOT EXISTS transmission_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "transmissionId" uuid NOT NULL REFERENCES transmissions(id) ON DELETE CASCADE,
      "attemptNo" integer NOT NULL,
      "attemptedAt" timestamp NOT NULL,
      "completedAt" timestamp NOT NULL DEFAULT now(),
      status varchar(30) NOT NULL,
      "httpCode" integer,
      "durationMs" integer,
      "payloadSent" json,
      "responseReceived" json,
      error text,
      CONSTRAINT "UQ_transmission_attempt_number" UNIQUE ("transmissionId", "attemptNo")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_attempts_transmission" ON transmission_attempts ("transmissionId", "attemptNo")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_transmissions_last_attempt" ON transmissions ("lastAttemptAt")`);
  }
  async down(_q: QueryRunner): Promise<void> {
    throw new Error('No se borra el historial de intentos de retransmisión.');
  }
}
