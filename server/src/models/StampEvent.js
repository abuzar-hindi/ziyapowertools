import mongoose from 'mongoose'

const stampEventSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  visitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', required: true },
  quantity: { type: Number, required: true, min: 1, max: 100, validate: Number.isInteger },
  source: { type: String, enum: ['qr', 'admin_adjustment', 'system'], required: true },
}, { timestamps: true })

stampEventSchema.index({ businessId: 1, customerId: 1, createdAt: -1 })
stampEventSchema.index({ businessId: 1, createdAt: -1 })
stampEventSchema.index({ visitId: 1 }, { unique: true })

export default mongoose.model('StampEvent', stampEventSchema)
