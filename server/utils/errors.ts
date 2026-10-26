import type { ZodError } from 'zod'

export interface AppErrorData {
  code: string
  message: string
  details?: Record<string, string>
}

export function createAppError(statusCode: number, data: AppErrorData) {
  return createError({
    statusCode,
    message: data.message,
    data,
  })
}

export function flattenZodErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (!fields[key]) {
      fields[key] = issue.message
    }
  }
  return fields
}
