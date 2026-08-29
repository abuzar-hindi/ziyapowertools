import mongoose from 'mongoose'
import { Business, Customer, CustomerRegistration, CustomerReward, FeaturedPhoto, LoyaltyProgram, Reward, StampEvent, Visit } from '../models/index.js'
import { normalizePhone } from '../models/Customer.js'
import { CustomerSession } from '../models/index.js'
import { ACCESS_TOKEN_COOKIE, createCustomerSessionToken, customerSessionCookieOptions, hashToken } from '../config/customerSession.js'
import { publicShopStatus } from '../services/shopStatusService.js'

const publicCustomer = (customer) => ({
  id: customer._id.toString(),
  name: customer.name,
  phone: customer.displayPhone,
  createdAt: customer.createdAt,
  updatedAt: customer.updatedAt,
})

const publicBusinessLinks = (business) => ({
  name: business.name,
  logo: business.logo || '',
  address: business.address || {},
  phone: business.phone || '',
  whatsappNumber: business.whatsappNumber || '',
  googleReviewUrl: business.googleReviewUrl || '',
  socialLinks: business.socialLinks || {},
  shopStatus: publicShopStatus(business),
  featuredPhotoUrl: business.featuredPhotoUrl || '',
})

function validationError(message) {
  return { error: { code: 'VALIDATION_ERROR', message } }
}

function validateInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'A valid object is required'
  const { name, phone } = body
  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 120) return 'Name must be between 1 and 120 characters'
  if (typeof phone !== 'string' || !/^\+?[1-9][\d ()-]{6,24}$/.test(phone.trim())) return 'Enter a valid phone number'
  return null
}

async function progressFor(customerId, businessId) {
  const customer = await Customer.findOne({ _id: customerId, businessId }).select('activitySummary.totalStamps').lean()
  const program = await LoyaltyProgram.findOne({ businessId, active: true }).sort({ createdAt: 1 }).lean()
  return { current: customer?.activitySummary?.totalStamps || 0, required: program?.stampsRequired || 0 }
}

export async function identifyCustomer(request, response, next) {
  const inputError = validateInput(request.body)
  if (inputError) return response.status(400).json(validationError(inputError))

  const { name, phone } = request.body
  const normalizedPhone = normalizePhone(phone)
  try {
    const existingCustomer = await Customer.findOne({ businessId: request.businessId, normalizedPhone }).lean()
    if (existingCustomer) {
      const featuredPhoto = await FeaturedPhoto.exists({ businessId: request.businessId })
      const sessionToken = createCustomerSessionToken()
      const value = Number(process.env.CUSTOMER_SESSION_TTL_MINUTES)
      const minutes = Number.isFinite(value) && value >= 5 && value <= 1440 ? value : 30
      await CustomerSession.deleteMany({ customerId: existingCustomer._id, status: 'active' })
      await CustomerSession.create({ businessId: request.businessId, customerId: existingCustomer._id, tokenHash: hashToken(sessionToken), expiresAt: new Date(Date.now() + minutes * 60 * 1000) })
      response.cookie(ACCESS_TOKEN_COOKIE, sessionToken, customerSessionCookieOptions())
      const customerProfile = publicCustomer(existingCustomer)
      delete customerProfile.id
      return response.status(200).json({ data: { customer: customerProfile, business: publicBusinessLinks({ ...request.qrBusiness, featuredPhotoUrl: featuredPhoto ? '/api/customers/me/featured-photo' : '' }) } })
    }

    let registration = await CustomerRegistration.findOne({ businessId: request.businessId, normalizedPhone }).lean()
    if (!registration || registration.status === 'rejected') {
      registration = await CustomerRegistration.create({
        businessId: request.businessId,
        name: name.trim(),
        normalizedPhone,
        displayPhone: phone.trim(),
        status: 'pending',
      })
    }

    return response.status(202).json({
      data: {
        registrationPending: true,
        message: 'Your registration is waiting for approval.',
        registration: {
          id: registration._id ? registration._id.toString() : registration.id,
          name: registration.name,
          phone: registration.displayPhone,
          status: registration.status,
        },
        business: publicBusinessLinks(request.qrBusiness),
      },
    })
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError || error.code === 11000) return response.status(400).json(validationError('Customer details are invalid'))
    return next(error)
  }
}


export async function currentCustomer(request, response, next) {
  try {
    const [customer, business, featuredPhoto] = await Promise.all([
      Customer.findOne({ _id: request.customer.id, businessId: request.customer.businessId }).lean(),
      Business.findById(request.customer.businessId).select('name logo phone whatsappNumber address socialLinks googleReviewUrl settings').lean(),
      FeaturedPhoto.exists({ businessId: request.customer.businessId }),
    ])
    if (!customer) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } })
    return response.json({ data: { customer: publicCustomer(customer), business: publicBusinessLinks({ ...business, featuredPhotoUrl: featuredPhoto ? '/api/customers/me/featured-photo' : '' }) } })
  } catch (error) {
    return next(error)
  }
}

export async function getCurrentCustomerHistory(request, response, next) {
  try {
    const [visits, rewards] = await Promise.all([
      Visit.find({ businessId: request.customer.businessId, customerId: request.customer.id }).sort({ occurredAt: -1 }).limit(50).select('occurredAt stampDay').lean(),
      CustomerReward.find({ businessId: request.customer.businessId, customerId: request.customer.id }).sort({ unlockedAt: -1 }).limit(20).select('unlockedAt redeemedAt status description').lean(),
    ])
    return response.json({ data: { visits, rewards } })
  } catch (error) {
    return next(error)
  }
}

export async function listCustomers(request, response, next) {
  try {
    const businessId = request.admin.businessId
    const search = String(request.query.search || '').trim()
    const page = Math.max(1, Number(request.query.page || 1))
    const limit = Math.min(100, Math.max(1, Number(request.query.limit || 20)))
    const filter = String(request.query.filter || 'all')
    const skip = (page - 1) * limit
    const query = { businessId }

    if (search) {
      const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      query.$or = [{ name: pattern }, { normalizedPhone: pattern }, { displayPhone: pattern }]
    }

    const now = new Date()
    if (filter === 'inactive') {
      const threshold = new Date(now.getTime() - (Number(request.query.inactiveDays || 30) * 24 * 60 * 60 * 1000))
      query['activitySummary.lastVisitAt'] = { $lt: threshold }
    }
    if (filter === 'recently-active') {
      const threshold = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
      query['activitySummary.lastVisitAt'] = { $gt: threshold }
    }
    if (filter === 'new') {
      const threshold = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
      query.createdAt = { $gt: threshold }
    }

    const program = await LoyaltyProgram.findOne({ businessId, active: true }).sort({ createdAt: 1 }).lean()
    const required = program?.stampsRequired || 0
    const total = await Customer.countDocuments(query)
    const customers = await Customer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()

    const allRewardIds = customers.map((customer) => customer._id)
    const rewardRecords = await CustomerReward.find({ businessId, customerId: { $in: allRewardIds }, status: 'unlocked' }).lean()
    const rewardMap = new Map(rewardRecords.map((record) => [record.customerId.toString(), record]))

    const rows = await Promise.all(customers.map(async (customer) => {
      const currentProgress = await progressFor(customer._id, businessId)
      const rewardState = rewardMap.get(customer._id.toString())
      const row = {
        id: customer._id.toString(),
        name: customer.name,
        phone: customer.displayPhone,
        totalVisits: customer.activitySummary?.totalVisits || 0,
        totalStamps: customer.activitySummary?.totalStamps || 0,
        lastVisitAt: customer.activitySummary?.lastVisitAt || null,
        createdAt: customer.createdAt,
        progress: currentProgress,
        rewardReady: Boolean(rewardState) || (required > 0 && currentProgress.current >= required),
      }
      return row
    }))

    return response.json({
      data: {
        customers: rows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function getCustomer(request, response, next) {
  if (!mongoose.isValidObjectId(request.params.customerId)) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } })
  try {
    const customer = await Customer.findOne({ _id: request.params.customerId, businessId: request.businessId }).lean()
    if (!customer) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } })
    const progress = await progressFor(customer._id, request.businessId)
    const rewardRecord = await CustomerReward.findOne({ businessId: request.businessId, customerId: customer._id, status: 'unlocked' }).lean()
    const reward = rewardRecord ? await Reward.findById(rewardRecord.rewardId).lean() : null
    return response.json({ data: { customer: { ...publicCustomer(customer), progress, reward: reward ? { id: reward._id.toString(), description: reward.description, status: reward.status } : null } } })
  } catch (error) {
    return next(error)
  }
}

export async function getCustomerHistory(request, response, next) {
  if (!mongoose.isValidObjectId(request.params.customerId)) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } })
  try {
    const customer = await Customer.findOne({ _id: request.params.customerId, businessId: request.businessId }).lean()
    if (!customer) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } })

    const [visits, stamps, rewards] = await Promise.all([
      Visit.find({ businessId: request.businessId, customerId: customer._id }).sort({ occurredAt: -1 }).lean(),
      StampEvent.find({ businessId: request.businessId, customerId: customer._id }).sort({ createdAt: -1 }).lean(),
      CustomerReward.find({ businessId: request.businessId, customerId: customer._id }).sort({ unlockedAt: -1 }).lean(),
    ])

    const rewardIds = rewards.map((reward) => reward.rewardId)
    const rewardLookup = new Map((await Reward.find({ _id: { $in: rewardIds } }).lean()).map((reward) => [reward._id.toString(), reward]))

    return response.json({
      data: {
        customer: publicCustomer(customer),
        progress: await progressFor(customer._id, request.businessId),
        visits,
        stamps,
        rewards: rewards.map((reward) => ({ ...reward, description: rewardLookup.get(reward.rewardId.toString())?.description || null })),
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function getInsights(request, response, next) {
  try {
    const businessId = request.admin.businessId
    const [totalCustomers, activeCustomers, inactiveCustomers, recentVisits, waitingRewards, almostRewardCustomers] = await Promise.all([
      Customer.countDocuments({ businessId }),
      Customer.countDocuments({ businessId, 'activitySummary.lastVisitAt': { $gte: new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)) } }),
      Customer.countDocuments({ businessId, $or: [{ 'activitySummary.lastVisitAt': { $lt: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)) } }, { 'activitySummary.lastVisitAt': null }] }),
      Visit.countDocuments({ businessId, occurredAt: { $gte: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)) } }),
      CustomerReward.countDocuments({ businessId, status: 'unlocked' }),
      Customer.countDocuments({ businessId, 'activitySummary.totalStamps': { $gte: 1 } }),
    ])

    return response.json({
      data: {
        summary: {
          totalCustomers,
          activeCustomers,
          inactiveCustomers,
          visitsThisPeriod: recentVisits,
          rewardsWaiting: waitingRewards,
          customersAlmostAtReward: almostRewardCustomers,
        },
      },
    })
  } catch (error) {
    return next(error)
  }
}
