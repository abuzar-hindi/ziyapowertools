import mongoose from 'mongoose'
import { Customer, CustomerRegistration } from '../models/index.js'

export async function listPendingRegistrations(request, response, next) {
  try {
    const businessId = new mongoose.Types.ObjectId(request.admin.businessId)
    const registrations = await CustomerRegistration.find({
      businessId,
      status: 'pending',
    }).sort({ requestedAt: 1 }).limit(100).lean()

    return response.json({
      data: {
        registrations: registrations.map((item) => ({
          id: item._id.toString(),
          name: item.name,
          phone: item.displayPhone,
          requestedAt: item.requestedAt,
          status: item.status,
        })),
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function reviewRegistration(request, response, next) {
  const { registrationId } = request.params
  if (!mongoose.isValidObjectId(registrationId)) {
    return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Registration request not found' } })
  }

  const action = request.body?.action
  if (!['approve', 'reject'].includes(action)) {
    return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Action must be approve or reject' } })
  }

  try {
    const businessId = new mongoose.Types.ObjectId(request.admin.businessId)
    const registration = await CustomerRegistration.findOne({
      _id: registrationId,
      businessId,
      status: 'pending',
    })

    if (!registration) {
      return response.status(409).json({ error: { code: 'REQUEST_ALREADY_REVIEWED', message: 'This registration request has already been reviewed' } })
    }

    registration.status = action === 'approve' ? 'approved' : 'rejected'
    registration.reviewedAt = new Date()
    registration.reviewedBy = request.admin.id
    await registration.save()

    let customer = null
    if (action === 'approve') {
      customer = await Customer.findOneAndUpdate(
        { businessId: registration.businessId, normalizedPhone: registration.normalizedPhone },
        {
          $setOnInsert: {
            businessId: registration.businessId,
            name: registration.name,
            normalizedPhone: registration.normalizedPhone,
            displayPhone: registration.displayPhone,
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      ).lean()
    }

    return response.json({
      data: {
        registration: {
          id: registration._id.toString(),
          name: registration.name,
          phone: registration.displayPhone,
          status: registration.status,
          reviewedAt: registration.reviewedAt,
        },
        customer: customer ? { id: customer._id.toString(), name: customer.name, phone: customer.displayPhone } : null,
      },
    })
  } catch (error) {
    return next(error)
  }
}
