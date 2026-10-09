import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { transmissionFilters } from './transmission-filters';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dataError = (res: Response, error: unknown, message: string) => {
  console.error(`[monitor] ${message}`, error);
  const pgCode = (error as {code?: string})?.code;
  if (pgCode === '42703' || pgCode === '42P01') {
    return res.status(503).json({ error: 'Esquema PostgreSQL incompleto. Verifica las migraciones de ReplicaHub.', code: 'SCHEMA_OUTDATED' });
  }
  return res.status(500).json({ error: message });
};

export const dashboardStats = async (req: Request, res: Response) => {
  const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : '';
  if (clientId && !uuid.test(clientId)) return res.status(400).json({ error: 'ID de cliente inválido.' });
  try {
    // Los RAW antiguos no tienen clientId: la asociación con cliente se resuelve por IMEI.
    // Subconsultas independientes evitan multiplicar resultados al combinar unidades y repetidores.
    const [totals, repeaters] = await Promise.all([
      AppDataSource.query(`
        SELECT
          (SELECT COUNT(*)::int FROM raw_messages raw
           WHERE $1::uuid IS NULL OR EXISTS
             (SELECT 1 FROM units ux WHERE (ux.imei = raw.imei OR ux."wialonUniqueId" = raw.imei) AND ux."clientId" = $1::uuid)) AS received,
          (SELECT COUNT(*)::int FROM transmissions t JOIN units u ON t."unitId" = u.id
           WHERE t.status = 'SENT' AND ($1::uuid IS NULL OR u."clientId" = $1::uuid)) AS sent,
          (SELECT COUNT(*)::int FROM transmissions t JOIN units u ON t."unitId" = u.id
           WHERE t.status IN ('FAILED', 'RETRY') AND ($1::uuid IS NULL OR u."clientId" = $1::uuid)) AS errors
      `, [clientId || null]),
      AppDataSource.query(`
        SELECT r.id, r.name, r.type, r.active,
          (SELECT COUNT(DISTINCT ur."unitId")::int FROM unit_repeaters ur
           JOIN units u ON u.id = ur."unitId"
           WHERE ur."repeaterId" = r.id AND ur.active = TRUE AND u.active = TRUE
             AND ($1::uuid IS NULL OR u."clientId" = $1::uuid)) AS "assignedUnits",
          (SELECT COUNT(DISTINCT t."unitId")::int FROM transmissions t
           JOIN units u ON u.id = t."unitId"
           JOIN unit_repeaters ur ON ur."unitId" = u.id AND ur."repeaterId" = r.id AND ur.active = TRUE
           WHERE t."repeaterId" = r.id AND t.status = 'SENT'
             AND COALESCE(t."lastAttemptAt", t."createdAt") >= NOW() - interval '24 hours'
             AND u.active = TRUE AND ($1::uuid IS NULL OR u."clientId" = $1::uuid)) AS "sentUnits"
        FROM repeaters r ORDER BY r.name
      `, [clientId || null]),
    ]);
    res.json({ totals: totals[0], repeaters });
  } catch (error) { dataError(res, error, 'No se pudieron consultar las estadísticas.'); }
};

export const listTransmissions = async (req: Request, res: Response) => {
  let filters;
  try { filters = transmissionFilters(req); }
  catch (err) { return res.status(400).json({ error: (err as Error).message }); }
  const requestedLimit = Number(req.query.limit ?? 100);
  const requestedOffset = Number(req.query.offset ?? 0);
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 200 ||
      !Number.isSafeInteger(requestedOffset) || requestedOffset < 0 || requestedOffset > 1000000) {
    return res.status(400).json({ error: 'Parámetros de paginación inválidos.' });
  }
  try {
    const rows = await AppDataSource.query(`
      SELECT t.id, t.plate, t.imei, t."clientName", t."repeaterName", t.status,
        t."httpCode", t.attempts, t.error, t."eventTime", t."receivedAt", t."createdAt",
        t."durationMs", t."lastAttemptAt", t."lastResponseAt", t."nextAttemptAt",
        t."positionId", t."rawMessageId",
        (t."httpCode" IS NOT NULL) AS "httpResponded"
      FROM transmissions t LEFT JOIN units u ON u.id = t."unitId"
      ${filters.where}
      ORDER BY t."createdAt" DESC, t.id DESC
      LIMIT $${filters.params.length + 1} OFFSET $${filters.params.length + 2}
    `, [...filters.params, requestedLimit, requestedOffset]);
    res.json(rows);
  } catch (err) { dataError(res, err, 'No se pudieron consultar las transmisiones.'); }
};

export const transmissionDetail = async (req: Request, res: Response) => {
  if (!uuid.test(req.params.id as string)) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const rows = await AppDataSource.query(`
      SELECT id, plate, imei, "clientName", "repeaterName", status, attempts, error,
        "httpCode", "durationMs", "payloadSent", "responseReceived", "eventTime",
        "receivedAt", "createdAt", "lastAttemptAt", "lastResponseAt", "nextAttemptAt", "rawMessageId",
        ("httpCode" IS NOT NULL) AS "httpResponded"
      FROM transmissions WHERE id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Transmisión no encontrada.' });
    const attempts = await AppDataSource.query(`
      SELECT "attemptNo", "attemptedAt", "completedAt", status, "httpCode", "durationMs",
        "payloadSent", "responseReceived", error
      FROM transmission_attempts WHERE "transmissionId" = $1 ORDER BY "attemptNo" DESC
    `, [req.params.id]);
    res.json({ ...rows[0], attemptHistory: attempts });
  } catch (err) { dataError(res, err, 'No se pudo consultar el detalle.'); }
};

export const retryTransmission = async (req: Request, res: Response) => {
  if (!uuid.test(req.params.id as string)) return res.status(400).json({ error: 'ID inválido.' });
  try {
    // Se conservan attempts e historial previo: un reenvío real no borra auditoría.
    const result = await AppDataSource.query(`
      UPDATE transmissions SET status = 'PENDING', "cycleAttempts" = 0, "nextAttemptAt" = NULL,
        "processingStartedAt" = NULL, error = NULL
      WHERE id = $1 AND status IN ('FAILED', 'SIMULATED', 'SKIPPED') RETURNING id
    `, [req.params.id]);
    if (!result.length) return res.status(409).json({ error: 'Solo se pueden reprocesar transmisiones fallidas, omitidas o simuladas históricas.' });
    res.json({ success: true });
  } catch (err) { dataError(res, err, 'No se pudo solicitar el reenvío.'); }
};
