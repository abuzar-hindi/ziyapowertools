import mongoose from 'mongoose'
import { Business, Customer, CustomerReward, LoyaltyProgram, StampEvent, Visit } from '../models/index.js'
import { businessTimezone } from '../services/calendarService.js'

const periodDays = { today: 1, '7d': 7, '30d': 30 }

function periodValue(value) {
  return periodDays[value] ? value : '30d'
}

function startOfBusinessDay(date, business) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: businessTimezone(business),
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, Number(value)]))
  const desiredUtc = Date.UTC(values.year, values.month - 1, values.day)
  let candidate = new Date(desiredUtc)
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: businessTimezone(business),
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(candidate)
  const actual = Object.fromEntries(formatted.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, Number(value)]))
  const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second)
  candidate = new Date(desiredUtc + (desiredUtc - actualUtc))
  return candidate
}

function customerIdString(value) {
  return value?.toString()
}

async function customerMap(ids, businessId) {
  const customers = await Customer.find({ businessId, _id: { $in: ids } }).select('name displayPhone').lean()
  return new Map(customers.map((customer) => [customer._id.toString(), customer]))
}

async function activity(businessId, start, limit, type) {
  const [visits, stamps, rewards] = await Promise.all([
    type && type !== 'visits' ? [] : Visit.find({ businessId, occurredAt: { $gte: start } }).sort({ occurredAt: -1 }).limit(limit).lean(),
    type && type !== 'stamps' ? [] : StampEvent.find({ businessId, createdAt: { $gte: start } }).sort({ createdAt: -1 }).limit(limit).lean(),
    type && type !== 'rewards' ? [] : CustomerReward.find({ businessId, $or: [{ unlockedAt: { $gte: start } }, { redeemedAt: { $gte: start } }] }).sort({ unlockedAt: -1 }).limit(limit).lean(),
  ])
  const records = [
    ...visits.map((visit) => ({ type: 'visit', id: visit._id.toString(), customerId: customerIdString(visit.customerId), occurredAt: visit.occurredAt })),
    ...stamps.map((stamp) => ({ type: 'stamp', id: stamp._id.toString(), customerId: customerIdString(stamp.customerId), occurredAt: stamp.createdAt, quantity: stamp.quantity })),
    ...rewards.map((reward) => ({ type: reward.status === 'redeemed' ? 'reward_redeemed' : 'reward_unlocked', id: reward._id.toString(), customerId: customerIdString(reward.customerId), occurredAt: reward.status === 'redeemed' ? reward.redeemedAt : reward.unlockedAt, status: reward.status })),
  ].sort((left, right) => new Date(right.occurredAt) - new Date(left.occurredAt)).slice(0, limit)
  const names = await customerMap(records.map((record) => record.customerId), businessId)
  return records.map((record) => ({ ...record, customer: names.get(record.customerId)?.name || 'Customer' }))
}

async function segment(businessId, filter, page, limit, required) {
  const query = { businessId }
  const now = new Date()
  if (filter === 'inactive') query.$or = [{ 'activitySummary.lastVisitAt': { $lt: new Date(now.getTime() - 30 * 86400000) } }, { 'activitySummary.lastVisitAt': null }]
  if (filter === 'almost-reward') query['activitySummary.totalStamps'] = { $gte: Math.max(0, required - 1), $lt: required }
  const [total, customers] = await Promise.all([
    Customer.countDocuments(query),
    Customer.find(query).select('name displayPhone activitySummary').sort({ 'activitySummary.lastVisitAt': 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ])
  return {
    customers: customers.map((customer) => ({
      id: customer._id.toString(),
      name: customer.name,
      phone: customer.displayPhone,
      totalVisits: customer.activitySummary?.totalVisits || 0,
      totalStamps: customer.activitySummary?.totalStamps || 0,
      lastVisitAt: customer.activitySummary?.lastVisitAt || null,
    })),
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  }
}

export async function getDashboard(request, response, next) {
  try {
    const businessId = request.admin.businessId
    const scopedBusinessId = new mongoose.Types.ObjectId(businessId)
    const business = await Business.findById(businessId).select('settings').lean()
    const period = periodValue(request.query.period)
    const todayStart = startOfBusinessDay(new Date(), business)
    const start = period === 'today' ? todayStart : new Date(todayStart.getTime() - (periodDays[period] - 1) * 86400000)
    const page = Math.max(1, Number.parseInt(request.query.page || '1', 10) || 1)
    const limit = Math.min(50, Math.max(1, Number.parseInt(request.query.limit || '10', 10) || 10))
    const segmentFilter = ['inactive', 'almost-reward'].includes(request.query.segment) ? request.query.segment : null
    const program = await LoyaltyProgram.findOne({ businessId, active: true }).sort({ createdAt: 1 }).lean()
    const required = program?.stampsRequired || 1

    const [totals, newCustomers, activeCustomers, inactiveCustomers, visits, visitsToday, stampsToday, unlocked, waiting, redeemed, closeReward, topCustomers, recentActivity] = await Promise.all([
      Customer.countDocuments({ businessId }),
      Customer.countDocuments({ businessId, createdAt: { $gte: start } }),
      Customer.countDocuments({ businessId, 'activitySummary.lastVisitAt': { $gte: start } }),
      Customer.countDocuments({ businessId, $or: [{ 'activitySummary.lastVisitAt': { $lt: new Date(Date.now() - 30 * 86400000) } }, { 'activitySummary.lastVisitAt': null }] }),
      Visit.countDocuments({ businessId, occurredAt: { $gte: start } }),
      Visit.countDocuments({ businessId, occurredAt: { $gte: todayStart } }),
      StampEvent.aggregate([{ $match: { businessId: scopedBusinessId, createdAt: { $gte: todayStart } } }, { $group: { _id: null, total: { $sum: '$quantity' } } }]),
      CustomerReward.countDocuments({ businessId, status: { $in: ['unlocked', 'redeemed'] }, unlockedAt: { $gte: start } }),
      CustomerReward.countDocuments({ businessId, status: 'unlocked' }),
      CustomerReward.countDocuments({ businessId, status: 'redeemed', redeemedAt: { $gte: start } }),
      segment(businessId, 'almost-reward', page, limit, required),
      Visit.aggregate([{ $match: { businessId: scopedBusinessId, occurredAt: { $gte: start } } }, { $group: { _id: '$customerId', visits: { $sum: 1 } } }, { $sort: { visits: -1 } }, { $limit: 10 }]),
      activity(businessId, start, 20),
    ])
    const topMap = await customerMap(topCustomers.map((customer) => customer._id), businessId)
    const requestedSegment = segmentFilter ? await segment(businessId, segmentFilter, page, limit, required) : null
    return response.json({ data: {
      period,
      metrics: {
        totalCustomers: totals,
        newCustomers,
        activeCustomers,
        inactiveCustomers,
        visits,
        visitsToday,
        stampsToday: stampsToday[0]?.total || 0,
        rewardsUnlocked: unlocked,
        rewardsWaiting: waiting,
        rewardsRedeemed: redeemed,
        customersCloseToReward: closeReward.pagination.total,
      },
      recentActivity,
      topCustomers: topCustomers.map((customer) => ({ id: customer._id.toString(), name: topMap.get(customer._id.toString())?.name || 'Customer', visits: customer.visits })),
      segments: { inactive: requestedSegment?.customers || [], almostReward: closeReward.customers },
      pagination: requestedSegment?.pagination || closeReward.pagination,
    } })
  } catch (error) {
    return next(error)
  }
}