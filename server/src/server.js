import 'dotenv/config'
import app from './app.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { Reward } from './models/index.js'

const port = Number(process.env.PORT) || 5000

const server = await connectDatabase()
  .then(() => Reward.syncIndexes())
  .then(() => app.listen(port, () => {
    console.log(`LoyaltyOS API listening on port ${port}`)
  }))
  .catch((error) => {
    console.error(`MongoDB connection failed: ${error.message}`)
    process.exitCode = 1
  })

async function shutdown(signal) {
  console.log(`${signal} received; shutting down gracefully`)
  if (server) {
    await new Promise((resolve) => server.close(resolve))
  }
  await disconnectDatabase()
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
