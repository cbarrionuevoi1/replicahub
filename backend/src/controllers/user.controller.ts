import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { AuditLog } from '../entities/AuditLog';

export const listUsers = async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(User);
    const users = await repo
      .createQueryBuilder('u')
      .select(['u.id', 'u.name', 'u.username', 'u.email', 'u.role', 'u.active', 'u.lastLoginAt'])
      .getMany();
    res.json(users);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};

export const createUser = async (req: Request, res: Response) => {
  const { name, username, email, password, role, active } = req.body;
  const ip = req.ip || req.socket.remoteAddress || '';
  const adminId = (req as any).user.id;

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = AppDataSource.getRepository(User).create({ name, username, email, passwordHash, role, active });
    await AppDataSource.getRepository(User).save(user);
    await AppDataSource.getRepository(AuditLog).save({
      userId: adminId,
      action: 'USER_CREATED',
      details: { targetUsername: username },
      ipAddress: ip
    });
    res.status(201).json({ success: true, user: { id: user.id, username } });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = (req as any).user;
  const ip = req.ip || req.socket.remoteAddress || '';

  try {
    const userEntity = await AppDataSource.getRepository(User).findOneBy({ id: user.id });
    if (!userEntity) return res.status(404).json({ error: 'Not found' });

    const isValid = await bcrypt.compare(currentPassword, userEntity.passwordHash);
    if (!isValid) return res.status(400).json({ error: 'Contraseña actual incorrecta' });

    userEntity.passwordHash = await bcrypt.hash(newPassword, 10);
    await AppDataSource.getRepository(User).save(userEntity);

    await AppDataSource.getRepository(AuditLog).save({ userId: user.id, action: 'PASSWORD_CHANGED', ipAddress: ip });
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};
