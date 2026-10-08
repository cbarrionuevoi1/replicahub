import { Pool, PoolClient } from 'pg';

/**
 * Cursor (receivedAt, uuid): dos posiciones pueden compartir el mismo timestamp.
 * Se seleccionan POSICIONES, no filas del JOIN, para evitar saltar un lote muy grande.
 */
export class Dispatcher {
  private isRunning = false;
  constructor(private readonly pool: Pool) {}

  async poll(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      // Serializa múltiples dispatchers sin perder el cursor.
      const cursor = await client.query(`
        SELECT "lastReceivedAt", "lastPositionId" FROM service_cursors
        WHERE id = 'dispatcher' FOR UPDATE
      `);
      if (!cursor.rows.length) throw new Error('Ejecuta la migración de cursores antes de iniciar el dispatcher.');
      const lastTime = cursor.rows[0].lastReceivedAt as Date;
      const lastId = cursor.rows[0].lastPositionId as string | null;
      const batch = await client.query(`
        WITH next_positions AS (
          SELECT id, "receivedAt" FROM positions
          WHERE ("receivedAt", id) > ($1::timestamp, $2::uuid)
          ORDER BY "receivedAt", id LIMIT 200
        )
        SELECT p.id AS "positionId", p."receivedAt", p."eventTime",
               p."rawMessageId", u.id AS "unitId", u.plate, COALESCE(u.imei, p.imei) AS imei, c.name AS "clientName",
               r.id AS "repeaterId", r.name AS "repeaterName"
        FROM next_positions n
        JOIN positions p ON p.id = n.id
        LEFT JOIN units u ON p."unitId" = u.id AND u.active = TRUE
        LEFT JOIN clients c ON u."clientId" = c.id
        LEFT JOIN unit_repeaters ur ON ur."unitId" = u.id AND ur.active = TRUE
        LEFT JOIN repeaters r ON r.id = ur."repeaterId" AND r.active = TRUE
        ORDER BY p."receivedAt", p.id, r.id
      `, [lastTime, lastId ?? '00000000-0000-0000-0000-000000000000']);

      let queued = 0;
      for (const row of batch.rows) {
        if (!row.repeaterId || !row.unitId || !row.plate) continue;
        const inserted = await client.query(`
          INSERT INTO transmissions (
            "unitId", plate, imei, "clientName", "repeaterId", "repeaterName",
            status, attempts, "positionId", "rawMessageId", "eventTime", "receivedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', 0, $7, $8, $9, $10)
          ON CONFLICT ("positionId", "repeaterId") WHERE "positionId" IS NOT NULL DO NOTHING
        `, [row.unitId, row.plate, row.imei, row.clientName, row.repeaterId,
            row.repeaterName, row.positionId, row.rawMessageId, row.eventTime, row.receivedAt]);
        queued += inserted.rowCount ?? 0;
      }
      if (batch.rows.length) {
        const last = batch.rows[batch.rows.length - 1];
        await client.query(`
          UPDATE service_cursors SET "lastReceivedAt" = $1, "lastPositionId" = $2
          WHERE id = 'dispatcher'
        `, [last.receivedAt, last.positionId]);
      }
      await client.query('COMMIT');
      if (queued) console.log(`[Dispatcher] ${queued} transmisiones añadidas a la cola.`);
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => undefined);
      console.error('[Dispatcher] Error:', error);
    } finally {
      client?.release();
      this.isRunning = false;
    }
  }

  async start(intervalMs = 3000): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS service_cursors (
        id varchar(50) PRIMARY KEY,
        "lastReceivedAt" timestamp NOT NULL,
        "lastPositionId" uuid
      )
    `);
    // Compatible con la tabla de cursor instalada en versiones anteriores.
    await this.pool.query(`ALTER TABLE service_cursors ADD COLUMN IF NOT EXISTS "lastPositionId" uuid`);
    const minutes = Math.max(0, Number(process.env.DISPATCHER_BACKFILL_MINUTES ?? 1440) || 0);
    await this.pool.query(`
      INSERT INTO service_cursors(id, "lastReceivedAt", "lastPositionId")
      VALUES ('dispatcher', NOW() - ($1 * interval '1 minute'), NULL)
      ON CONFLICT (id) DO NOTHING
    `, [minutes]);
    await this.poll();
    setInterval(() => void this.poll(), intervalMs);
  }
}
