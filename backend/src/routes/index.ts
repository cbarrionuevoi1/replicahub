import { Router } from 'express';
import { exportTransmissions } from '../controllers/export.controller';
import { listUsers, createUser, changePassword } from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { UserRole } from '../entities/User';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ReplicaHub API', version: '1.0' });
});

router.get('/transmissions/export', requireAuth, exportTransmissions);

router.get('/users', requireAuth, requireRole(UserRole.ADMIN), listUsers);
router.post('/users', requireAuth, requireRole(UserRole.ADMIN), createUser);
router.post('/users/me/password', requireAuth, changePassword);

// Mock routes for phase 1 (Clients)
router.get('/clients', requireAuth, (req, res) => {
  res.json([]);
});

export default router;
