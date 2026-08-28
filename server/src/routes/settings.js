import { Router } from 'express'
import {
  getBusiness,
  getLoyaltyProgram,
  getReward,
  updateBusiness,
  updateLoyaltyProgram,
  updateReward,
  getShop, updateShop, getFeaturedPhoto, getFeaturedPhotoImage, uploadFeaturedPhoto, removeFeaturedPhoto,
} from '../controllers/settingsController.js'
import multer from 'multer'
import { authenticateAdmin } from '../middleware/authenticateAdmin.js'
import { requireBusinessScope } from '../middleware/businessScope.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } })

router.use(authenticateAdmin, requireBusinessScope)
router.get('/business', getBusiness)
router.patch('/business', updateBusiness)
router.get('/loyalty-program', getLoyaltyProgram)
router.patch('/loyalty-program', updateLoyaltyProgram)
router.get('/reward-settings', getReward)
router.patch('/reward-settings', updateReward)
router.get('/shop', getShop)
router.patch('/shop', updateShop)
router.get('/featured-photo', getFeaturedPhoto)
router.get('/featured-photo/image', getFeaturedPhotoImage)
router.post('/featured-photo', upload.single('photo'), uploadFeaturedPhoto)
router.delete('/featured-photo', removeFeaturedPhoto)

export default router
