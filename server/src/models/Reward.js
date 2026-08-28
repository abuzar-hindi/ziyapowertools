import mongoose from 'mongoose'

const rewardSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  loyaltyProgramId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoyaltyProgram', required: true },
  description: { type: String, required: true, trim: true, minlength: 1, maxlength: 240 },
  milestoneStamps: { type: Number, min: 1, max: 100, index: true },
  status: { type: String, enum: ['active', 'inactive', 'archived'], default: 'active', index: true },
  configuration: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true })

rewardSchema.index({ businessId: 1, status: 1 })
rewardSchema.index({ businessId: 1, milestoneStamps: 1 }, { unique: true })

export default mongoose.model('Reward', rewardSchema)
