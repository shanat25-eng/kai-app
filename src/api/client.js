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
  const url = `${BASE_URL}${path}`
  const authHeaders = await getAuthHeaders()
  let response
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
    })
  } catch (networkErr) {
    console.error(`kai: network error → ${url}`, networkErr)
    throw new Error(`שגיאת רשת (${networkErr.message}) — השרת לא זמין. בדקי חיבור אינטרנט.`)
  }

  if (!response.ok) {
    let body = ''
    try { body = await response.text() } catch {}
    console.error(`kai: API ${response.status} → ${url}`, body)
    throw new Error(`שגיאת שרת ${response.status} (${url}): ${body || response.statusText}`)
  }

  return response.json()
}

export async function apiUpload(path, formData) {
  const url = `${BASE_URL}${path}`
  const authHeaders = await getAuthHeaders()
  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    })
  } catch (networkErr) {
    console.error(`kai: network error → ${url}`, networkErr)
    throw new Error(`שגיאת רשת (${networkErr.message}) — השרת לא זמין.`)
  }

  if (!response.ok) {
    let body = ''
    try { body = await response.text() } catch {}
    console.error(`kai: API ${response.status} → ${url}`, body)
    throw new Error(`שגיאת שרת ${response.status}: ${body || response.statusText}`)
  }

  return response.json()
}
