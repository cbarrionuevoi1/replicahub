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
    const imei = req.params.imei as string;
    const { unitId, updateHistorical } = req.body;

    if (!unitId) return res.status(400).json({ error: 'Falta unitId.' });

    const unit = await unitRepo.findOne({ where: { id: unitId } });
    if (!unit) return res.status(404).json({ error: 'Unidad no encontrada.' });

    // Validate if another unit uses this wialonUniqueId
    const existing = await unitRepo.findOne({ where: { wialonUniqueId: imei } });
    if (existing && existing.id !== unit.id) {
      return res.status(400).json({ error: 'Este identificador ya está asignado a otra unidad.' });
    }

    unit.wialonUniqueId = imei;
    await unitRepo.save(unit);

    if (updateHistorical) {
      // Update raw messages
      await rawRepo.createQueryBuilder()
        .update(RawMessage)
        .set({ unitId: unit.id, clientId: unit.clientId, status: 'PROCESSED' })
        .where('imei = :imei AND status = :status', { imei, status: 'UNIDENTIFIED' })
        .execute();

      // Update positions
      await posRepo.createQueryBuilder()
        .update(Position)
        .set({ unitId: unit.id })
        .where('imei = :imei AND "unitId" IS NULL', { imei })
        .execute();
    }

    res.json({ message: 'Asociación exitosa', unit });
  } catch (err) { safeError(res, err); }
};

