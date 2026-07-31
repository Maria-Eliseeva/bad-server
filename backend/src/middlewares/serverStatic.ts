import { NextFunction, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

export default function serveStatic(baseDir: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        const safeBaseDir = path.resolve(baseDir)

        try {
            const requestedPath = decodeURIComponent(req.path)
            const filePath = path.resolve(safeBaseDir, `.${requestedPath}`)

            if (
                filePath !== safeBaseDir &&
                !filePath.startsWith(safeBaseDir + path.sep)
            ) {
                return next()
            }

            fs.access(filePath, fs.constants.F_OK, (err) => {
                if (err) {
                    return next()
                }

                return res.sendFile(filePath, (sendErr) => {
                    if (sendErr) {
                        next(sendErr)
                    }
                })
            })
        } catch (error) {
            return next(error)
        }
    }
}
