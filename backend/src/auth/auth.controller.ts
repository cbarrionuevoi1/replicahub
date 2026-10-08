import { Request, Response } from 'express';
import { AuthService } from './auth.service';

// En desarrollo: localhost:3000 → localhost:4000 son orígenes diferentes (cross-origin).
// SameSite=Lax permite que la cookie se envíe en navegación del mismo sitio
// pero NO en requests cross-site. Para fetch cross-origin con credentials:include
// necesitamos SameSite=None + Secure, pero en desarrollo local usamos Lax que funciona
// correctamente cuando el frontend hace fetch con credentials:include al mismo host.
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  // En producción agrega domain y path según tu configuración
  path: '/',
  maxAge: 12 * 60 * 60 * 1000, // 12 horas en ms
};

export const login = async (req: Request, res: Response) => {
  const { login: loginId, password } = req.body ?? {};
  if (typeof loginId !== 'string' || typeof password !== 'string' || !loginId.trim() || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña obligatorios.' });
  }
  const ip = req.ip || req.socket.remoteAddress || '';
  
  try {
    const { user, token } = await AuthService.login(loginId, password, ip);
    res.cookie('accessToken', token, COOKIE_OPTIONS);
    res.json({ user }); // El token no se expone a JavaScript: cookie HTTP-only.
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
};

export const logout = async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || '';
  if ((req as any).user) {
    await AuthService.logAudit((req as any).user.id, 'LOGOUT', ip);
  }
  // Limpiar con las mismas opciones para que el navegador la elimine correctamente
  res.clearCookie('accessToken', { path: '/', httpOnly: true, sameSite: 'lax' });
  res.json({ success: true });
};

export const me = async (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({ user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role }});
};
