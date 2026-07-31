import { Types } from 'mongoose'
import sanitizeHtml from 'sanitize-html';

export const toSafeString = (value: unknown): string => {
    if (value === undefined || value === null) {
        return ''
    }

    return String(value)
}

export const sanitizeComment = (value: string) =>
    sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {},
    })

export const sanitizeSearchValue = (
    value: unknown,
    maxLength = 100
): string => toSafeString(value).trim().slice(0, maxLength);

export const sanitizeObjectId = (
    value: unknown,
    fieldName = 'id'
): Types.ObjectId => {
    const safeValue = sanitizeSearchValue(value)

    if (!Types.ObjectId.isValid(safeValue)) {
        throw new Error(`Invalid ${fieldName}`)
    }

    return new Types.ObjectId(safeValue)
}

export const sanitizeUpdatePayload = (
    payload: Record<string, unknown>,
    allowedFields: string[],
    options: { allowObjects?: string[] } = {}
): Record<string, any> => {
    const sanitized: Record<string, any> = {}

    Object.entries(payload).forEach(([key, value]) => {
        if (!allowedFields.includes(key)) {
            return
        }

        if (value === undefined || value === null) {
            return
        }

        if (typeof value === 'string') {
            sanitized[key] = toSafeString(value)
            return
        }

        if (
            typeof value === 'number' ||
            typeof value === 'boolean' ||
            value instanceof Date
        ) {
            sanitized[key] = value
            return
        }

        if (typeof value === 'object') {
            if (options.allowObjects?.includes(key)) {
                sanitized[key] = value
            }
            return
        }

        sanitized[key] = toSafeString(value)
    })

    return sanitized
}

export const sanitizeLimit = (value: unknown, max = 10) => {
    const limit = Number(value)

    if (!Number.isFinite(limit) || limit < 1) {
        return 1
    }

    return Math.min(Math.floor(limit), max)
}