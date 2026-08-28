import mongoose from 'mongoose'
import { calendarDay } from '../services/calendarService.js'

const visitSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  qrSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QrSession' },
  occurredAt: { type: Date, required: true, default: Date.now, index: true },
  stampDay: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  idempotencyKey: { type: String, trim: true, maxlength: 200 },
}, { timestamps: true })

visitSchema.pre('validate', async function preSetStampDay() {
  if (this.stampDay || !this.occurredAt) return

  const Business = mongoose.model('Business')
  const business = await Business.findById(this.businessId).lean()
  this.stampDay = calendarDay(this.occurredAt, business)
})

visitSchema.index({ businessId: 1, customerId: 1, occurredAt: -1 })
visitSchema.index({ businessId: 1, occurredAt: -1 })
visitSchema.index({ businessId: 1, customerId: 1, stampDay: 1 }, { unique: true })
visitSchema.index({ businessId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } })

export default mongoose.model('Visit', visitSchema)
