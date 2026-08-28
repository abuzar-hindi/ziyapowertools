import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { createStamp, getStampProgress } from '../controllers/stampController.js'
import { authenticateCustomer } from '../middleware/authenticateCustomer.js'

const router = Router()
const stampRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false })

router.use(authenticateCustomer, stampRateLimit)
router.post('/', createStamp)
router.get('/progress', getStampProgress)

export default router
