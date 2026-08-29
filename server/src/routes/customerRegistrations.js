import { Router } from 'express'
import { authenticateAdmin } from '../middleware/authenticateAdmin.js'
import { requireBusinessScope } from '../middleware/businessScope.js'
import { listPendingRegistrations, reviewRegistration } from '../controllers/customerRegistrationController.js'

const router = Router()

router.get('/pending', authenticateAdmin, requireBusinessScope, listPendingRegistrations)
router.post('/:registrationId/review', authenticateAdmin, requireBusinessScope, reviewRegistration)

export default router
