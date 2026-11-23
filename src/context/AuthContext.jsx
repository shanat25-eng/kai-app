import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../api/supabaseClient'

const IDLE_TIMEOUT_MS = (Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES) || 15) * 60 * 1000
const IDLE_WARNING_MS = Math.min(60 * 1000, IDLE_TIMEOUT_MS / 4)
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel']

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = בודק session, null = לא מחובר, object = מחובר
  const [session, setSession] = useState(undefined)
  const [error, setError] = useState(null)
  const [idleSecondsLeft, setIdleSecondsLeft] = useState(null)
  const lastActivityRef = useRef(Date.now())

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const isAuthenticated = !!session
  const isLoading = session === undefined

  const clinician = session
    ? {
        id: session.user.id,
        fullName: session.user.user_metadata?.full_name ?? session.user.email,
        role: 'קלינאית תקשורת',
      }
    : null

  async function login(email, password) {
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('אימייל או סיסמה שגויים')
      return false
    }
    lastActivityRef.current = Date.now()
    return true
  }

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setIdleSecondsLeft(null)
  }, [])

  const stayActive = useCallback(() => {
    lastActivityRef.current = Date.now()
    setIdleSecondsLeft(null)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return undefined
    lastActivityRef.current = Date.now()

    function onActivity() {
      lastActivityRef.current = Date.now()
    }
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }))

    const interval = setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current
      if (idleFor >= IDLE_TIMEOUT_MS) {
        logout()
        setError('נותקת אוטומטית אחרי 15 דקות ללא פעילות. יש להתחבר מחדש.')
      } else if (idleFor >= IDLE_TIMEOUT_MS - IDLE_WARNING_MS) {
        setIdleSecondsLeft(Math.ceil((IDLE_TIMEOUT_MS - idleFor) / 1000))
      } else {
        setIdleSecondsLeft(null)
      }
    }, 1000)

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity))
      clearInterval(interval)
    }
  }, [isAuthenticated, logout])

  if (isLoading) return null

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, clinician, login, logout, error, idleSecondsLeft, stayActive }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
