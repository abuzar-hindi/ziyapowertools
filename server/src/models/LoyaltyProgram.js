import mongoose from 'mongoose'

const loyaltyProgramSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  stampsRequired: { type: Number, required: true, min: 1, max: 100, validate: Number.isInteger },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true })

loyaltyProgramSchema.index({ businessId: 1, active: 1 })
loyaltyProgramSchema.index({ businessId: 1 }, { unique: true })

export default mongoose.model('LoyaltyProgram', loyaltyProgramSchema)
