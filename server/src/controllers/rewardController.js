import mongoose from 'mongoose'
import { Customer, CustomerReward, LoyaltyProgram, Reward } from '../models/index.js'

function validateRewardInput(body) {
  if (!body || typeof body.description !== 'string' || !body.description.trim() || body.description.length > 240 || !['active', 'inactive'].includes(body.status) || !Number.isInteger(body.milestoneStamps) || body.milestoneStamps < 1 || body.milestoneStamps > 100) return 'Reward description, milestone, and status must be valid'
  return null
}

export async function listAdminRewards(request, response, next) {
  try { return response.json({ data: { rewards: await Reward.find({ businessId: request.admin.businessId }).sort({ milestoneStamps: 1, createdAt: 1 }).lean() } }) } catch (error) { return next(error) }
}

export async function createAdminReward(request, response, next) {
  const validationError = validateRewardInput(request.body)
  if (validationError) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validationError } })
  try {
    const program = await LoyaltyProgram.findOne({ businessId: request.admin.businessId }).sort({ createdAt: 1 }).lean()
    if (!program) return response.status(409).json({ error: { code: 'PROGRAM_REQUIRED', message: 'Configure the loyalty program first' } })
    const reward = await Reward.create({ businessId: request.admin.businessId, loyaltyProgramId: program._id, description: request.body.description.trim(), milestoneStamps: request.body.milestoneStamps, status: request.body.status })
    return response.status(201).json({ data: { reward } })
  } catch (error) { if (error?.code === 11000) return response.status(409).json({ error: { code: 'MILESTONE_EXISTS', message: 'A reward already uses that milestone' } }); return next(error) }
}

export async function updateAdminReward(request, response, next) {
  if (!mongoose.isValidObjectId(request.params.rewardId)) return rewardNotFound(response)
  const validationError = validateRewardInput(request.body)
  if (validationError) return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validationError } })
  try {
    const reward = await Reward.findOneAndUpdate({ _id: request.params.rewardId, businessId: request.admin.businessId }, { $set: { description: request.body.description.trim(), milestoneStamps: request.body.milestoneStamps, status: request.body.status } }, { returnDocument: 'after', runValidators: true }).lean()
    if (!reward) return rewardNotFound(response)
    return response.json({ data: { reward } })
  } catch (error) { if (error?.code === 11000) return response.status(409).json({ error: { code: 'MILESTONE_EXISTS', message: 'A reward already uses that milestone' } }); return next(error) }
}

function rewardNotFound(response) {
  return response.status(404).json({ error: { code: 'REWARD_NOT_FOUND', message: 'Reward not found' } })
}

export async function redeemReward(request, response, next) {
  const { customerRewardId } = request.params || {}
  if (!mongoose.isValidObjectId(customerRewardId)) return rewardNotFound(response)

  try {
    const rewardRecord = await CustomerReward.findById(customerRewardId).lean()
    if (!rewardRecord) return rewardNotFound(response)
    if (rewardRecord.businessId.toString() !== request.customer.businessId) return rewardNotFound(response)
    if (rewardRecord.customerId.toString() !== request.customer.id) {
      return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You cannot redeem this reward' } })
    }
    if (rewardRecord.status === 'redeemed') return response.status(409).json({ error: { code: 'ALREADY_REDEEMED', message: 'This reward has already been redeemed' } })

    const reward = await Reward.findOne({ _id: rewardRecord.rewardId, businessId: request.customer.businessId }).lean()
    if (!reward || reward.status !== 'active') return response.status(409).json({ error: { code: 'REWARD_DISABLED', message: 'This reward is not available right now' } })

    const updated = await CustomerReward.findOneAndUpdate(
      { _id: customerRewardId, status: 'unlocked' },
      { $set: { status: 'redeemed', redeemedAt: new Date() } },
      { returnDocument: 'after', runValidators: true },
    ).lean()

    if (!updated) return response.status(409).json({ error: { code: 'ALREADY_REDEEMED', message: 'This reward has already been redeemed' } })

    await Customer.updateOne({ _id: request.customer.id, businessId: request.customer.businessId }, {
      $set: { 'activitySummary.totalStamps': 0 },
      $max: { 'activitySummary.lastVisitAt': new Date() },
    })

    return response.json({ data: { reward: { id: updated._id.toString(), status: updated.status, redeemedAt: updated.redeemedAt, description: reward.description } } })
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({ error: { code: 'ALREADY_REDEEMED', message: 'This reward has already been redeemed' } })
    }
    return next(error)
  }
}

export async function getCustomerRewards(request, response, next) {
  try {
    const rewards = await CustomerReward.find({ businessId: request.customer.businessId, customerId: request.customer.id }).sort({ unlockedAt: -1 }).lean()
    const rewardIds = rewards.map((reward) => reward.rewardId)
    const definitions = new Map((await Reward.find({ businessId: request.customer.businessId, _id: { $in: rewardIds } }).select('description milestoneStamps').lean()).map((reward) => [reward._id.toString(), reward]))
    return response.json({ data: { rewards: rewards.map((reward) => ({ ...reward, description: definitions.get(reward.rewardId.toString())?.description || null, milestoneStamps: definitions.get(reward.rewardId.toString())?.milestoneStamps || null })) } })
  } catch (error) {
    return next(error)
  }
}
