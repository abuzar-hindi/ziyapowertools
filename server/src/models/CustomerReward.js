import mongoose from 'mongoose'

const customerRewardSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  rewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', required: true },
  cycleNumber: { type: Number, required: true, min: 1, default: 1 },
  unlockedAt: { type: Date, required: true, default: Date.now },
  redeemedAt: Date,
  status: { type: String, enum: ['unlocked', 'redeemed', 'expired'], default: 'unlocked', index: true },
}, { timestamps: true })

customerRewardSchema.index({ businessId: 1, customerId: 1, status: 1 })
customerRewardSchema.index({ businessId: 1, status: 1, unlockedAt: -1 })
customerRewardSchema.index({ businessId: 1, customerId: 1, rewardId: 1, cycleNumber: 1 }, { unique: true })

export default mongoose.model('CustomerReward', customerRewardSchema)
