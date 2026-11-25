const SUGGESTION_COUNT = 3
const MAX_TEXT_LENGTH = 4000

const SYSTEM_PROMPT =
  'את/ה עוזר/ת ניסוח לקלינאית תקשורת. תקבל/י סעיף אחד ממסמך קליני, ותציע/י בדיוק 3 ניסוחים חלופיים שלו, בסגנון של קלינאית תקשורת מנוסה, בעברית מקצועית ותקנית. ' +
  'זהו ניסוח מחדש בלבד: כל ניסוח חייב להכיל את אותו מידע בדיוק כמו המקור — אסור להוסיף עובדה, אבחנה, מסקנה, פרשנות או פרט שלא מופיע בטקסט, ואסור להשמיט מידע. ' +
  'אסור להפוך תצפית לאבחנה. אם בטקסט יש סימון כמו "[לבדיקה: ...]" — השאר/י אותו כמו שהוא בכל ניסוח. ' +
  'אל תכלול/י שמות, מספרי זהות, טלפונים או כתובות — כתוב/י "המטופל/ת" במקום. ' +
  'שלושת הניסוחים צריכים להיות שונים זה מזה בניסוח, לא רק במילה אחת. ' +
  'החזר/י אך ורק JSON בצורה: {"suggestions": ["...", "...", "..."]}.'

function parseSuggestions(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.suggestions)) return null
    const clean = parsed.suggestions
      .filter((s) => typeof s === 'string')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, SUGGESTION_COUNT)
    return clean.length > 0 ? clean : null
  } catch {
    return null
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const { text, label } = body ?? {}
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' })
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: `text is too long (max ${MAX_TEXT_LENGTH} characters)` })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' })
  }

  const sectionLine = typeof label === 'string' && label.trim() ? `שם הסעיף: ${label.trim()}\n\n` : ''

  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `${sectionLine}הטקסט לניסוח מחדש:\n\n${text.trim()}` },
        ],
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => '')
      console.error('kai-api: OpenAI rephrase error', aiRes.status, errText.slice(0, 300))
      return res.status(502).json({ error: 'Rephrase failed', detail: `OpenAI HTTP ${aiRes.status}` })
    }

    const data = await aiRes.json()
    const raw = data?.choices?.[0]?.message?.content?.trim()
    const suggestions = parseSuggestions(raw)
    if (!suggestions) {
      return res.status(502).json({ error: 'Invalid response from AI' })
    }
    return res.status(200).json({ suggestions })
  } catch (err) {
    console.error('kai-api: section rephrase failed', err)
    return res.status(502).json({ error: 'Rephrase failed', detail: err.message })
  }
}
