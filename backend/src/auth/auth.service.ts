import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { AuditLog } from '../entities/AuditLog';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export class AuthService {
  static async login(loginId: string, pass: string, ip: string) {
    const userRepo = AppDataSource.getRepository(User);
    const auditRepo = AppDataSource.getRepository(AuditLog);

    const user = await userRepo.findOne({ 
      where: [{ username: loginId }, { email: loginId }]
    });

    if (!user) {
      await auditRepo.save({ action: 'LOGIN_FAILED', details: { loginId }, ipAddress: ip });
      throw new Error('Usuario o contraseña incorrectos.');
    }

    if (!user.active) {
      await auditRepo.save({ userId: user.id, action: 'LOGIN_FAILED', details: { reason: 'Inactive' }, ipAddress: ip });
      throw new Error('Usuario inactivo.');
    }

    const isValid = await bcrypt.compare(pass, user.passwordHash);
    if (!isValid) {
      await auditRepo.save({ userId: user.id, action: 'LOGIN_FAILED', details: { reason: 'Invalid password' }, ipAddress: ip });
      throw new Error('Usuario o contraseña incorrectos.');
    }

    user.lastLoginAt = new Date();
    await userRepo.save(user);

    await auditRepo.save({ userId: user.id, action: 'LOGIN_SUCCESS', ipAddress: ip });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' });

    return { user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role }, token };
  }
  
  static async logAudit(userId: string, action: string, ip: string, details?: any) {
    const auditRepo = AppDataSource.getRepository(AuditLog);
    await auditRepo.save({ userId, action, ipAddress: ip, details });
  }
}
