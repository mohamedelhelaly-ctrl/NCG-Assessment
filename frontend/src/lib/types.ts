// Types mirror the backend schemas (backend/app/schemas).
export type Role = 'customer' | 'admin'

export interface User {
  id: number
  email: string
  full_name: string
  role: Role
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}
