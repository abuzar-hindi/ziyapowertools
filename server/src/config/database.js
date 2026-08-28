import mongoose from 'mongoose'

let connectionPromise

export async function connectDatabase(uri = process.env.MONGODB_URI, options = {}) {
  if (!uri) {
    const error = new Error('MONGODB_URI is required to connect to MongoDB')
    error.code = 'MONGODB_URI_MISSING'
    throw error
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      ...options,
    }).then(() => mongoose.connection).catch((error) => {
      connectionPromise = undefined
      throw error
    })
  }

  return connectionPromise
}

export async function disconnectDatabase() {
  connectionPromise = undefined

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
}

export default { connectDatabase, disconnectDatabase }
