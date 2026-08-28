import mongoose from 'mongoose'

export function normalizePhone(value) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  return digits ? `${hasPlus ? '+' : ''}${digits}` : digits
}

const normalizedPhoneValidator = {
  validator: (value) => /^\+?[1-9]\d{7,14}$/.test(value),
  message: 'normalizedPhone must be a valid phone number',
}

const customerSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  normalizedPhone: { type: String, required: true, trim: true, set: normalizePhone, validate: normalizedPhoneValidator },
  displayPhone: { type: String, required: true, trim: true, maxlength: 30 },
  activitySummary: {
    totalVisits: { type: Number, min: 0, default: 0 },
    totalStamps: { type: Number, min: 0, default: 0 },
    firstVisitAt: Date,
    lastVisitAt: Date,
  },
}, { timestamps: true })

customerSchema.index({ businessId: 1, normalizedPhone: 1 }, { unique: true })
customerSchema.index({ businessId: 1, 'activitySummary.lastVisitAt': -1 })
customerSchema.index({ businessId: 1, createdAt: -1 })

export default mongoose.model('Customer', customerSchema)
