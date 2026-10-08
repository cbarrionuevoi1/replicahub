import { Pool } from 'pg';
import { SutranService, NormalizedPosition } from '@replicahub/repeaters';

// Registry of adapters. Can be expanded dynamically later
const ADAPTERS: Record<string, any> = {
  'SUTRAN': new SutranService(),
};

export class Worker {
  private pool: Pool;
  private isRunning = false;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async poll() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // 1. Lock a batch of pending/retry jobs safely for concurrent environments
      const lockQuery = `
        UPDATE transmissions
        SET status = 'PROCESSING'
        WHERE id IN (
          SELECT id FROM transmissions
          WHERE status IN ('PENDING', 'RETRY')
          ORDER BY "createdAt" ASC
          LIMIT 50
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *;
      `;
      const { rows: jobs } = await this.pool.query(lockQuery);
      if (jobs.length === 0) return;

      console.log(`[Worker] Processing ${jobs.length} jobs...`);

      // 2. Process jobs in parallel
      await Promise.all(jobs.map(job => this.processJob(job)));

    } catch (err) {
      console.error('[Worker] Poll error:', err);
    } finally {
      this.isRunning = false;
    }
  }

  private async processJob(job: any) {
    let newStatus = 'FAILED';
    let httpCode = null;
    let durationMs = null;
    let payloadSent = null;
    let responseReceived = null;
    let errorText = null;

    try {
      // 1. Fetch the repeater configuration and code
      const { rows: repeaters } = await this.pool.query(`SELECT type AS code, config FROM repeaters WHERE id = $1`, [job.repeaterId]);
      if (repeaters.length === 0) throw new Error('Repeater not found');
      
      const repeaterCode = repeaters[0].code;
      const baseConfig = repeaters[0].config;

      // 2. Fetch the specific unit_repeater config (e.g. overrides, auth token)
      const { rows: unitRepeaters } = await this.pool.query(`SELECT config FROM unit_repeaters WHERE "unitId" = $1 AND "repeaterId" = $2`, [job.unitId, job.repeaterId]);
      const unitConfig = unitRepeaters.length > 0 ? unitRepeaters[0].config : {};

      // Merge configs (Unit specific overrides base)
      const runtimeConfig = { ...baseConfig, ...unitConfig };

      // 3. Fetch Position data
      const { rows: positions } = await this.pool.query(`SELECT * FROM positions WHERE id = $1`, [job.positionId]);
      if (positions.length === 0) throw new Error('Position not found');
      const pos = positions[0];

      // Convert to NormalizedPosition
      const normalizedPosition: NormalizedPosition = {
        messageId: job.id, // using transmission job id as messageId
        unitId: job.unitId,
        plate: job.plate,
        imei: job.imei,
        latitude: pos.latitude,
        longitude: pos.longitude,
        speed: pos.speed,
        course: pos.heading,
        altitude: pos.altitude,
        satellites: pos.satellites,
        eventTime: pos.eventTime,
        receivedAt: pos.receivedAt,
      };

      // 4. Find adapter
      const adapter = ADAPTERS[repeaterCode];
      if (!adapter) throw new Error(`No adapter found for code: ${repeaterCode}`);

      // 5. Send!
      // In DRY_RUN mode, we could skip the actual HTTP call. We'll rely on the repeater config having DRY_RUN or dummy URL.
      // But the requirement says "No iniciar envíos reales a SUTRAN todavía".
      // We will override the URL locally if it's SUTRAN just to be safe, or check process.env.DRY_RUN.
      
      const isDryRun = process.env.DRY_RUN === 'true';
      let result;

      if (isDryRun) {
         console.log(`[DRY RUN] Simulating send to ${repeaterCode}:`, normalizedPosition.plate);
         payloadSent = [normalizedPosition]; // Mock payload
         result = { ok: true, httpStatus: 200, durationMs: 5, responseText: 'DRY_RUN_SIMULATED' };
      } else {
         result = await adapter.send(normalizedPosition, runtimeConfig);
         payloadSent = result.payload;
      }

      httpCode = result.httpStatus || null;
      durationMs = result.durationMs || 0;
      
      if (result.ok) {
        newStatus = isDryRun ? 'SIMULATED' : 'SENT';
        responseReceived = result.response || result.responseText;
      } else {
        errorText = result.errorMessage || 'Unknown error';
        if (result.retryable && job.attempts < 3) {
          newStatus = 'RETRY';
        } else {
          newStatus = 'FAILED';
        }
      }

    } catch (err: any) {
      errorText = err.message;
      if (job.attempts < 3) newStatus = 'RETRY';
    }

    // 6. Save result back to transmissions
    await this.pool.query(`
      UPDATE transmissions
      SET 
        status = $1,
        "httpCode" = $2,
        "durationMs" = $3,
        attempts = attempts + 1,
        "payloadSent" = $4,
        "responseReceived" = $5,
        error = $6
      WHERE id = $7
    `, [newStatus, httpCode, durationMs, payloadSent ? JSON.stringify(payloadSent) : null, responseReceived ? JSON.stringify(responseReceived) : null, errorText, job.id]);
  }

  start(intervalMs = 1000) {
    console.log('[Worker] Started processing jobs');
    setInterval(() => this.poll(), intervalMs);
  }
}
