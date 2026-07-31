declare module 'sanitize-html' {
    type SanitizeOptions = {
        allowedTags?: string[]
        allowedAttributes?: Record<string, string[]>
    }

    const sanitizeHtml: (dirty: string, options?: SanitizeOptions) => string
    export default sanitizeHtml
}
