import { Router } from 'express'
import { currentAdmin, login, logout, protectedAdminShell } from '../controllers/authController.js'
import { authenticateAdmin } from '../middleware/authenticateAdmin.js'
import { requireBusinessScope } from '../middleware/businessScope.js'

const router = Router()

router.post('/login', login)
router.post('/logout', logout)
router.get('/me', authenticateAdmin, currentAdmin)
router.get('/admin-shell', authenticateAdmin, requireBusinessScope, protectedAdminShell)

export default router
