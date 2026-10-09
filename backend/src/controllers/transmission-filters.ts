import { Request } from 'express';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const STATUSES = ['PENDING', 'PROCESSING', 'RETRY', 'FAILED', 'SENT', 'SIMULATED', 'SKIPPED'] as const;
export const DATE_FIELDS = ['createdAt', 'eventTime', 'receivedAt', 'lastAttemptAt'] as const;

export interface TransmissionFilters {
  where: string;
  params: unknown[];
}

function single(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}
function checkDate(date: string): boolean {
  if (!DATE.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === date;
}

/** Todas las consultas y exportaciones aplican el MISMO filtro de fechas (zona America/Lima). */
export function transmissionFilters(req: Request): TransmissionFilters {
  const query = req.query;
  const clientId = single(query.clientId);
  const repeaterId = single(query.repeaterId);
  const status = single(query.status);
  const search = single(query.search);
  const from = single(query.dateFrom);
  const to = single(query.dateTo);
  const dateField = single(query.dateField) || 'createdAt';
  if ((clientId && !UUID.test(clientId)) || (repeaterId && !UUID.test(repeaterId))) throw new Error('ID de cliente o repetidor inválido.');
  if (status && !STATUSES.includes(status as typeof STATUSES[number])) throw new Error('Estado inválido.');
  if (!DATE_FIELDS.includes(dateField as typeof DATE_FIELDS[number])) throw new Error('Tipo de fecha inválido.');
  if ((from && !checkDate(from)) || (to && !checkDate(to)) || (from && to && from > to)) {
    throw new Error('Rango de fechas inválido; usa AAAA-MM-DD y fecha inicial anterior a la final.');
  }
  if (search && search.length > 100) throw new Error('Búsqueda demasiado larga.');

  const params: unknown[] = [];
  const conditions: string[] = [];
  const param = (value: unknown) => { params.push(value); return `$${params.length}`; };
  if (clientId) conditions.push(`u."clientId" = ${param(clientId)}::uuid`);
  if (repeaterId) conditions.push(`t."repeaterId" = ${param(repeaterId)}::uuid`);
  if (status) conditions.push(`t.status = ${param(status)}`);
  if (search) conditions.push(`(t.plate ILIKE ${param(`%${search}%`)} OR t.imei ILIKE $${params.length})`);
  // TIMESTAMP WITHOUT TIME ZONE contiene horas UTC; fecha solicitada se interpreta en Perú.
  const column = `t."${dateField}"`;
  if (from) conditions.push(`${column} >= ((${param(from)}::date::timestamp AT TIME ZONE 'America/Lima') AT TIME ZONE 'UTC')`);
  if (to) conditions.push(`${column} < (((${param(to)}::date + 1)::timestamp AT TIME ZONE 'America/Lima') AT TIME ZONE 'UTC')`);
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}
