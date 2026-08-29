import mongoose from 'mongoose'
import { normalizePhone } from './Customer.js'

const customerRegistrationSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  normalizedPhone: { type: String, required: true, trim: true, set: normalizePhone },
  displayPhone: { type: String, required: true, trim: true, maxlength: 30 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  requestedAt: { type: Date, required: true, default: Date.now, index: true },
  reviewedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
}, { timestamps: true })

customerRegistrationSchema.index({ businessId: 1, normalizedPhone: 1, status: 1 })

export default mongoose.model('CustomerRegistration', customerRegistrationSchema)
