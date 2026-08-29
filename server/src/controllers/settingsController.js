import mongoose from 'mongoose'
import { v2 as cloudinary } from 'cloudinary'
import { Business, FeaturedPhoto, LoyaltyProgram, Reward } from '../models/index.js'
import { publicShopStatus } from '../services/shopStatusService.js'
import { imageSize } from 'image-size'

const urlFields = ['logo', 'googleReviewUrl', 'socialLinks.instagram', 'socialLinks.facebook']
const phonePattern = /^\+?[1-9][\d ()-]{6,24}$/

function isValidUrl(value) {
  if (value === undefined || value === null || value === '') return true
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

function isValidPhone(value) {
  return value === undefined || value === null || value === '' || phonePattern.test(value)
}

function validateBusinessInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'A valid object is required'
  const allowed = ['name', 'logo', 'address', 'phone', 'whatsappNumber', 'instagramUrl', 'facebookUrl', 'googleReviewUrl', 'socialLinks']
  if (Object.keys(input).some((key) => !allowed.includes(key))) return 'Unsupported business field'
  if (input.name !== undefined && (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 120)) return 'Business name is invalid'
  if (input.address !== undefined && (typeof input.address !== 'object' || Array.isArray(input.address))) return 'Address is invalid'
  if (urlFields.some((field) => !isValidUrl(field.includes('.') ? input.socialLinks?.[field.split('.')[1]] : input[field]))) return 'A valid HTTP or HTTPS URL is required'
  if (input.instagramUrl !== undefined && !isValidUrl(input.instagramUrl)) return 'A valid HTTP or HTTPS URL is required'
  if (input.facebookUrl !== undefined && !isValidUrl(input.facebookUrl)) return 'A valid HTTP or HTTPS URL is required'
  if (!isValidPhone(input.phone) || !isValidPhone(input.whatsappNumber)) return 'Phone number is invalid'
  return null
}

function publicBusiness(business) {
  return {
    id: business._id.toString(),
    name: business.name,
    logo: business.logo || '',
    address: business.address || {},
    phone: business.phone || '',
    whatsappNumber: business.whatsappNumber || '',
    googleReviewUrl: business.googleReviewUrl || '',
    socialLinks: business.socialLinks || {},
    settings: business.settings || {},
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
  }
}

function sendValidationError(response, message) {
  return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message } })
}

export async function getBusiness(request, response, next) {
  try {
    const business = await Business.findById(request.businessId).lean()
    if (!business) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Business not found' } })
    return response.json({ data: { business: publicBusiness(business) } })
  } catch (error) {
    return next(error)
  }
}

export async function updateBusiness(request, response, next) {
  const validationError = validateBusinessInput(request.body)
  if (validationError) return sendValidationError(response, validationError)

  const updates = { ...request.body }
  if (updates.instagramUrl !== undefined || updates.facebookUrl !== undefined) {
    updates.socialLinks = { ...updates.socialLinks, ...(updates.instagramUrl !== undefined && { instagram: updates.instagramUrl }), ...(updates.facebookUrl !== undefined && { facebook: updates.facebookUrl }) }
    delete updates.instagramUrl
    delete updates.facebookUrl
  }

  try {
    const business = await Business.findByIdAndUpdate(request.businessId, { $set: updates }, { returnDocument: 'after', runValidators: true }).lean()
    if (!business) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Business not found' } })
    return response.json({ data: { business: publicBusiness(business) } })
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) return sendValidationError(response, 'Business settings are invalid')
    return next(error)
  }
}

export async function getShop(request, response, next) {
  try {
    const business = await Business.findById(request.businessId).select('settings').lean()
    return response.json({ data: { settings: business?.settings || {}, status: publicShopStatus(business) } })
  } catch (error) { return next(error) }
}

export async function updateShop(request, response, next) {
  const { manualStatus, days, openTime, closeTime } = request.body || {}
  if (!['auto', 'open', 'closed'].includes(manualStatus) || !Array.isArray(days) || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(openTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(closeTime)) return sendValidationError(response, 'Shop hours and status are invalid')
  try {
    const business = await Business.findByIdAndUpdate(request.businessId, { $set: { 'settings.manualStatus': manualStatus, 'settings.operatingHours': { days: [...new Set(days)], openTime, closeTime } } }, { returnDocument: 'after', runValidators: true }).lean()
    return response.json({ data: { settings: business.settings, status: publicShopStatus(business) } })
  } catch (error) { return next(error) }
}

export async function getFeaturedPhoto(request, response, next) {
  try {
    const photo = await FeaturedPhoto.findOne({ businessId: request.businessId }).select('cloudinaryUrl contentType width height updatedAt').lean()
    return response.json({ data: { photo: photo ? { url: photo.cloudinaryUrl || `/api/business/featured-photo/image`, contentType: photo.contentType, width: photo.width, height: photo.height, updatedAt: photo.updatedAt } : null } })
  } catch (error) { return next(error) }
}

export async function getFeaturedPhotoImage(request, response, next) {
  try {
    const businessId = request.businessId || request.customer?.businessId
    if (!businessId) return response.status(401).end()
    const photo = await FeaturedPhoto.findOne({ businessId }).select('+content contentType cloudinaryUrl').lean()
    if (!photo) return response.status(404).end()
    if (photo.cloudinaryUrl) {
      return response.redirect(302, photo.cloudinaryUrl)
    }
    response.type(photo.contentType).set('Cache-Control', 'private, max-age=300').send(photo.content)
  } catch (error) { return next(error) }
}

export async function uploadFeaturedPhoto(request, response, next) {
  if (!request.file) return sendValidationError(response, 'A photo is required')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(request.file.mimetype) || request.file.size > 5 * 1024 * 1024) return sendValidationError(response, 'Use a JPEG, PNG, or WebP image up to 5 MB')
  try {
    let dimensions
    try { dimensions = imageSize(request.file.buffer) } catch { return sendValidationError(response, 'The uploaded file is not a valid image') }
    if (dimensions.width < dimensions.height || dimensions.width / dimensions.height < 1.2) return sendValidationError(response, 'Featured photo must be landscape-oriented')
    const existing = await FeaturedPhoto.findOne({ businessId: request.businessId }).lean()
    if (existing && request.body?.replace !== 'true') return response.status(409).json({ error: { code: 'FEATURED_PHOTO_EXISTS', message: 'A featured photo already exists. Replace it?' } })

    let cloudinaryUrl = ''
    let publicId = ''
    if (process.env.cloud_name && process.env.cloud_api_key && process.env.cloud_api_secret) {
      cloudinary.config({
        cloud_name: process.env.cloud_name,
        api_key: process.env.cloud_api_key,
        api_secret: process.env.cloud_api_secret,
        secure: true,
      })
      if (existing?.publicId) {
        await cloudinary.uploader.destroy(existing.publicId).catch(() => {})
      }
      const cloudResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'loyalty_featured_photos', resource_type: 'image' },
          (err, result) => (err ? reject(err) : resolve(result)),
        )
        stream.end(request.file.buffer)
      })
      cloudinaryUrl = cloudResult.secure_url
      publicId = cloudResult.public_id
    }

    const photo = await FeaturedPhoto.findOneAndUpdate(
      { businessId: request.businessId },
      { $set: { businessId: request.businessId, cloudinaryUrl, publicId, content: request.file.buffer, contentType: request.file.mimetype, byteSize: request.file.size, width: dimensions.width, height: dimensions.height } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    ).lean()
    const returnedUrl = photo.cloudinaryUrl || '/api/business/featured-photo/image'
    return response.json({ data: { photo: { url: returnedUrl, contentType: photo.contentType, width: photo.width, height: photo.height, updatedAt: photo.updatedAt } } })
  } catch (error) { return next(error) }
}

export async function removeFeaturedPhoto(request, response, next) {
  try {
    const existing = await FeaturedPhoto.findOne({ businessId: request.businessId }).lean()
    if (existing?.publicId && process.env.cloud_name) {
      cloudinary.config({
        cloud_name: process.env.cloud_name,
        api_key: process.env.cloud_api_key,
        api_secret: process.env.cloud_api_secret,
        secure: true,
      })
      await cloudinary.uploader.destroy(existing.publicId).catch(() => {})
    }
    await FeaturedPhoto.deleteOne({ businessId: request.businessId })
    return response.json({ data: { removed: true } })
  } catch (error) { return next(error) }
}


export async function getLoyaltyProgram(request, response, next) {
  try {
    const program = await LoyaltyProgram.findOne({ businessId: request.businessId }).sort({ createdAt: 1 }).lean()
    return response.json({ data: { program: program || null } })
  } catch (error) {
    return next(error)
  }
}

export async function updateLoyaltyProgram(request, response, next) {
  const { active, stampsRequired } = request.body || {}
  if (typeof active !== 'boolean' || !Number.isInteger(stampsRequired) || stampsRequired < 1 || stampsRequired > 100) return sendValidationError(response, 'Active status and stamps required must be valid')
  try {
    const program = await LoyaltyProgram.findOneAndUpdate(
      { businessId: request.businessId },
      { $set: { businessId: request.businessId, active, stampsRequired } },
      { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean()
    return response.json({ data: { program } })
  } catch (error) {
    return next(error)
  }
}

export async function getReward(request, response, next) {
  try {
    const reward = await Reward.findOne({ businessId: request.businessId }).sort({ createdAt: 1 }).lean()
    return response.json({ data: { reward: reward || null } })
  } catch (error) {
    return next(error)
  }
}

export async function updateReward(request, response, next) {
  const { description, status } = request.body || {}
  if (typeof description !== 'string' || !description.trim() || description.length > 240 || !['active', 'inactive'].includes(status)) return sendValidationError(response, 'Reward description and status must be valid')
  try {
    const program = await LoyaltyProgram.findOne({ businessId: request.businessId }).sort({ createdAt: 1 })
    if (!program) return response.status(409).json({ error: { code: 'PROGRAM_REQUIRED', message: 'Configure the loyalty program first' } })
    const reward = await Reward.findOneAndUpdate(
      { businessId: request.businessId },
      { $set: { businessId: request.businessId, loyaltyProgramId: program._id, description: description.trim(), status } },
      { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean()
    return response.json({ data: { reward } })
  } catch (error) {
    return next(error)
  }
}
