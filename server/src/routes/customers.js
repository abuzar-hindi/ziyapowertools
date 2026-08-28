import { Router } from 'express'
import { currentCustomer, getCurrentCustomerHistory, getCustomer, getCustomerHistory, getInsights, identifyCustomer, listCustomers } from '../controllers/customerController.js'
import { authenticateAdmin } from '../middleware/authenticateAdmin.js'
import { requireBusinessScope } from '../middleware/businessScope.js'
import { establishQrContext } from '../middleware/qrContext.js'
import { authenticateCustomer } from '../middleware/authenticateCustomer.js'
import { rateLimit } from 'express-rate-limit'
import { getFeaturedPhotoImage } from '../controllers/settingsController.js'

const router = Router()
const identificationRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false })

router.post('/identify', identificationRateLimit, establishQrContext, identifyCustomer)
router.get('/me', authenticateCustomer, currentCustomer)
router.get('/me/history', authenticateCustomer, getCurrentCustomerHistory)
router.get('/me/featured-photo', authenticateCustomer, getFeaturedPhotoImage)
router.get('/insights', authenticateAdmin, requireBusinessScope, getInsights)
router.get('/', authenticateAdmin, requireBusinessScope, listCustomers)
router.get('/:customerId/history', authenticateAdmin, requireBusinessScope, getCustomerHistory)
router.get('/:customerId', authenticateAdmin, requireBusinessScope, getCustomer)

export default router
