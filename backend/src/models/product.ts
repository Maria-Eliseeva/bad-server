import { unlink } from 'fs'
import mongoose, { Document } from 'mongoose'
import { relative, resolve, sep } from 'path'

export interface IFile {
    fileName: string
    originalName: string
}

export interface IProduct extends Document {
    title: string
    image: IFile
    category: string
    description: string
    price: number
}

const cardsSchema = new mongoose.Schema<IProduct>(
    {
        title: {
            type: String,
            unique: true,
            required: [true, 'Поле "title" должно быть заполнено'],
            minlength: [2, 'Минимальная длина поля "title" - 2'],
            maxlength: [30, 'Максимальная длина поля "title" - 30'],
        },
        image: {
            fileName: {
                type: String,
                required: [true, 'Поле "image.fileName" должно быть заполнено'],
            },
            originalName: String,
        },
        category: {
            type: String,
            required: [true, 'Поле "category" должно быть заполнено'],
        },
        description: {
            type: String,
        },
        price: {
            type: Number,
            default: null,
        },
    },
    { versionKey: false }
)

cardsSchema.index({ title: 'text' })

const getSafePublicImagePath = (fileName: string) => {
    const publicRoot = resolve(__dirname, '../public')
    const normalizedName = String(fileName).replace(/^[/\\]+/, '')
    const target = resolve(publicRoot, normalizedName)
    const rel = relative(publicRoot, target)

    if (rel.startsWith('..') || rel.startsWith('/') || rel.includes(`..${sep}`)) {
        throw new Error('Недопустимый путь изображения')
    }

    return target
}

// Можно лучше: удалять старое изображением перед обновлением сущности
cardsSchema.pre('findOneAndUpdate', async function deleteOldImage() {
    // @ts-ignore
    const updateImage = this.getUpdate().$set?.image
    const docToUpdate = await this.model.findOne(this.getQuery())
    if (updateImage && docToUpdate) {
        unlink(getSafePublicImagePath(docToUpdate.image.fileName), (err) => {
            if (err) console.error(err)
        })
    }
})

// Можно лучше: удалять файл с изображением после удаление сущности
cardsSchema.post('findOneAndDelete', async (doc: IProduct) => {
    unlink(getSafePublicImagePath(doc.image.fileName), (err) => {
        if (err) console.error(err)
    })
})

export default mongoose.model<IProduct>('product', cardsSchema)
