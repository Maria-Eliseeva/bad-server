import { Request, Express } from 'express'
import multer, { FileFilterCallback } from 'multer'
import { mkdirSync } from 'fs'
import { basename, join } from 'path'

type DestinationCallback = (error: Error | null, destination: string) => void
type FileNameCallback = (error: Error | null, filename: string) => void

const storage = multer.diskStorage({
    destination: (
        _req: Request,
        _file: Express.Multer.File,
        cb: DestinationCallback
    ) => {
        const destinationPath = join(
            __dirname,
            process.env.UPLOAD_PATH_TEMP
                ? `../public/${process.env.UPLOAD_PATH_TEMP}`
                : '../public'
        )

        mkdirSync(destinationPath, { recursive: true })
        cb(null, destinationPath)
    },

    filename: (
        _req: Request,
        file: Express.Multer.File,
        cb: FileNameCallback
    ) => {
        const safeName = basename(file.originalname).replace(
            /[^a-zA-Z0-9._-]/g,
            '_'
        )
        cb(null, safeName)
    },
})

const types = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
) => {
    if (!types.includes(file.mimetype)) {
        return cb(null, false)
    }

    return cb(null, true)
}

export default multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
        fields: 10,
        fieldSize: 64 * 1024,
    },
})
