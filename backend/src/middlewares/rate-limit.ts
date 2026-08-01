import { NextFunction, Request, Response } from 'express'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

const createRateLimiter = (windowMs: number, max: number) => (
    req: Request,
    res: Response,
    next: NextFunction
) => {
        const now = Date.now()
        const key = req.ip || req.socket.remoteAddress || 'unknown'
        const current = buckets.get(key)

        if (!current || current.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + windowMs })
            return next()
        }

        current.count += 1

        if (current.count > max) {
            const retryAfter = Math.ceil((current.resetAt - now) / 1000)
            res.setHeader('Retry-After', retryAfter)
            return res.status(429).json({
                message: 'Слишком много запросов. Повторите позже.',
            })
        }

        return next()
    }

setInterval(() => {
    const now = Date.now()
    Array.from(buckets.entries()).forEach(([key, bucket]) => {
        if (bucket.resetAt <= now) buckets.delete(key)
    })
}, 60_000).unref()

export const apiRateLimiter = createRateLimiter(60_000, 120)
export const authRateLimiter = createRateLimiter(15 * 60_000, 20)
