import sanitizeHtml from 'sanitize-html'

export const sanitizeComment = (value: string) =>
    sanitizeHtml(value, {
        allowedTags: [],
        allowedAttributes: {},
    })
