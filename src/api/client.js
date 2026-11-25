// שכבת תקשורת מול ה-Backend — מצרפת אוטומטית את ה-Access Token של המשתמשת המחוברת
// כדי שרק קלינאית מחוברת תוכל להפעיל את שירותי ה-AI.
import { supabase } from './supabaseClient'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiRequest(path, options = {}) {
  const authHeaders = await getAuthHeaders()
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

export async function apiUpload(path, formData) {
  const authHeaders = await getAuthHeaders()
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: authHeaders,
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`)
  }

  return response.json()
}
