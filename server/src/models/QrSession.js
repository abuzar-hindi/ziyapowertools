import mongoose from 'mongoose'

const qrSessionSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  tokenHash: { type: String, required: true, select: false, minlength: 64, maxlength: 64 },
  expiresAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['active', 'consumed', 'expired', 'revoked'], default: 'active', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', required: true },
  usedAt: Date,
  usageCount: { type: Number, min: 0, default: 0, validate: Number.isInteger },
  maxUses: { type: Number, min: 1, max: 100, default: 1, validate: Number.isInteger },
}, { timestamps: true })

qrSessionSchema.index({ businessId: 1, tokenHash: 1 }, { unique: true })
qrSessionSchema.index({ businessId: 1, expiresAt: 1, status: 1 })

export default mongoose.model('QrSession', qrSessionSchema)
