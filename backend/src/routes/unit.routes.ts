import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { UserRole } from '../entities/User';
import * as unitController from '../controllers/unit.controller';

const router = Router();

router.use(requireAuth);

router.get('/', unitController.getUnits);
router.get('/pending', unitController.getPendingUnits);
router.post('/', requireRole(UserRole.ADMIN, UserRole.OPERATOR), unitController.createUnit);
router.post('/pending/:imei/associate', requireRole(UserRole.ADMIN, UserRole.OPERATOR), unitController.associatePendingUnit);
router.patch('/:id', requireRole(UserRole.ADMIN, UserRole.OPERATOR), unitController.updateUnit);

export default router;
