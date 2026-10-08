import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReliableTransmissionQueue1791488000000 implements MigrationInterface {
  name = 'ReliableTransmissionQueue1791488000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_detected_units_imei" ON detected_units (imei)`);
    await q.query(`ALTER TABLE raw_messages ADD COLUMN IF NOT EXISTS "messageHash" varchar(64)`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_raw_message_hash"
      ON raw_messages ("messageHash") WHERE "messageHash" IS NOT NULL`);
    await q.query(`ALTER TABLE positions ADD COLUMN IF NOT EXISTS "rawMessageId" uuid`);
    await q.query(`ALTER TABLE transmissions ADD COLUMN IF NOT EXISTS "nextAttemptAt" timestamp`);
    await q.query(`ALTER TABLE transmissions ADD COLUMN IF NOT EXISTS "processingStartedAt" timestamp`);
    await q.query(`CREATE TABLE IF NOT EXISTS service_cursors (
      id varchar(50) PRIMARY KEY, "lastReceivedAt" timestamp NOT NULL, "lastPositionId" uuid
    )`);
    await q.query(`ALTER TABLE service_cursors ADD COLUMN IF NOT EXISTS "lastPositionId" uuid`);
    // Índice no destructivo. Si existen duplicados históricos la migración falla
    // y obliga a revisarlos manualmente sin borrar ni modificar el historial.
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_transmissions_position_repeater"
      ON transmissions ("positionId", "repeaterId") WHERE "positionId" IS NOT NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_positions_receive_cursor" ON positions ("receivedAt", id)`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_transmissions_retry_due" ON transmissions (status, "nextAttemptAt")`);
    await q.query(`UPDATE transmissions SET attempts = 0 WHERE attempts IS NULL`);
    await q.query(`ALTER TABLE transmissions ALTER COLUMN attempts SET DEFAULT 0`);
  }
  async down(_q: QueryRunner): Promise<void> {
    throw new Error('Reversión bloqueada: contiene datos de seguimiento y reintentos.');
  }
}
