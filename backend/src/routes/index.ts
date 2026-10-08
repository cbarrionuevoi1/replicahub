import { Router } from 'express';
import { exportTransmissions } from '../controllers/export.controller';
import { listUsers, createUser, updateUser, deleteUser, resetPassword, getPermissions, changePassword } from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { UserRole } from '../entities/User';
import repeaterRoutes from './repeater.routes';
import unitRoutes from './unit.routes';
import clientRoutes from './client.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'edited', service: 'ReplicaHub API', version: '1.0' });
});

router.get('/transmissions/export', requireAuth, exportTransmissions);

router.get('/users', requireAuth, requireRole(UserRole.ADMIN), listUsers);
router.post('/users', requireAuth, requireRole(UserRole.ADMIN), createUser);
router.patch('/users/:id', requireAuth, requireRole(UserRole.ADMIN), updateUser);
router.delete('/users/:id', requireAuth, requireRole(UserRole.ADMIN), deleteUser);
router.post('/users/:id/reset-password', requireAuth, requireRole(UserRole.ADMIN), resetPassword);
router.get('/users/me/permissions', requireAuth, getPermissions);
router.post('/users/me/password', requireAuth, changePassword);

// CRUD repeaters
router.use('/repeaters', repeaterRoutes);
router.use('/units', unitRoutes);
router.use('/clients', clientRoutes);

export default router;
