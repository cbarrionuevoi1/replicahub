import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../config/database';
import { User, UserRole } from '../entities/User';
import { AuditLog } from '../entities/AuditLog';

const roles = [UserRole.ADMIN, UserRole.OPERATOR];
const safeUser = (user: User) => ({
  id: user.id, name: user.name, username: user.username, email: user.email,
  role: user.role, active: user.active, lastLoginAt: user.lastLoginAt
});
const ipAddress = (req: Request) => req.ip || req.socket.remoteAddress || '';
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validPassword = (value: unknown) => typeof value === 'string' && value.length >= 12 && value.length <= 128;
const validRole = (role: unknown): role is UserRole => roles.includes(role as UserRole);
async function audit(req: Request, action: string, target: User, details: Record<string, unknown> = {}) {
  await AppDataSource.getRepository(AuditLog).save({
    userId: (req as any).user.id, action, entityType: 'User', entityId: target.id,
    details: { targetUsername: target.username, ...details }, ipAddress: ipAddress(req)
  });
}
async function hasOtherActiveAdmin(excludingId: string): Promise<boolean> {
  return AppDataSource.getRepository(User).createQueryBuilder('u')
    .where('u.role = :role AND u.active = :active AND u.id != :id',
      { role: UserRole.ADMIN, active: true, id: excludingId })
    .getExists();
}
export const listUsers = async (_req: Request, res: Response) => {
  try {
    const users = await AppDataSource.getRepository(User).find({ order: { name: 'ASC' } });
    return res.json(users.map(safeUser));
  } catch { return res.status(500).json({ error: 'Error al listar usuarios' }); }
};
export const createUser = async (req: Request, res: Response) => {
  try {
    const { name, username, email, password, role, active = true } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || typeof username !== 'string' || !username.trim() ||
        typeof email !== 'string' || !isValidEmail(email.trim()) || !validPassword(password) ||
        !validRole(role) || typeof active !== 'boolean') {
      return res.status(400).json({ error: 'Datos inválidos. Contraseña de al menos 12 caracteres y rol ADMIN u OPERATOR.' });
    }
    const repo = AppDataSource.getRepository(User);
    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await repo.findOne({ where: [{ username: normalizedUsername }, { email: normalizedEmail }] });
    if (existing) return res.status(409).json({ error: 'El usuario o correo ya existe' });
    const user = repo.create({
      name: name.trim(), username: normalizedUsername, email: normalizedEmail,
      passwordHash: await bcrypt.hash(password, 12), role, active
    });
    await repo.save(user);
    await audit(req, 'USER_CREATED', user, { role: user.role });
    return res.status(201).json({ success: true, user: safeUser(user) });
  } catch { return res.status(500).json({ error: 'No se pudo crear el usuario' }); }
};
export const updateUser = async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOneBy({ id: req.params.id as string });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const body = req.body || {};
    const allowed = ['name', 'username', 'email', 'role', 'active'];
    if (!Object.keys(body).length || Object.keys(body).some(k => !allowed.includes(k)))
      return res.status(400).json({ error: 'Campos no permitidos' });
    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) return res.status(400).json({ error: 'Nombre inválido' });
    if (body.username !== undefined && (typeof body.username !== 'string' || !body.username.trim())) return res.status(400).json({ error: 'Usuario inválido' });
    if (body.email !== undefined && (typeof body.email !== 'string' || !isValidEmail(body.email.trim()))) return res.status(400).json({ error: 'Correo inválido' });
    if (body.role !== undefined && !validRole(body.role)) return res.status(400).json({ error: 'Rol inválido' });
    if (body.active !== undefined && typeof body.active !== 'boolean') return res.status(400).json({ error: 'Estado inválido' });
    const nextRole = body.role ?? user.role;
    const nextActive = body.active ?? user.active;
    if (user.id === (req as any).user.id && (!nextActive || nextRole !== UserRole.ADMIN))
      return res.status(400).json({ error: 'No puedes quitarte el rol administrador ni desactivar tu propia cuenta' });
    if (user.role === UserRole.ADMIN && user.active && (!nextActive || nextRole !== UserRole.ADMIN) && !(await hasOtherActiveAdmin(user.id)))
      return res.status(409).json({ error: 'Debe permanecer al menos un administrador activo' });
    const username = body.username === undefined ? user.username : body.username.trim();
    const email = body.email === undefined ? user.email : body.email.trim().toLowerCase();
    const duplicate = await repo.findOne({ where: [{ username }, { email }] });
    if (duplicate && duplicate.id !== user.id) return res.status(409).json({ error: 'Usuario o correo ya registrado' });
    const previous = { role: user.role, active: user.active };
    Object.assign(user, {
      name: body.name === undefined ? user.name : body.name.trim(), username, email,
      role: nextRole, active: nextActive
    });
    await repo.save(user);
    await audit(req, 'USER_UPDATED', user, { previous, current: { role: user.role, active: user.active } });
    return res.json({ success: true, user: safeUser(user) });
  } catch { return res.status(500).json({ error: 'No se pudo actualizar el usuario' }); }
};
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOneBy({ id: req.params.id as string });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.id === (req as any).user.id) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    if (user.role === UserRole.ADMIN && user.active && !(await hasOtherActiveAdmin(user.id)))
      return res.status(409).json({ error: 'Debe permanecer al menos un administrador activo' });
    if (!user.active) return res.json({ success: true, user: safeUser(user), message: 'Ya estaba desactivado' });
    user.active = false;
    await repo.save(user);
    await audit(req, 'USER_DEACTIVATED', user);
    return res.json({ success: true, user: safeUser(user) });
  } catch { return res.status(500).json({ error: 'No se pudo desactivar el usuario' }); }
};
export const resetPassword = async (req: Request, res: Response) => {
  try {
    if (!validPassword(req.body?.newPassword)) return res.status(400).json({ error: 'La nueva contraseña debe tener entre 12 y 128 caracteres' });
    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOneBy({ id: req.params.id as string });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    await repo.save(user);
    await audit(req, 'USER_PASSWORD_RESET', user);
    return res.json({ success: true });
  } catch { return res.status(500).json({ error: 'No se pudo restablecer contraseña' }); }
};
export const getPermissions = (req: Request, res: Response) => {
  const role = (req as any).user.role as UserRole;
  const admin = role === UserRole.ADMIN;
  return res.json({ role, permissions: {
    dashboard: ['view'], clients: ['view', 'create', 'update', 'delete'],
    units: ['view', 'create', 'update', 'delete'],
    repeaters: ['view', 'create', 'update', 'delete'],
    transmissions: ['view', 'retry', 'export'], errors: ['view', 'retry'],
    users: admin ? ['view', 'create', 'update', 'delete', 'reset_password'] : [],
    settings: admin ? ['view', 'update'] : [], audit: admin ? ['view'] : []
  }});
};
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || !validPassword(newPassword))
      return res.status(400).json({ error: 'La nueva contraseña debe tener entre 12 y 128 caracteres' });
    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOneBy({ id: (req as any).user.id });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) return res.status(400).json({ error: 'Contraseña actual incorrecta' });
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await repo.save(user);
    await audit(req, 'PASSWORD_CHANGED', user);
    return res.json({ success: true });
  } catch { return res.status(500).json({ error: 'No se pudo cambiar contraseña' }); }
};
