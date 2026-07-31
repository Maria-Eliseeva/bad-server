import { Router } from 'express'
import {
    getCurrentUser,
    getCurrentUserRoles,
    login,
    logout,
    refreshAccessToken,
    register,
    updateCurrentUser,
} from '../controllers/auth'
import auth from '../middlewares/auth'
import { authRateLimiter } from '../middlewares/rate-limit'
import {
    validateAuthentication,
    validateUserBody,
} from '../middlewares/validations'

const authRouter = Router()

authRouter.get('/csrf', (_req, res) => {
    res.status(200).json({ success: true })
})

authRouter.get('/user', auth, getCurrentUser)
authRouter.patch('/me', auth, updateCurrentUser)
authRouter.get('/user/roles', auth, getCurrentUserRoles)
authRouter.post('/login', authRateLimiter, validateAuthentication, login)
authRouter.post('/token', refreshAccessToken)
authRouter.post('/logout', logout)
authRouter.post('/register', authRateLimiter, validateUserBody, register)

export default authRouter
