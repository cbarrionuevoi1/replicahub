import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Client } from '../entities/Client';
import { Unit } from '../entities/Unit';
import { In, Not } from 'typeorm';

const clientRepo = AppDataSource.getRepository(Client);
const unitRepo = AppDataSource.getRepository(Unit);

const safeError = (res: Response, err?: any) => {
  if (err) console.error("CLIENT ERROR:", err);
  return res.status(500).json({ error: 'No se pudo completar la operación.' });
};

export const getClients = async (req: Request, res: Response) => {
  try {
    const clients = await clientRepo.find({
      relations: { units: true },
      order: { createdAt: 'DESC' }
    });
    res.json(clients);
  } catch (err) { safeError(res, err); }
};

export const createClient = async (req: Request, res: Response) => {
  try {
    const { name, businessName, ruc, contact, email, phone, notes, active, unitIds } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });
    if (ruc && ruc.trim().length !== 11) return res.status(400).json({ error: 'El RUC debe tener 11 dígitos.' });

    if (ruc && ruc.trim()) {
      const existing = await clientRepo.findOne({ where: { ruc: ruc.trim() } });
      if (existing) return res.status(400).json({ error: 'Ya existe un cliente con ese RUC.' });
    }

    const client = clientRepo.create({
      name: name.trim(),
      businessName: businessName?.trim() || null,
      ruc: ruc?.trim() || null,
      contact: contact?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      notes: notes?.trim() || null,
      active: active ?? true
    });

    await clientRepo.save(client);

    if (Array.isArray(unitIds) && unitIds.length > 0) {
      await AppDataSource.query(`UPDATE units SET "clientId" = $1 WHERE id = ANY($2)`, [client.id, unitIds]);
    }

    const saved = await clientRepo.findOne({ where: { id: client.id }, relations: { units: true } });
    res.status(201).json(saved);
  } catch (err) { safeError(res, err); }
};

export const updateClient = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, businessName, ruc, contact, email, phone, notes, active, unitIds } = req.body;

    const client = await clientRepo.findOne({ where: { id } });
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado.' });

    if (ruc && ruc.trim() !== client.ruc) {
      if (ruc.trim().length !== 11) return res.status(400).json({ error: 'El RUC debe tener 11 dígitos.' });
      const existing = await clientRepo.findOne({ where: { ruc: ruc.trim() } });
      if (existing) return res.status(400).json({ error: 'Ya existe un cliente con ese RUC.' });
      client.ruc = ruc.trim();
    } else if (ruc === '') {
      client.ruc = null as any;
    }

    if (name !== undefined) client.name = name.trim();
    if (businessName !== undefined) client.businessName = businessName?.trim() || null;
    if (contact !== undefined) client.contact = contact?.trim() || null;
    if (email !== undefined) client.email = email?.trim() || null;
    if (phone !== undefined) client.phone = phone?.trim() || null;
    if (notes !== undefined) client.notes = notes?.trim() || null;
    if (active !== undefined) client.active = active;

    await clientRepo.save(client);

    if (unitIds !== undefined && Array.isArray(unitIds)) {
      // Unassign all units that currently belong to this client but are not in the new unitIds array
      if (unitIds.length === 0) {
        await AppDataSource.query(`UPDATE units SET "clientId" = NULL WHERE "clientId" = $1`, [client.id]);
      } else {
        await AppDataSource.query(`UPDATE units SET "clientId" = NULL WHERE "clientId" = $1 AND id != ALL($2)`, [client.id, unitIds]);
        await AppDataSource.query(`UPDATE units SET "clientId" = $1 WHERE id = ANY($2)`, [client.id, unitIds]);
      }
    }

    const updated = await clientRepo.findOne({ where: { id }, relations: { units: true } });
    res.json(updated);
  } catch (err) { safeError(res, err); }
};
