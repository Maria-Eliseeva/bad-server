import crypto from 'crypto'
import { NextFunction, Request, Response } from 'express'

const CSRF_COOKIE = 'csrfToken'
const CSRF_HEADER = 'x-csrf-token'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const cookieOptions = {
    httpOnly: false,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
}

export const csrfProtection = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    let token = req.cookies?.[CSRF_COOKIE] as string | undefined

    if (!token) {
        token = crypto.randomBytes(32).toString('hex')
        res.cookie(CSRF_COOKIE, token, cookieOptions)
    }

    if (SAFE_METHODS.has(req.method)) {
        return next()
    }

    const supplied = req.get(CSRF_HEADER)
    if (!supplied || supplied.length !== token.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) {
        return res.status(403).json({ message: 'Недействительный CSRF-токен' })
    }

    return next()
}
