import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { auth as authApi, setStoredToken, clearStoredToken, getStoredToken } from '../api/client'
import type { AuthUser } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName?: string, inviteToken?: string) => Promise<{ message: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount, restore session from stored token
  useEffect(() => {
    const token = getStoredToken()
    if (!token) {
      setIsLoading(false)
      return
    }
    authApi.me()
      .then(setUser)
      .catch(() => clearStoredToken())
      .finally(() => setIsLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const data = await authApi.login({ email, password })
    setStoredToken(data.access_token)
    setUser(data.user)
  }

  async function register(email: string, password: string, displayName?: string, inviteToken?: string) {
    const data = await authApi.register({ email, password, display_name: displayName, invite_token: inviteToken })
    return data
  }

  function logout() {
    clearStoredToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
