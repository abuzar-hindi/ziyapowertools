import mongoose from 'mongoose'

const adminUserSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 254,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  passwordHash: { type: String, required: true, select: false, minlength: 20 },
  authMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['active', 'suspended', 'disabled'], default: 'active', index: true },
}, { timestamps: true })

adminUserSchema.index({ businessId: 1, email: 1 }, { unique: true })

export default mongoose.model('AdminUser', adminUserSchema)
