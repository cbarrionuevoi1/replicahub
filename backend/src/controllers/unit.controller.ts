import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Unit } from '../entities/Unit';
import { Client } from '../entities/Client';
import { RawMessage } from '../entities/RawMessage';
import { Position } from '../entities/Position';

const unitRepo = AppDataSource.getRepository(Unit);
const clientRepo = AppDataSource.getRepository(Client);
const rawRepo = AppDataSource.getRepository(RawMessage);
const posRepo = AppDataSource.getRepository(Position);

const safeError = (res: Response, err?: any) => {
  if (err) console.error("UNIT ERROR:", err);
  return res.status(500).json({ error: 'No se pudo completar la operación.' });
};

export const getUnits = async (req: Request, res: Response) => {
  try {
    const units = await unitRepo.find({
      relations: { client: true, unitRepeaters: true },
      order: { createdAt: 'DESC' }
    });
    res.json(units);
  } catch (err) { safeError(res, err); }
};

export const getPendingUnits = async (req: Request, res: Response) => {
  try {
    const pending = await rawRepo.createQueryBuilder('raw')
      .select('raw.imei', 'imei')
      .addSelect('MIN(raw.receivedAt)', 'firstTransmissionAt')
      .addSelect('MAX(raw.receivedAt)', 'lastTransmissionAt')
      .addSelect('COUNT(raw.id)', 'totalFrames')
      .where('raw.status = :status', { status: 'UNIDENTIFIED' })
      .groupBy('raw.imei')
      .getRawMany();

    res.json(pending);
  } catch (err) { safeError(res, err); }
};

export const createUnit = async (req: Request, res: Response) => {
  try {
    const { plate, imei, clientId, active, wialonUniqueId } = req.body;

    if (!plate || !plate.trim()) return res.status(400).json({ error: 'La placa es obligatoria.' });
    if (!imei || !imei.trim()) return res.status(400).json({ error: 'El IMEI es obligatorio.' });

    const existingUnit = await unitRepo.findOne({ where: { imei } });
    if (existingUnit) {
      return res.status(400).json({ error: 'Ya existe una unidad con ese IMEI.' });
    }

    if (clientId) {
      const client = await clientRepo.findOne({ where: { id: clientId } });
      if (!client) return res.status(400).json({ error: 'El cliente seleccionado no existe.' });
    }

    if (wialonUniqueId) {
      const existingWialon = await unitRepo.findOne({ where: { wialonUniqueId: wialonUniqueId.trim() } });
      if (existingWialon) return res.status(400).json({ error: 'Ese ID Wialon ya está asignado a otra unidad.' });
    }

    const unit = unitRepo.create({
      plate: plate.trim(),
      imei: imei.trim(),
      wialonUniqueId: wialonUniqueId ? wialonUniqueId.trim() : null,
      clientId: clientId || null,
      active: active ?? true,
      origin: 'MANUAL'
    });

    await unitRepo.save(unit);
    const saved = await unitRepo.findOne({ where: { id: unit.id }, relations: { client: true, unitRepeaters: true } });
    res.status(201).json(saved);
  } catch (err) { safeError(res, err); }
};

export const updateUnit = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { plate, imei, clientId, active, wialonUniqueId } = req.body;

    const unit = await unitRepo.findOne({ where: { id } });
    if (!unit) return res.status(404).json({ error: 'Unidad no encontrada.' });

    if (imei && imei.trim() !== unit.imei) {
      const existing = await unitRepo.findOne({ where: { imei: imei.trim() } });
      if (existing) return res.status(400).json({ error: 'Ya existe otra unidad con ese IMEI.' });
      unit.imei = imei.trim();
    }

    if (wialonUniqueId !== undefined) {
      if (wialonUniqueId && wialonUniqueId.trim() !== unit.wialonUniqueId) {
        const existing = await unitRepo.findOne({ where: { wialonUniqueId: wialonUniqueId.trim() } });
        if (existing) return res.status(400).json({ error: 'Ese ID Wialon ya está asignado a otra unidad.' });
      }
      unit.wialonUniqueId = wialonUniqueId ? wialonUniqueId.trim() : null;
    }

    if (plate !== undefined) {
      unit.plate = plate ? plate.trim() : null;
    }

    if (clientId !== undefined) {
      if (clientId) {
        const client = await clientRepo.findOne({ where: { id: clientId } });
        if (!client) return res.status(400).json({ error: 'El cliente seleccionado no existe.' });
      }
      unit.clientId = clientId || null;
    }

    if (active !== undefined) {
      unit.active = active;
    }

    await unitRepo.save(unit);
    const updated = await unitRepo.findOne({ where: { id }, relations: { client: true, unitRepeaters: true } });
    res.json(updated);
  } catch (err) { safeError(res, err); }
};

export const associatePendingUnit = async (req: Request, res: Response) => {
  try {
    const wialonId = req.params.imei as string;
    const { unitId, updateHistorical } = req.body ?? {};
    if (!unitId || !wialonId) return res.status(400).json({ error: 'Faltan identificadores.' });

    const result = await AppDataSource.transaction(async manager => {
      const repo = manager.getRepository(Unit);
      const unit = await repo.findOneBy({ id: unitId });
      if (!unit) throw new Error('UNIT_NOT_FOUND');
      const existing = await repo.findOneBy({ wialonUniqueId: wialonId });
      if (existing && existing.id !== unit.id) throw new Error('DUPLICATE_WIALON_ID');
      unit.wialonUniqueId = wialonId;
      await repo.save(unit);
      await manager.query(`UPDATE detected_units SET linked = true WHERE imei = $1`, [wialonId]);
      let recovered = 0;
      if (updateHistorical === true) {
        await manager.query(`
          UPDATE raw_messages SET "unitId" = $1, "clientId" = $2, status = 'PROCESSED'
          WHERE imei = $3 AND status = 'UNIDENTIFIED'
        `, [unit.id, unit.clientId, wialonId]);
        await manager.query(`
          UPDATE positions SET "unitId" = $1 WHERE imei = $2 AND "unitId" IS NULL
        `, [unit.id, wialonId]);
        // Una posición recuperada puede quedar detrás del cursor del dispatcher.
        // Añadimos explícitamente su trabajo pendiente, respetando asignaciones actuales.
        const inserted = await manager.query(`
          INSERT INTO transmissions (
            "unitId", plate, imei, "clientName", "repeaterId", "repeaterName",
            status, attempts, "positionId", "rawMessageId", "eventTime", "receivedAt"
          )
          SELECT u.id, u.plate, u.imei, c.name, r.id, r.name,
                 'PENDING', 0, p.id, p."rawMessageId", p."eventTime", p."receivedAt"
          FROM positions p JOIN units u ON p."unitId" = u.id
          LEFT JOIN clients c ON u."clientId" = c.id
          JOIN unit_repeaters ur ON ur."unitId" = u.id AND ur.active = TRUE
          JOIN repeaters r ON r.id = ur."repeaterId" AND r.active = TRUE
          WHERE p.imei = $1 AND u.id = $2 AND u.active = TRUE AND u.plate IS NOT NULL
          ON CONFLICT ("positionId", "repeaterId") WHERE "positionId" IS NOT NULL DO NOTHING
          RETURNING id
        `, [wialonId, unit.id]);
        recovered = inserted.length;
      }
      return { unit, recovered };
    });
    res.json({ message: 'Asociación exitosa', ...result });
  } catch (err: any) {
    if (err.message === 'UNIT_NOT_FOUND') return res.status(404).json({ error: 'Unidad no encontrada.' });
    if (err.message === 'DUPLICATE_WIALON_ID') return res.status(409).json({ error: 'El identificador Wialon ya está asignado a otra unidad.' });
    safeError(res, err);
  }
};
