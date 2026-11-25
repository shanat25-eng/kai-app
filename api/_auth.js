// אימות משתמשת מחוברת מול Supabase Auth + הגבלת קצב פשוטה להגנה על מפתח OpenAI.
const WINDOW_MS = 10 * 60 * 1000 // 10 דקות
const MAX_REQUESTS_PER_WINDOW = 40
const buckets = new Map()

function checkRateLimit(userId) {
  const now = Date.now()
  const entry = buckets.get(userId)
  if (!entry || now > entry.resetAt) {
    buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false
  }
  entry.count += 1
  return true
}

export async function requireAuthenticatedUser(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY on server')
    res.status(503).json({ error: 'הגדרות האימות בשרת חסרות' })
    return null
  }

  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const match = typeof header === 'string' ? header.match(/^Bearer\s+(.+)$/i) : null
  const token = match?.[1]?.trim()

  if (!token) {
    res.status(401).json({ error: 'נדרשת התחברות למערכת כדי להשתמש בשירותי ה-AI' })
    return null
  }

  try {
    const resp = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    })

    if (!resp.ok) {
      res.status(401).json({ error: 'החיבור פג תוקף — יש להתחבר מחדש למערכת' })
      return null
    }

    const user = await resp.json()
    if (!user?.id) {
      res.status(401).json({ error: 'משתמשת לא מזוהה' })
      return null
    }

    if (!checkRateLimit(user.id)) {
      res.status(429).json({ error: 'בוצעו יותר מדי בקשות בזמן קצר. המתיני כמה דקות ונסי שוב.' })
      return null
    }

    return user
  } catch (err) {
    console.error('Supabase auth verification error:', err)
    res.status(502).json({ error: 'שגיאה באימות המשתמשת' })
    return null
  }
}
