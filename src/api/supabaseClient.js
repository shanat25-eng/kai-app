import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  document.body.innerHTML = `
    <div style="font-family:sans-serif;direction:rtl;padding:40px;max-width:500px;margin:60px auto;border:2px solid #e53e3e;border-radius:12px;background:#fff5f5">
      <h2 style="color:#c53030;margin:0 0 12px">שגיאת הגדרות — k.ai</h2>
      <p style="color:#742a2a;margin:0 0 8px">משתני הסביבה חסרים:</p>
      <ul style="color:#742a2a;margin:0 0 16px;padding-right:20px">
        ${!supabaseUrl ? '<li><code>VITE_SUPABASE_URL</code></li>' : ''}
        ${!supabaseAnonKey ? '<li><code>VITE_SUPABASE_ANON_KEY</code></li>' : ''}
      </ul>
      <p style="color:#742a2a;margin:0;font-size:.9rem">
        הוסיפי את המשתנים ב-Vercel:<br>
        Settings → Environment Variables → Redeploy
      </p>
    </div>`
  throw new Error('Missing Supabase env vars — see page for instructions')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
