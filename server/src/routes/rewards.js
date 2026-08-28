import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { authenticateCustomer } from '../middleware/authenticateCustomer.js'
import { createAdminReward, getCustomerRewards, listAdminRewards, redeemReward, updateAdminReward } from '../controllers/rewardController.js'
import { authenticateAdmin } from '../middleware/authenticateAdmin.js'
import { requireBusinessScope } from '../middleware/businessScope.js'

const router = Router()
const rewardRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false })

router.get('/manage', authenticateAdmin, requireBusinessScope, listAdminRewards)
router.post('/manage', authenticateAdmin, requireBusinessScope, createAdminReward)
router.patch('/manage/:rewardId', authenticateAdmin, requireBusinessScope, updateAdminReward)

router.use(authenticateCustomer, rewardRateLimit)
router.get('/', getCustomerRewards)
router.post('/:customerRewardId/redeem', redeemReward)

export default router
