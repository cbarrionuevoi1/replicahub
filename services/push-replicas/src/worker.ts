import { createDecipheriv } from 'crypto';
import { Pool } from 'pg';
import { SutranService, NormalizedPosition, SutranRuntimeConfig, RepeaterSendResult } from '@replicahub/repeaters';

const adapters = { SUTRAN: new SutranService() };
const MAX_BATCH = 20;

export function decryptRepeaterToken(encrypted: string): string {
  const keyHex = process.env.REPEATER_ENCRYPTION_KEY?.trim() ?? '';
  if (!/^[a-f0-9]{64}$/i.test(keyHex)) throw new Error('REPEATER_ENCRYPTION_KEY no configurada o inválida.');
  const parts = encrypted.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Token cifrado de SUTRAN inválido.');
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Token cifrado de SUTRAN inválido.');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8');
}

function runtimeForSutran(row: any): SutranRuntimeConfig {
  if (!row.active || !row.assignmentActive || !row.unitActive) throw new Error('REPEATER_DISABLED');
  const auth = row.auth || {};
  if (typeof auth.tokenEncrypted !== 'string') throw new Error('Falta token cifrado SUTRAN.');
  const url = String(process.env.SUTRAN_ENDPOINT_URL || row.url || '').trim();
  return {
    repeaterId: row.id, name: row.name, code: 'SUTRAN',
    endpointUrl: url, method: 'POST', active: true,
    timeoutMs: Number(row.timeout) || 10000,
    maxRetries: Math.max(0, Number(row.maxRetries) || 0),
    auth: { type: 'TOKEN_HEADER', headerName: 'access-token', token: decryptRepeaterToken(auth.tokenEncrypted) },
    headers: row.headers || {}, config: { apiVersion: 'v1', batchSize: 1, includeImei: true, ...(row.config || {}), ...(row.unitConfig || {}) },
  };
}

export class Worker {
  private isRunning = false;
  constructor(private readonly pool: Pool) {}

  async poll(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      // Una sola sentencia atómica para múltiples workers. Reclamaciones antiguas
      // se recuperan tras 5 minutos sin resetear trabajos activos de otros procesos.
      const { rows: jobs } = await this.pool.query(`
        UPDATE transmissions t
        SET status = 'PROCESSING', "processingStartedAt" = NOW()
        FROM (
          SELECT id FROM transmissions
          WHERE (status IN ('PENDING', 'RETRY') AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW()))
             OR (status = 'PROCESSING' AND "processingStartedAt" < NOW() - interval '5 minutes')
          ORDER BY "createdAt", id LIMIT $1 FOR UPDATE SKIP LOCKED
        ) pending
        WHERE t.id = pending.id RETURNING t.*
      `, [MAX_BATCH]);
      await Promise.all(jobs.map(job => this.processJob(job).catch(err =>
        console.error(`[Worker] No se pudo guardar el resultado de ${job.id}:`, err))));
    } catch (error) {
      console.error('[Worker] Error de cola:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async processJob(job: any): Promise<void> {
    let status = 'FAILED';
    let result: RepeaterSendResult | null = null;
    let error: string | null = null;
    let maxAttempts = 1;
    const startedAt = new Date();
    try {
      const { rows } = await this.pool.query(`
        SELECT r.*, ur.config AS "unitConfig", ur.active AS "assignmentActive", u.active AS "unitActive"
        FROM repeaters r
        LEFT JOIN unit_repeaters ur ON ur."repeaterId" = r.id AND ur."unitId" = $2
        LEFT JOIN units u ON u.id = $2
        WHERE r.id = $1
      `, [job.repeaterId, job.unitId]);
      if (!rows.length) throw new Error('Repetidor no encontrado.');
      const repeater = rows[0];
      if (!repeater.active || !repeater.assignmentActive || !repeater.unitActive) {
        status = 'SKIPPED';
        throw new Error('Unidad, asignación o repetidor desactivado.');
      }
      maxAttempts = Math.max(1, Number(repeater.maxRetries ?? 3) + 1);
      if (repeater.type !== 'SUTRAN') throw new Error(`Adaptador no implementado: ${repeater.type}`);
      const config = runtimeForSutran(repeater);
      const { rows: positions } = await this.pool.query(`SELECT * FROM positions WHERE id = $1`, [job.positionId]);
      if (!positions.length) throw new Error('Posición no encontrada.');
      const pos = positions[0];
      const position: NormalizedPosition = {
        messageId: job.id, positionId: pos.id, rawMessageId: pos.rawMessageId,
        unitId: job.unitId, plate: job.plate, imei: job.imei,
        latitude: Number(pos.latitude), longitude: Number(pos.longitude),
        speed: pos.speed === null ? null : Number(pos.speed),
        course: pos.heading === null ? null : Number(pos.heading),
        altitude: pos.altitude === null ? null : Number(pos.altitude),
        satellites: pos.satellites, eventTime: pos.eventTime, receivedAt: pos.receivedAt,
        parameters: Object.fromEntries((pos.rawData?.blocks || [])
          .filter((b: any) => b && typeof b.name === 'string')
          .map((b: any) => [b.name, b.value])),
      };
      // Solo tráfico REAL; DRY_RUN heredado se ignora deliberadamente.
      result = await adapters.SUTRAN.send(position, config);
      status = result.ok ? 'SENT' : 'FAILED';
      error = result.ok ? null : (result.errorMessage ?? 'Error desconocido del destino.');
      if (!result.ok && result.retryable && Number(job.cycleAttempts || 0) + 1 < maxAttempts) status = 'RETRY';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      // Error de configuración, permisos o datos: no reintentar automáticamente.
      status = status === 'SKIPPED' ? 'SKIPPED' : 'FAILED';
    }
    const attempts = Number(job.attempts) + 1;
    const delaySeconds = Math.min(300, 15 * (2 ** Math.min(attempts - 1, 4)));
    // Un CTE guarda de forma ATÓMICA el último resultado y un intento inmutable.
    // El primer HTTP 403, el segundo HTTP 503, etc. quedan disponibles en el historial.
    // No se guardan tokens ni cabeceras de autenticación.
    const payload = result?.payload === undefined ? null : JSON.stringify(result.payload);
    const response = result?.response !== undefined ? JSON.stringify(result.response) :
      result?.responseText !== undefined ? JSON.stringify(result.responseText) : null;
    await this.pool.query(`
      WITH updated AS (
        UPDATE transmissions SET status = $1, "httpCode" = $2, "durationMs" = $3,
          attempts = $4, "cycleAttempts" = COALESCE("cycleAttempts", 0) + 1,
          "payloadSent" = $5::json, "responseReceived" = $6::json, error = $7,
          "nextAttemptAt" = CASE WHEN $1 = 'RETRY' THEN NOW() + ($8 * interval '1 second') ELSE NULL END,
          "processingStartedAt" = NULL, "lastAttemptAt" = $9,
          "lastResponseAt" = CASE WHEN $2::integer IS NOT NULL THEN NOW() ELSE NULL END
        WHERE id = $10 RETURNING id
      )
      INSERT INTO transmission_attempts (
        "transmissionId", "attemptNo", "attemptedAt", "completedAt",
        status, "httpCode", "durationMs", "payloadSent", "responseReceived", error
      )
      SELECT id, $4, $9, NOW(), $1, $2, $3, $5::json, $6::json, $7 FROM updated
      ON CONFLICT ("transmissionId", "attemptNo") DO NOTHING
    `, [status, result?.httpStatus ?? null, result?.durationMs ?? null, attempts,
      payload, response, error, delaySeconds, startedAt, job.id]);
    if (status === 'FAILED') console.error(`[Worker] ${job.plate} -> ${job.repeaterName}: ${error}`);
  }

  start(intervalMs = 1000): void {
    void this.poll();
    setInterval(() => void this.poll(), intervalMs);
  }
}
