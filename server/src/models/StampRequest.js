import mongoose from 'mongoose'

const stampRequestSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  qrTokenHash: { type: String, required: true, select: false, minlength: 64, maxlength: 64 },
  requestDay: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  requestedAt: { type: Date, required: true, default: Date.now, index: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser' },
  visitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit' },
  rejectionReason: { type: String, trim: true, maxlength: 240 },
}, { timestamps: true })

stampRequestSchema.index({ businessId: 1, status: 1, requestedAt: -1 })
stampRequestSchema.index({ businessId: 1, customerId: 1, requestDay: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } })

export default mongoose.model('StampRequest', stampRequestSchema)
