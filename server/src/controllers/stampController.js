import mongoose from 'mongoose'
import { Business, Customer, CustomerReward, LoyaltyProgram, Reward, StampEvent, StampRequest, Visit } from '../models/index.js'
import { validateQrToken } from '../services/qrService.js'
import { calendarDay } from '../services/calendarService.js'

function invalidQr(response) {
  return response.status(404).json({ error: { code: 'INVALID_QR', message: 'This QR code is invalid or expired' } })
}

async function progressFor(customerId, businessId) {
  const customer = await Customer.findOne({ _id: customerId, businessId }).select('activitySummary.totalStamps').lean()
  const program = await LoyaltyProgram.findOne({ businessId, active: true }).sort({ createdAt: 1 }).lean()
  return { current: customer?.activitySummary?.totalStamps || 0, required: program?.stampsRequired || 0 }
}

async function maybeUnlockReward(customerId, businessId) {
  const [customer, program, rewards] = await Promise.all([
    Customer.findOne({ _id: customerId, businessId }).select('activitySummary.totalStamps').lean(),
    LoyaltyProgram.findOne({ businessId, active: true }).sort({ createdAt: 1 }).lean(),
    Reward.find({ businessId, status: 'active' }).sort({ milestoneStamps: 1, createdAt: 1 }).lean(),
  ])

  if (!program || !rewards.length) return null
  const current = customer?.activitySummary?.totalStamps || 0
  const eligible = rewards.filter((reward) => current >= (reward.milestoneStamps || program.stampsRequired))
  if (!eligible.length) return null
  let latestUnlocked = null
  for (const reward of eligible) {
    const latest = await CustomerReward.findOne({ businessId, customerId, rewardId: reward._id }).sort({ cycleNumber: -1, createdAt: -1 }).lean()
    if (latest && latest.status !== 'redeemed') { latestUnlocked ||= latest; continue }
    const nextCycle = latest ? (latest.cycleNumber || 0) + 1 : 1
    const created = await CustomerReward.create({ businessId, customerId, rewardId: reward._id, cycleNumber: nextCycle, unlockedAt: new Date(), status: 'unlocked' })
    latestUnlocked ||= created
  }
  return latestUnlocked
}

async function requestDayFor(businessId) {
  const business = await Business.findById(businessId).select('settings').lean()
  return { business, stampDay: calendarDay(new Date(), business) }
}

export async function createOfficialStamp({ businessId, customerId, qrSessionId, qrTokenHash, requestId }) {
  const { business, stampDay } = await requestDayFor(businessId)
  const occurredAt = new Date()
  const visit = await Visit.create({ businessId, customerId, qrSessionId, occurredAt, stampDay, idempotencyKey: requestId })
  await StampEvent.create({ businessId, customerId, visitId: visit._id, quantity: 1, source: 'qr' })
  await Customer.updateOne({ _id: customerId, businessId }, {
    $inc: { 'activitySummary.totalVisits': 1, 'activitySummary.totalStamps': 1 },
    $min: { 'activitySummary.firstVisitAt': occurredAt },
    $max: { 'activitySummary.lastVisitAt': occurredAt },
  })
  const reward = await maybeUnlockReward(customerId, businessId)
  return { visit, stampDay, reward, progress: await progressFor(customerId, businessId) }
}

export async function createStampRequest(request, response, next) {
  const qr = await validateQrToken(request.body?.qrToken)
  if (!qr || qr.business._id.toString() !== request.customer.businessId) return invalidQr(response)
  try {
    const { stampDay } = await requestDayFor(request.customer.businessId)
    const existingVisit = await Visit.exists({ businessId: request.customer.businessId, customerId: request.customer.id, stampDay })
    if (existingVisit) return response.status(409).json({ error: { code: 'ALREADY_STAMPED', message: "Today's stamp has already been collected" } })
    const existing = await StampRequest.findOne({ businessId: request.customer.businessId, customerId: request.customer.id, requestDay: stampDay, status: 'pending' }).lean()
    if (existing) return response.status(409).json({ error: { code: 'STAMP_REQUEST_PENDING', message: 'Your stamp request is waiting for confirmation' }, data: { request: publicStampRequest(existing) } })
    const stampRequest = await StampRequest.create({ businessId: request.customer.businessId, customerId: request.customer.id, qrTokenHash: qr.tokenHash || hashToken(request.body.qrToken), requestDay: stampDay, status: 'pending' })
    return response.status(202).json({ data: { request: publicStampRequest(stampRequest) } })
  } catch (error) {
    if (error?.code === 11000) return response.status(409).json({ error: { code: 'STAMP_REQUEST_PENDING', message: 'Your stamp request is waiting for confirmation' } })
    return next(error)
  }
}

function publicStampRequest(stampRequest, customer) {
  return { id: stampRequest._id.toString(), status: stampRequest.status, requestedAt: stampRequest.requestedAt, requestDay: stampRequest.requestDay, reviewedAt: stampRequest.reviewedAt, rejectionReason: stampRequest.rejectionReason, customer: customer ? { name: customer.name, phone: customer.displayPhone } : undefined }
}

export async function getCurrentStampRequest(request, response, next) {
  try {
    const { stampDay } = await requestDayFor(request.customer.businessId)
    const stampRequest = await StampRequest.findOne({ businessId: request.customer.businessId, customerId: request.customer.id, requestDay: stampDay }).sort({ requestedAt: -1 }).lean()
    return response.json({ data: { request: stampRequest ? publicStampRequest(stampRequest) : null } })
  } catch (error) { return next(error) }
}

export async function listPendingStampRequests(request, response, next) {
  try {
    const businessId = new mongoose.Types.ObjectId(request.admin.businessId)
    const requests = await StampRequest.find({ businessId, status: 'pending' }).sort({ requestedAt: 1 }).limit(100).lean()
    const customers = await Customer.find({ businessId, _id: { $in: requests.map((item) => item.customerId) } }).select('name displayPhone').lean()
    const customerMap = new Map(customers.map((customer) => [customer._id.toString(), customer]))
    return response.json({ data: { requests: requests.map((item) => publicStampRequest(item, customerMap.get(item.customerId.toString()))) } })
  } catch (error) { return next(error) }
}

export async function reviewStampRequest(request, response, next) {
  const { requestId } = request.params
  if (!mongoose.isValidObjectId(requestId)) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Stamp request not found' } })
  const action = request.body?.action
  if (!['approve', 'reject'].includes(action)) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Action must be approve or reject' } })
  try {
    const businessId = new mongoose.Types.ObjectId(request.admin.businessId)
    const stampRequest = await StampRequest.findOneAndUpdate({ _id: requestId, businessId, status: 'pending' }, { $set: { status: action === 'approve' ? 'approved' : 'rejected', reviewedAt: new Date(), reviewedBy: request.admin.id, ...(action === 'reject' ? { rejectionReason: 'Rejected by business' } : {}) } }, { returnDocument: 'after' }).lean()
    if (!stampRequest) return response.status(409).json({ error: { code: 'REQUEST_ALREADY_REVIEWED', message: 'This stamp request has already been reviewed' } })
    if (action === 'reject') return response.json({ data: { request: publicStampRequest(stampRequest) } })
    try {
      const official = await createOfficialStamp({ businessId: stampRequest.businessId, customerId: stampRequest.customerId, requestId: `stamp-request:${stampRequest._id}` })
      await StampRequest.updateOne({ _id: stampRequest._id }, { $set: { visitId: official.visit?._id } })
      return response.json({ data: { request: publicStampRequest({ ...stampRequest, visitId: official.visit?._id }), stamp: { quantity: 1, stampDay: official.stampDay }, progress: official.progress, reward: official.reward ? { id: official.reward._id.toString(), status: official.reward.status, description: official.reward.description || null } : null } })
    } catch (error) {
      if (error?.code === 11000) return response.status(409).json({ error: { code: 'ALREADY_STAMPED', message: "Today's stamp has already been collected" } })
      throw error
    }
  } catch (error) { return next(error) }
}

export async function createStamp(request, response, next) {
  const { qrToken } = request.body || {}
  const qr = await validateQrToken(qrToken)
  if (!qr || qr.business._id.toString() !== request.customer.businessId) return invalidQr(response)
  if (qr.permanent) return response.status(410).json({ error: { code: 'STAMP_REQUEST_REQUIRED', message: 'Stamp requests require business confirmation' } })

  try {
    const business = await Business.findById(request.customer.businessId).lean()
    const occurredAt = new Date()
    const stampDay = calendarDay(occurredAt, business)
    const visit = await Visit.create({
      businessId: request.customer.businessId,
      customerId: request.customer.id,
      qrSessionId: qr.session._id,
      occurredAt,
      stampDay,
    })
    await StampEvent.create({
      businessId: request.customer.businessId,
      customerId: request.customer.id,
      visitId: visit._id,
      quantity: 1,
      source: 'qr',
    })
    await Customer.updateOne({ _id: request.customer.id, businessId: request.customer.businessId }, {
      $inc: { 'activitySummary.totalVisits': 1, 'activitySummary.totalStamps': 1 },
      $min: { 'activitySummary.firstVisitAt': occurredAt },
      $max: { 'activitySummary.lastVisitAt': occurredAt },
    })
    const reward = await maybeUnlockReward(request.customer.id, request.customer.businessId)
    const summary = await progressFor(request.customer.id, request.customer.businessId)
    return response.status(201).json({
      data: {
        stamp: { quantity: 1, stampDay },
        progress: summary,
        reward: reward ? { id: reward._id.toString(), status: reward.status, description: reward.description || null } : null,
      },
    })
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({ error: { code: 'ALREADY_STAMPED', message: "Today's stamp has already been collected" } })
    }
    return next(error)
  }
}

export async function getStampProgress(request, response, next) {
  try {
    return response.json({ data: { progress: await progressFor(request.customer.id, request.customer.businessId) } })
  } catch (error) {
    return next(error)
  }
}
