import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { UserRole } from '../entities/User';
import {
  listProtocols, listRepeaters, listAssignableUnits, createRepeater,
  updateRepeater, updateAssignments, listRepeaterTransmissions,
} from '../controllers/repeater.controller';

const router = Router();
router.use(requireAuth);
router.get('/protocols', listProtocols);
router.get('/available-units', listAssignableUnits);
router.get('/', listRepeaters);
router.post('/', requireRole(UserRole.ADMIN), createRepeater);
router.patch('/:id', requireRole(UserRole.ADMIN), updateRepeater);
router.put('/:id/units', requireRole(UserRole.ADMIN, UserRole.OPERATOR), updateAssignments);
router.get('/:id/transmissions', listRepeaterTransmissions);
export default router;
