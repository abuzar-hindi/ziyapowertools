import mongoose from 'mongoose'

const urlValidator = {
  validator: (value) => !value || /^https?:\/\/\S+$/i.test(value),
  message: 'Must be a valid HTTP or HTTPS URL',
}

const phoneValidator = {
  validator: (value) => !value || /^\+?[1-9][\d ()-]{6,24}$/.test(value),
  message: 'Must be a valid phone number',
}

const businessSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  logo: { type: String, trim: true, maxlength: 500, validate: urlValidator },
  address: {
    line1: { type: String, trim: true, maxlength: 160 },
    line2: { type: String, trim: true, maxlength: 160 },
    city: { type: String, trim: true, maxlength: 80 },
    postalCode: { type: String, trim: true, maxlength: 20 },
    country: { type: String, trim: true, maxlength: 80 },
  },
  phone: { type: String, trim: true, maxlength: 30, validate: phoneValidator },
  whatsappNumber: { type: String, trim: true, maxlength: 30, validate: phoneValidator },
  googleReviewUrl: { type: String, trim: true, maxlength: 500, validate: urlValidator },
  socialLinks: {
    instagram: { type: String, trim: true, maxlength: 500, validate: urlValidator },
    facebook: { type: String, trim: true, maxlength: 500, validate: urlValidator },
  },
  settings: {
    timezone: { type: String, trim: true, maxlength: 80, default: 'UTC' },
    manualStatus: { type: String, enum: ['auto', 'open', 'closed'], default: 'auto' },
    operatingHours: {
      days: { type: [Number], default: [1, 2, 3, 4, 5, 6, 0] },
      openTime: { type: String, default: '09:00', match: /^([01]\d|2[0-3]):[0-5]\d$/ },
      closeTime: { type: String, default: '21:00', match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    },
  },
}, { timestamps: true })

export default mongoose.model('Business', businessSchema)
