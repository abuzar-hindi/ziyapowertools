import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { authenticateAdmin } from '../middleware/authenticateAdmin.js'
import { authenticateCustomer } from '../middleware/authenticateCustomer.js'
import { requireBusinessScope } from '../middleware/businessScope.js'
import { createStampRequest, getCurrentStampRequest, listPendingStampRequests, reviewStampRequest } from '../controllers/stampController.js'

const router = Router()
const requestRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false })

router.post('/', authenticateCustomer, requestRateLimit, createStampRequest)
router.get('/current', authenticateCustomer, getCurrentStampRequest)
router.get('/pending', authenticateAdmin, requireBusinessScope, listPendingStampRequests)
router.post('/:requestId/review', authenticateAdmin, requireBusinessScope, reviewStampRequest)

export default router
