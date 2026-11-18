// One API client for the whole app: base URL from the environment, one error type.
const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string>

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'network_error', 'Could not reach the server')
  }
  if (!response.ok) {
    let payload: { error?: { code?: string; message?: string; fields?: Record<string, string> } } = {}
    try {
      payload = await response.json()
    } catch {
      // non-JSON error body
    }
    throw new ApiError(
      response.status,
      payload.error?.code ?? 'http_error',
      payload.error?.message ?? response.statusText,
      payload.error?.fields,
    )
  }
  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
}
