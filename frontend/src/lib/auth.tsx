import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, configureApi } from './api'
import { AuthContext } from './authContext'
import type { AuthContextValue } from './authContext'
import type { TokenResponse, User } from './types'

const TOKEN_KEY = 'auth:token'

// localStorage can throw (private windows, blocked storage); the app must still work without it.
function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

// The token also lives in memory so requests do not depend on storage being available.
let memoryToken: string | null = null
configureApi({ getToken: () => memoryToken })


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  // Read the stored token once, when the provider mounts.
  const [loading, setLoading] = useState<boolean>(() => {
    memoryToken = readToken()
    return memoryToken !== null
  })

  const clearSession = useCallback(() => {
    memoryToken = null
    writeToken(null)
    setUser(null)
  }, [])

  const startSession = useCallback((response: TokenResponse) => {
    memoryToken = response.access_token
    writeToken(response.access_token)
    setUser(response.user)
    return response.user
  }, [])

  // Global 401 handler: an expired or revoked token ends the session.
  useEffect(() => {
    configureApi({ onUnauthorized: clearSession })
  }, [clearSession])

  useEffect(() => {
    if (memoryToken === null) return
    let cancelled = false
    api
      .get<User>('/api/v1/auth/me')
      .then((u) => !cancelled && setUser(u))
      .catch(() => {
        // 401 is handled globally; a network error leaves the user signed out for now.
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (email, password) =>
        startSession(await api.post<TokenResponse>('/api/v1/auth/login', { email, password })),
      register: async (full_name, email, password) =>
        startSession(
          await api.post<TokenResponse>('/api/v1/auth/register', { full_name, email, password }),
        ),
      logout: clearSession,
    }),
    [user, loading, startSession, clearSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
