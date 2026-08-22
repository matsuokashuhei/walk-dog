export type ApiErrorBody = {
  code: string
  message: string
  requestId: string
  retryable: boolean
}

export class ApiError extends Error {
  readonly code: string
  readonly requestId: string
  readonly retryable: boolean
  readonly status: number

  constructor(body: ApiErrorBody, status: number) {
    super(body.message)
    this.name = 'ApiError'
    this.code = body.code
    this.requestId = body.requestId
    this.retryable = body.retryable
    this.status = status
  }
}

let authenticationFailureHandler: (() => void) | null = null

export function setAuthenticationFailureHandler(handler: (() => void) | null): void {
  authenticationFailureHandler = handler
}

function notifyAuthenticationFailure(error: ApiError, accessToken: string | undefined): void {
  if (accessToken && error.status === 401 && error.code === 'UNAUTHENTICATED') {
    authenticationFailureHandler?.()
  }
}

function apiBaseUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required')
  }
  return baseUrl.replace(/\/$/, '')
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.code === 'string' &&
    typeof record.message === 'string' &&
    typeof record.requestId === 'string' &&
    typeof record.retryable === 'boolean'
  )
}

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  accessToken?: string
  headers?: Record<string, string>
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  if (response.status === 204) {
    return undefined as T
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiError(
      {
        code: 'UNEXPECTED_RESPONSE',
        message: 'Response body was not valid JSON',
        requestId: crypto.randomUUID(),
        retryable: true,
      },
      response.status,
    )
  }

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      const error = new ApiError(payload, response.status)
      notifyAuthenticationFailure(error, options.accessToken)
      throw error
    }
    const error = new ApiError(
      {
        code: 'UNEXPECTED_RESPONSE',
        message: 'Unexpected error response from API',
        requestId: crypto.randomUUID(),
        retryable: true,
      },
      response.status,
    )
    notifyAuthenticationFailure(error, options.accessToken)
    throw error
  }

  return payload as T
}
