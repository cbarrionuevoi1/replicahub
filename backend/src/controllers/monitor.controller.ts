import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validStatuses = new Set(['PENDING','PROCESSING','RETRY','FAILED','SENT','SIMULATED','SKIPPED']);

export const dashboardStats = async (req: Request, res: Response) => {
  try {
    const clientId = typeof req.query.clientId === 'string' && uuid.test(req.query.clientId) ? req.query.clientId : null;
    const [totals, repeaters] = await Promise.all([
      AppDataSource.query(`
        SELECT
          (SELECT COUNT(*)::int FROM raw_messages raw
           WHERE $1::uuid IS NULL OR raw."clientId" = $1::uuid) AS received,
          (SELECT COUNT(*)::int FROM transmissions t
           JOIN units u ON t."unitId" = u.id
           WHERE t.status = 'SENT' AND ($1::uuid IS NULL OR u."clientId" = $1::uuid)) AS sent,
          (SELECT COUNT(*)::int FROM transmissions t
           JOIN units u ON t."unitId" = u.id
           WHERE t.status IN ('FAILED','RETRY') AND ($1::uuid IS NULL OR u."clientId" = $1::uuid)) AS errors,
          (SELECT COUNT(*)::int FROM transmissions t
           JOIN units u ON t."unitId" = u.id
           WHERE t.status = 'SIMULATED' AND ($1::uuid IS NULL OR u."clientId" = $1::uuid)) AS simulated,
          (SELECT COUNT(*)::int FROM transmissions t
           JOIN units u ON t."unitId" = u.id
           WHERE t.status IN ('PENDING','PROCESSING') AND ($1::uuid IS NULL OR u."clientId" = $1::uuid)) AS pending
      `, [clientId]),
      AppDataSource.query(`
        SELECT r.id, r.name, r.type, r.active,
          COUNT(DISTINCT ur."unitId") FILTER (WHERE ur.active AND u.active AND ($1::uuid IS NULL OR u."clientId" = $1::uuid))::int AS "assignedUnits",
          COUNT(DISTINCT t."unitId") FILTER (WHERE t.status = 'SENT' AND ($1::uuid IS NULL OR u."clientId" = $1::uuid))::int AS "sentUnits"
        FROM repeaters r
        LEFT JOIN unit_repeaters ur ON ur."repeaterId" = r.id
        LEFT JOIN units u ON u.id = ur."unitId"
        LEFT JOIN transmissions t ON t."repeaterId" = r.id AND t."unitId" = ur."unitId"
          AND t."createdAt" > NOW() - interval '24 hours'
        GROUP BY r.id, r.name, r.type, r.active ORDER BY r.name
      `, [clientId]),
    ]);
    res.json({ totals: totals[0], repeaters });
  } catch (error) {
    console.error('[stats]', error);
    res.status(500).json({ error: 'Error al consultar estadísticas.' });
  }
};

export const listTransmissions = async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' && validStatuses.has(req.query.status) ? req.query.status : null;
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
  const repeaterId = typeof req.query.repeaterId === 'string' && uuid.test(req.query.repeaterId) ? req.query.repeaterId : null;
  const clientId = typeof req.query.clientId === 'string' && uuid.test(req.query.clientId) ? req.query.clientId : null;
  const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 50));
  const offset = Math.max(0, Math.min(1000000, Number(req.query.offset) || 0));
  try {
    const values = [status, search ? `%${search}%` : null, repeaterId, clientId, limit, offset];
    const rows = await AppDataSource.query(`
      SELECT t.id, t.plate, t.imei, t."clientName", t."repeaterName", t.status,
        t."httpCode", t.attempts, t.error, t."eventTime", t."receivedAt", t."createdAt",
        t."durationMs", t."nextAttemptAt", t."positionId", t."rawMessageId"
      FROM transmissions t LEFT JOIN units u ON u.id = t."unitId"
      WHERE ($1::text IS NULL OR t.status = $1)
        AND ($2::text IS NULL OR t.plate ILIKE $2 OR t.imei ILIKE $2)
        AND ($3::uuid IS NULL OR t."repeaterId" = $3)
        AND ($4::uuid IS NULL OR u."clientId" = $4)
      ORDER BY t."createdAt" DESC, t.id DESC LIMIT $5 OFFSET $6
    `, values);
    res.json(rows);
  } catch (error) {
    console.error('[transmissions]', error);
    res.status(500).json({ error: 'No se pudieron consultar las transmisiones.' });
  }
};

export const transmissionDetail = async (req: Request, res: Response) => {
  if (!uuid.test(req.params.id as string)) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const rows = await AppDataSource.query(`
      SELECT id, plate, imei, status, attempts, error, "httpCode", "durationMs", "payloadSent",
        "responseReceived", "eventTime", "receivedAt", "createdAt", "nextAttemptAt", "rawMessageId"
      FROM transmissions WHERE id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Transmisión no encontrada.' });
    res.json(rows[0]);
  } catch (error) {
    console.error('[transmission detail]', error);
    res.status(500).json({ error: 'No se pudo consultar el detalle.' });
  }
};

export const retryTransmission = async (req: Request, res: Response) => {
  if (!uuid.test(req.params.id as string)) return res.status(400).json({ error: 'ID inválido.' });
  try {
    const result = await AppDataSource.query(`
      UPDATE transmissions SET status = 'PENDING', attempts = 0,
        "nextAttemptAt" = NULL, "processingStartedAt" = NULL, error = NULL
      WHERE id = $1 AND status IN ('FAILED', 'SIMULATED') RETURNING id
    `, [req.params.id]);
    if (!result.length) return res.status(409).json({ error: 'Solo se pueden reintentar transmisiones fallidas o simuladas.' });
    res.json({ success: true });
  } catch (error) {
    console.error('[retry]', error);
    res.status(500).json({ error: 'No se pudo reintentar.' });
  }
};
