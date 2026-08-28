import { Router } from 'express'
import { getDashboard } from '../controllers/dashboardController.js'
import { authenticateAdmin } from '../middleware/authenticateAdmin.js'
import { requireBusinessScope } from '../middleware/businessScope.js'

const router = Router()

router.get('/', authenticateAdmin, requireBusinessScope, getDashboard)

export default router
