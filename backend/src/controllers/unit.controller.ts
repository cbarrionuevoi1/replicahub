import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Unit } from '../entities/Unit';
import { Client } from '../entities/Client';

const unitRepo = AppDataSource.getRepository(Unit);
const clientRepo = AppDataSource.getRepository(Client);

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

export const createUnit = async (req: Request, res: Response) => {
  try {
    const { plate, imei, clientId, active } = req.body;

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

    const unit = unitRepo.create({
      plate: plate.trim(),
      imei: imei.trim(),
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
    const { plate, imei, clientId, active } = req.body;

    const unit = await unitRepo.findOne({ where: { id } });
    if (!unit) return res.status(404).json({ error: 'Unidad no encontrada.' });

    if (imei && imei.trim() !== unit.imei) {
      const existing = await unitRepo.findOne({ where: { imei: imei.trim() } });
      if (existing) return res.status(400).json({ error: 'Ya existe otra unidad con ese IMEI.' });
      unit.imei = imei.trim();
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
