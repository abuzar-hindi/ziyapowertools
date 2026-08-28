import mongoose from 'mongoose'

const customerSessionSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  tokenHash: { type: String, required: true, select: false, minlength: 64, maxlength: 64 },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ['active', 'revoked', 'expired'], default: 'active' },
}, { timestamps: true })

customerSessionSchema.index({ tokenHash: 1 }, { unique: true })
customerSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
customerSessionSchema.index({ businessId: 1, customerId: 1, status: 1 })

export default mongoose.model('CustomerSession', customerSessionSchema)
