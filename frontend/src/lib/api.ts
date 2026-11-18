// One API client for the whole app: base URL from the environment, token and language
// injected, one error type, and a global 401 handler.
const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string>
  params: Record<string, unknown>

  constructor(
    status: number,
    code: string,
    message: string,
    fields: Record<string, string> = {},
    params: Record<string, unknown> = {},
  ) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
    this.params = params
  }
}

let tokenProvider: () => string | null = () => null
let languageProvider: () => string = () => 'en'
let unauthorizedHandler: () => void = () => {}

export function configureApi(options: {
  getToken?: () => string | null
  getLanguage?: () => string
  onUnauthorized?: () => void
}) {
  if (options.getToken) tokenProvider = options.getToken
  if (options.getLanguage) languageProvider = options.getLanguage
  if (options.onUnauthorized) unauthorizedHandler = options.onUnauthorized
}

interface ErrorPayload {
  error?: {
    code?: string
    message?: string
    fields?: Record<string, string>
    params?: Record<string, unknown>
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Accept-Language': languageProvider() }
  const token = tokenProvider()
  if (token) headers.Authorization = `Bearer ${token}`
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      // For FormData the browser sets the multipart boundary itself.
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'network_error', 'Could not reach the server')
  }

  if (!response.ok) {
    let payload: ErrorPayload = {}
    try {
      payload = await response.json()
    } catch {
      // non-JSON error body
    }
    const error = new ApiError(
      response.status,
      payload.error?.code ?? 'http_error',
      payload.error?.message ?? response.statusText,
      payload.error?.fields,
      payload.error?.params,
    )
    // A rejected login is also a 401, but it is not an expired session.
    if (response.status === 401 && token) unauthorizedHandler()
    throw error
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** Build a query string, skipping empty values. */
export function query(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue
    search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
}
