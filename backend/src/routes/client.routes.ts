import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { UserRole } from '../entities/User';
import * as clientController from '../controllers/client.controller';

const router = Router();

router.use(requireAuth);

router.get('/', clientController.getClients);
router.post('/', requireRole(UserRole.ADMIN, UserRole.OPERATOR), clientController.createClient);
router.patch('/:id', requireRole(UserRole.ADMIN, UserRole.OPERATOR), clientController.updateClient);

export default router;
