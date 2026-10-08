import { Request, Response } from 'express';
import { In, Not, IsNull } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Repeater } from '../entities/Repeater';
import { Unit } from '../entities/Unit';
import { UnitRepeater } from '../entities/UnitRepeater';
import { Transmission } from '../entities/Transmission';
import { AuditLog } from '../entities/AuditLog';
import { encryptSecret } from '../services/repeater-secrets.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeError = (res: Response, err?: any) => {
  if (err) console.error("SAFE ERROR CAUGHT:", err);
  return res.status(500).json({ error: 'No se pudo completar la operación.' });
};
const isValidToken = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 4096;

function userId(req: Request): string { return (req as any).user.id; }
function sanitized(repeater: Repeater) {
  return {
    id: repeater.id,
    name: repeater.name,
    type: repeater.type,
    active: repeater.active,
    tokenConfigured: typeof repeater.auth?.tokenEncrypted === 'string',
    endpointConfigured: !!process.env.SUTRAN_ENDPOINT_URL?.trim(),
    unitIds: (repeater.unitRepeaters ?? []).filter(link => link.enabled).map(link => link.unitId),
    createdAt: repeater.createdAt,
  };
}

async function appendAudit(manager: any, req: Request, action: string, repeaterId: string, details: Record<string, unknown>) {
  await manager.getRepository(AuditLog).save({
    userId: userId(req), action, entityType: 'Repeater', entityId: repeaterId,
    ipAddress: req.ip || req.socket.remoteAddress || '', details,
  });
}

function parseUnitIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 50000 || !value.every(v => typeof v === 'string' && UUID.test(v))) return null;
  return [...new Set(value)];
}

async function checkUnitIds(unitIds: string[], manager: any): Promise<boolean> {
  if (unitIds.length === 0) return true;
  const count = await manager.getRepository(Unit).count({ where: { id: In(unitIds) } });
  return count === unitIds.length;
}

async function syncUnits(manager: any, repeaterId: string, unitIds: string[]) {
  const repo = manager.getRepository(UnitRepeater);
  // Evita duplicados y conserva el estado; solo se reemplazan los vínculos de este repetidor.
  await repo.delete({ repeaterId });
  if (unitIds.length) await repo.save(unitIds.map(unitId => repo.create({ unitId, repeaterId, enabled: true })));
}

export const listProtocols = (_req: Request, res: Response) => {
  res.json([{ code: 'SUTRAN', name: 'SUTRAN', credentialFields: [{ key: 'token', label: 'Token SUTRAN', type: 'password', required: true }] }]);
};

export const listAssignableUnits = async (_req: Request, res: Response) => {
  try {
    const units = await AppDataSource.getRepository(Unit).find({
      where: { plate: Not(IsNull()) },
      select: { id: true, plate: true, alias: true, active: true },
      order: { plate: 'ASC' },
    });
    res.json(units);
  } catch { safeError(res); }
};

export const listRepeaters = async (_req: Request, res: Response) => {
  try {
    const repeaters = await AppDataSource.getRepository(Repeater).find({
      where: { type: 'SUTRAN' }, relations: { unitRepeaters: true }, order: { createdAt: 'DESC' },
    });
    res.json(repeaters.map(sanitized));
  } catch { safeError(res); }
};

export const createRepeater = async (req: Request, res: Response) => {
  const { name, type, token, unitIds } = req.body ?? {};
  const repeaterName = typeof name === 'string' ? name.trim() : 'SUTRAN';
  const parsedUnitIds = parseUnitIds(unitIds ?? []);
  if (type !== 'SUTRAN') return res.status(400).json({ error: 'Solo está habilitado el protocolo SUTRAN.' });
  if (repeaterName.length < 4 || repeaterName.length > 120) return res.status(400).json({ error: 'El nombre debe tener entre 4 y 120 caracteres.' });
  if (!isValidToken(token)) return res.status(400).json({ error: 'Ingresa un token SUTRAN válido.' });
  if (!parsedUnitIds) return res.status(400).json({ error: 'Lista de unidades inválida.' });
  if (!process.env.SUTRAN_ENDPOINT_URL?.trim()) return res.status(503).json({ error: 'El servidor aún no tiene SUTRAN_ENDPOINT_URL configurado.' });
  try {
    if (new URL(process.env.SUTRAN_ENDPOINT_URL).protocol !== 'https:') return res.status(503).json({ error: 'El endpoint SUTRAN debe usar HTTPS.' });
  } catch { return res.status(503).json({ error: 'SUTRAN_ENDPOINT_URL no es una URL válida.' }); }
  try {
    const result = await AppDataSource.transaction(async manager => {
      if (!await checkUnitIds(parsedUnitIds, manager)) throw new Error('INVALID_UNITS');
      const entity = manager.getRepository(Repeater).create({
        name: repeaterName,
        type: 'SUTRAN',
        url: process.env.SUTRAN_ENDPOINT_URL!.trim(),
        method: 'POST', timeout: 10000, maxRetries: 3,
        auth: { type: 'TOKEN_HEADER', headerName: 'access-token', tokenEncrypted: encryptSecret(token.trim()) },
        active: true,
        config: { apiVersion: 'v1', batchSize: 1 },
      });
      const saved = await manager.getRepository(Repeater).save(entity);
      await syncUnits(manager, saved.id, parsedUnitIds);
      await appendAudit(manager, req, 'REPEATER_CREATED', saved.id, { name: saved.name, type: 'SUTRAN', totalUnits: parsedUnitIds.length });
      saved.unitRepeaters = parsedUnitIds.map(unitId => ({ unitId, enabled: true } as UnitRepeater));
      return sanitized(saved);
    });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_UNITS') return res.status(400).json({ error: 'Hay unidades que ya no existen.' });
    safeError(res, err);
  }
};

export const updateRepeater = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!UUID.test(id)) return res.status(400).json({ error: 'ID de repetidor inválido.' });
  const { name, token, active } = req.body ?? {};
  if (name !== undefined && (typeof name !== 'string' || name.trim().length < 4 || name.trim().length > 120)) return res.status(400).json({ error: 'El nombre debe tener entre 4 y 120 caracteres.' });
  if (token !== undefined && !isValidToken(token)) return res.status(400).json({ error: 'Token inválido.' });
  if (active !== undefined && typeof active !== 'boolean') return res.status(400).json({ error: 'Estado inválido.' });
  try {
    const result = await AppDataSource.transaction(async manager => {
      const repo = manager.getRepository(Repeater);
      const entity = await repo.findOne({ where: { id, type: 'SUTRAN' }, relations: { unitRepeaters: true } });
      if (!entity) return null;
      if (name !== undefined) entity.name = name.trim();
      if (token !== undefined) entity.auth = { type: 'TOKEN_HEADER', headerName: 'access-token', tokenEncrypted: encryptSecret(token.trim()) };
      if (active !== undefined) entity.active = active;
      await repo.save(entity);
      await appendAudit(manager, req, 'REPEATER_UPDATED', entity.id, { nameChanged: name !== undefined, tokenChanged: token !== undefined, active: entity.active });
      return sanitized(entity);
    });
    if (!result) return res.status(404).json({ error: 'Repetidor no encontrado.' });
    res.json(result);
  } catch (err) { safeError(res, err); }
};

export const updateAssignments = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const unitIds = parseUnitIds(req.body?.unitIds);
  if (!UUID.test(id) || !unitIds) return res.status(400).json({ error: 'ID o lista de unidades inválida.' });
  try {
    const result = await AppDataSource.transaction(async manager => {
      const repo = manager.getRepository(Repeater);
      const entity = await repo.findOneBy({ id, type: 'SUTRAN' });
      if (!entity) return null;
      if (!await checkUnitIds(unitIds, manager)) throw new Error('INVALID_UNITS');
      await syncUnits(manager, id, unitIds);
      await appendAudit(manager, req, 'REPEATER_UNITS_UPDATED', id, { totalUnits: unitIds.length });
      return { id, unitIds };
    });
    if (!result) return res.status(404).json({ error: 'Repetidor no encontrado.' });
    res.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_UNITS') return res.status(400).json({ error: 'Hay unidades que ya no existen.' });
    safeError(res, err);
  }
};

export const listRepeaterTransmissions = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!UUID.test(id)) return res.status(400).json({ error: 'ID de repetidor inválido.' });
  try {
    const repeater = await AppDataSource.getRepository(Repeater).findOneBy({ id, type: 'SUTRAN' });
    if (!repeater) return res.status(404).json({ error: 'Repetidor no encontrado.' });
    const rows = await AppDataSource.getRepository(Transmission).find({
      select: { id: true, plate: true, status: true, httpCode: true, eventTime: true, createdAt: true, durationMs: true },
      where: { repeaterId: id }, order: { createdAt: 'DESC' }, take: 50,
    });
    res.json(rows);
  } catch (err) { safeError(res, err); }
};
