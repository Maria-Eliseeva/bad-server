import { errors } from 'celebrate'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { json, urlencoded } from 'express'
import mongoose from 'mongoose'
import path from 'path'
import { DB_ADDRESS } from './config'
import errorHandler from './middlewares/error-handler'
import { csrfProtection } from './middlewares/csrf'
import { apiRateLimiter } from './middlewares/rate-limit'
import serveStatic from './middlewares/serverStatic'
import routes from './routes'

const { PORT = 3000 } = process.env
const { ORIGIN_ALLOW = 'http://localhost:5173' } = process.env
const allowedOrigins = ORIGIN_ALLOW.split(',').map((s) => s.trim())
const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use(cookieParser())

const corsOptions = {
    origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
    ) => {
        if (!origin) {
            callback(null, true)
            return
        }

        if (allowedOrigins.includes(origin)) {
            callback(null, true)
            return
        }

        callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

app.use(
    serveStatic(path.join(__dirname, 'public'))
)

app.use(urlencoded({ extended: false, limit: '256kb', parameterLimit: 100 }))
app.use(json({ limit: '256kb' }))

app.use(csrfProtection)
app.use(apiRateLimiter)

app.use(routes)
app.use(errors())
app.use(errorHandler)

const bootstrap = async () => {
    try {
        await mongoose.connect(DB_ADDRESS)
        await app.listen(PORT, () => console.log(`Server started on ${PORT}`))
    } catch (error) {
        console.error(error)
        process.exit(1)
    }
}

bootstrap()
