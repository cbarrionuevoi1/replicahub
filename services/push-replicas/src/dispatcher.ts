import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const CURSOR_FILE = path.join(__dirname, '..', 'cursor.json');

export class Dispatcher {
  private pool: Pool;
  private isRunning = false;
  private lastReceivedAt: Date;

  constructor(pool: Pool) {
    this.pool = pool;
    this.lastReceivedAt = this.loadCursor();
  }

  private loadCursor(): Date {
    try {
      if (fs.existsSync(CURSOR_FILE)) {
        const data = JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf-8'));
        if (data.lastReceivedAt) {
          return new Date(data.lastReceivedAt);
        }
      }
    } catch (err) {
      console.error('[Dispatcher] Error loading cursor:', err);
    }
    // Default to starting from NOW to avoid processing millions of old rows
    return new Date();
  }

  private saveCursor() {
    try {
      fs.writeFileSync(CURSOR_FILE, JSON.stringify({ lastReceivedAt: this.lastReceivedAt.toISOString() }));
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
          p."receivedAt", 
          p.imei, 
          u.plate,
          u.id as "unitId",
          c.name as "clientName",
          ur."repeaterId", 
          ur.config,
          r.name as "repeaterName",
          r.code as "repeaterCode"
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
        
        for (const row of rows) {
          // Insert into transmissions (PENDING)
          // We use INSERT ... ON CONFLICT DO NOTHING just in case, but positionId + repeaterId isn't uniquely constrained natively, so we just insert.
          await this.pool.query(`
            INSERT INTO transmissions (
              "unitId", "plate", "imei", "clientName", "repeaterId", "repeaterName", "status", "positionId"
            ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
          `, [
            row.unitId, row.plate, row.imei, row.clientName, row.repeaterId, row.repeaterName, row.positionId
          ]);

          if (new Date(row.receivedAt) > maxReceivedAt) {
            maxReceivedAt = new Date(row.receivedAt);
          }
        }

        this.lastReceivedAt = maxReceivedAt;
        this.saveCursor();
        console.log(`[Dispatcher] Created ${rows.length} transmission jobs.`);
      }
    } catch (err) {
      console.error('[Dispatcher] Poll error:', err);
    } finally {
      this.isRunning = false;
    }
  }

  start(intervalMs = 2000) {
    console.log(`[Dispatcher] Started polling for new positions (cursor: ${this.lastReceivedAt.toISOString()})`);
    setInterval(() => this.poll(), intervalMs);
  }
}
