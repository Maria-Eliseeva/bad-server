import { Types } from 'mongoose'

export const toSafeString = (value: unknown): string => {
    if (value === undefined || value === null) {
        return ''
    }

    return String(value)
}

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
