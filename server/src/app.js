import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import authRouter from './routes/auth.js'
import healthRouter from './routes/health.js'
import settingsRouter from './routes/settings.js'
import customersRouter from './routes/customers.js'
import qrRouter from './routes/qr.js'
import stampsRouter from './routes/stamps.js'
import rewardsRouter from './routes/rewards.js'
import dashboardRouter from './routes/dashboard.js'
import stampRequestsRouter from './routes/stampRequests.js'
import customerRegistrationsRouter from './routes/customerRegistrations.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()

const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'

app.use(helmet())
app.use(cors({
	origin: (origin, callback) => callback(null, !origin || origin === allowedOrigin),
	credentials: true,
}))
app.use(express.json({ limit: '10kb' }))
app.use(cookieParser())
app.use('/api/health', healthRouter)
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }))
app.use('/api/auth', authRouter)
app.use('/api/customers', customersRouter)
app.use('/api/qr', qrRouter)
app.use('/api/stamps', stampsRouter)
app.use('/api/stamp-requests', stampRequestsRouter)
app.use('/api/customer-registrations', customerRegistrationsRouter)
app.use('/api/rewards', rewardsRouter)

app.use('/api/dashboard', dashboardRouter)
app.use('/api', settingsRouter)
app.use(errorHandler)

export default app
