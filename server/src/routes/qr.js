import { Router } from 'express'
import { createSession, getPermanentQr, validatePermanent, validateSession } from '../controllers/qrController.js'
import { authenticateAdmin } from '../middleware/authenticateAdmin.js'
import { requireBusinessScope } from '../middleware/businessScope.js'
import { rateLimit } from 'express-rate-limit'

const router = Router()
const validationRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false })

router.post('/sessions', authenticateAdmin, requireBusinessScope, createSession)
router.post('/permanent/validate', validationRateLimit, validatePermanent)
router.get('/permanent', authenticateAdmin, requireBusinessScope, getPermanentQr)
router.post('/sessions/validate', validationRateLimit, validateSession)

export default router
