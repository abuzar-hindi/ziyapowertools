import mongoose from 'mongoose'

const featuredPhotoSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, unique: true },
  content: { type: Buffer, required: true, select: false },
  contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
  byteSize: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
  width: { type: Number, required: true, min: 1 },
  height: { type: Number, required: true, min: 1 },
}, { timestamps: true })

export default mongoose.model('FeaturedPhoto', featuredPhotoSchema)
