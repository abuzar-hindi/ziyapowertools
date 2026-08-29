import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config({ override: process.env.NODE_ENV !== 'test' })

let connectionPromise

function checkIsTestEnvironment() {
  return (
    process.env.NODE_ENV === 'test' ||
    process.execArgv.includes('--test') ||
    process.argv.includes('--test') ||
    process.argv.some((arg) => typeof arg === 'string' && (arg.endsWith('.test.js') || arg.includes('\\test\\') || arg.includes('/test/')))
  )
}

export function getTargetDatabaseName(targetUri) {
  const isTest = checkIsTestEnvironment()
  if (isTest) return 'digital_loyalty_test'

  const uri = targetUri || process.env.MONGODB_URI
  if (uri) {
    const match = uri.match(/\/([^/?]+)(\?|$)/)
    const extractedDb = match ? match[1] : ''
    if (extractedDb && extractedDb !== 'test') {
      return extractedDb
    }
  }

  return 'digital_loyalty_dev'
}

export function resolveDatabaseUri(uriOverride) {
  if (uriOverride !== undefined) return uriOverride
  const isTestEnvironment = checkIsTestEnvironment()
  if (isTestEnvironment && process.env.MONGODB_TEST_URI) {
    return process.env.MONGODB_TEST_URI
  }
  return process.env.MONGODB_URI
}

export function validateDatabaseSafety(uri, targetDbName) {
  const isTestEnvironment = checkIsTestEnvironment()
  if (isTestEnvironment) {
    const isTestDb = targetDbName.endsWith('_test') || targetDbName === 'digital_loyalty_test'
    if (!isTestDb) {
      const error = new Error(
        `FATAL SAFETY VIOLATION: Automated tests attempted to connect to non-test database "${targetDbName}". Target database must end with '_test' or equal 'digital_loyalty_test'. Aborting operation to protect development data.`
      )
      error.code = 'UNSAFE_TEST_DATABASE'
      throw error
    }
  } else {
    if (targetDbName === 'test') {
      const error = new Error(
        `FATAL SAFETY VIOLATION: Development environment attempted to connect to default "test" database. Development must use "digital_loyalty_dev".`
      )
      error.code = 'UNSAFE_DEV_DATABASE'
      throw error
    }
  }
}

function getSafeHostFromUri(uri) {
  try {
    const match = uri.match(/@([^/?]+)/)
    return match ? match[1] : 'localhost'
  } catch {
    return 'unknown-host'
  }
}

export async function connectDatabase(targetUri, options = {}) {
  const rawUri = resolveDatabaseUri(targetUri)
  if (!rawUri) {
    const error = new Error('MONGODB_URI or MONGODB_TEST_URI is required to connect to MongoDB')
    error.code = 'MONGODB_URI_MISSING'
    throw error
  }

  const targetDbName = options.dbName || getTargetDatabaseName(rawUri)
  validateDatabaseSafety(rawUri, targetDbName)

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection
  }

  const isTest = checkIsTestEnvironment()
  const modeLabel = isTest ? 'TEST' : (process.env.NODE_ENV || 'development').toUpperCase()
  const safeHost = getSafeHostFromUri(rawUri)

  console.log(`[Database Connection] Mode: ${modeLabel} | Target DB: "${targetDbName}" | Host: ${safeHost}`)

  connectionPromise = mongoose.connect(rawUri, {
    dbName: targetDbName,
    serverSelectionTimeoutMS: 5000,
    ...options,
  }).then(() => mongoose.connection).catch((error) => {
    connectionPromise = undefined
    throw error
  })

  return connectionPromise
}

export async function disconnectDatabase() {
  connectionPromise = undefined

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
}

export async function clearTestDatabase() {
  if (mongoose.connection.readyState !== 1) return
  const isTest = checkIsTestEnvironment()
  if (!isTest || !mongoose.connection.name.endsWith('_test')) return

  const models = Object.values(mongoose.connection.models)
  if (models.length > 0) {
    await Promise.all(models.map((model) => model.deleteMany({})))
  }
  if (mongoose.connection.db) {
    const rawCols = await mongoose.connection.db.collections()
    await Promise.all(rawCols.map((col) => col.deleteMany({})))
  }
}

export default { connectDatabase, disconnectDatabase, resolveDatabaseUri, validateDatabaseSafety, getTargetDatabaseName, clearTestDatabase }
