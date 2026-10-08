import { Pool } from 'pg';

export class Dispatcher {
  private pool: Pool;
  private isRunning = false;
  private lastReceivedAt: Date;

  constructor(pool: Pool) {
    this.pool = pool;
    this.lastReceivedAt = new Date(); // Temporary until init()
  }

  async init() {
    // Ensure the cursor table exists (non-destructive)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS service_cursors (
        id VARCHAR(50) PRIMARY KEY,
        "lastReceivedAt" TIMESTAMP NOT NULL
      )
    `);

    const { rows } = await this.pool.query(`SELECT "lastReceivedAt" FROM service_cursors WHERE id = 'dispatcher'`);
    if (rows.length > 0) {
      this.lastReceivedAt = new Date(rows[0].lastReceivedAt);
    } else {
      // Start from 5 minutes ago if no cursor exists
      this.lastReceivedAt = new Date(Date.now() - 5 * 60 * 1000);
      await this.pool.query(`INSERT INTO service_cursors (id, "lastReceivedAt") VALUES ('dispatcher', $1)`, [this.lastReceivedAt]);
    }
    console.log(`[Dispatcher] Initialized with cursor: ${this.lastReceivedAt.toISOString()}`);
  }

  private async saveCursor() {
    try {
      await this.pool.query(`UPDATE service_cursors SET "lastReceivedAt" = $1 WHERE id = 'dispatcher'`, [this.lastReceivedAt]);
    } catch (err) {
      console.error('[Dispatcher] Error saving cursor:', err);
    }
  }

  async poll() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // Find new positions joined with their active repeaters
      const query = `
        SELECT 
          p.id as "positionId", 
          p."eventTime",
          p."receivedAt", 
          p.imei, 
          u.plate,
          u.id as "unitId",
          c.name as "clientName",
          ur."repeaterId", 
          ur.config,
          r.name as "repeaterName",
          r.type as "repeaterCode"
        FROM positions p
        JOIN units u ON p."unitId" = u.id
        LEFT JOIN clients c ON u."clientId" = c.id
        JOIN unit_repeaters ur ON ur."unitId" = u.id
        JOIN repeaters r ON ur."repeaterId" = r.id
        WHERE p."receivedAt" > $1
          AND ur.active = true
          AND r.active = true
          AND u.active = true
        ORDER BY p."receivedAt" ASC
        LIMIT 500
      `;

      const { rows } = await this.pool.query(query, [this.lastReceivedAt]);

      if (rows.length > 0) {
        let maxReceivedAt = this.lastReceivedAt;
        let insertedCount = 0;
        
        for (const row of rows) {
          // Idempotent insert: only insert if it doesn't already exist for this position and repeater
          const insertQuery = `
            INSERT INTO transmissions (
              "unitId", "plate", "imei", "clientName", "repeaterId", "repeaterName", "status", "positionId", "eventTime", "receivedAt"
            )
            SELECT $1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, $9
            WHERE NOT EXISTS (
              SELECT 1 FROM transmissions 
              WHERE "positionId" = $7 AND "repeaterId" = $5
            )
          `;

          const res = await this.pool.query(insertQuery, [
            row.unitId, row.plate, row.imei, row.clientName, row.repeaterId, row.repeaterName, row.positionId, row.eventTime, row.receivedAt
          ]);

          if (res.rowCount && res.rowCount > 0) {
            insertedCount++;
          }

          if (new Date(row.receivedAt) > maxReceivedAt) {
            maxReceivedAt = new Date(row.receivedAt);
          }
        }

        this.lastReceivedAt = maxReceivedAt;
        await this.saveCursor();
        
        if (insertedCount > 0) {
          console.log(`[Dispatcher] Queued ${insertedCount} new transmission jobs.`);
        }
      }
    } catch (err) {
      console.error('[Dispatcher] Poll error:', err);
    } finally {
      this.isRunning = false;
    }
  }

  async start(intervalMs = 2000) {
    await this.init();
    console.log(`[Dispatcher] Started polling for new positions`);
    setInterval(() => this.poll(), intervalMs);
  }
}
