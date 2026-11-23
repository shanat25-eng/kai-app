import { Router } from 'express'
import { getOpenAIClient } from '../lib/openaiClient.js'

const router = Router()

const SUGGESTION_COUNT = 3
const MAX_TEXT_LENGTH = 4000

// POST /api/rephrase-section
// מקבל { text, label? } — טקסט של סעיף אחד מהמסמך (במצב עריכה), ומחזיר
// { suggestions: string[] } — 3 ניסוחים חלופיים לאותו תוכן בדיוק.
//
// בדיקת המזהים (privacyGuard) רצה ב-frontend *לפני* השליחה — לכאן אמור
// להגיע רק טקסט שעבר אותה. כמו generate-clinical-note: אין fallback ל-mock;
// אם אין מפתח או שהקריאה נכשלת — מחזירים שגיאה אמיתית.
router.post('/', async (req, res) => {
  const { text, label } = req.body ?? {}

  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'text is required' })
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: `text is too long (max ${MAX_TEXT_LENGTH} characters)` })
  }

  const openai = getOpenAIClient()
  if (!openai) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' })
  }

  const sectionLine = typeof label === 'string' && label.trim() ? `שם הסעיף: ${label.trim()}\n\n` : ''

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      // קצת יותר גבוה מיצירת הסיכום — כדי שהניסוחים יהיו שונים זה מזה.
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'את/ה עוזר/ת ניסוח לקלינאית תקשורת. תקבל/י סעיף אחד ממסמך קליני, ותציע/י בדיוק 3 ניסוחים חלופיים שלו, בסגנון של קלינאית תקשורת מנוסה, בעברית מקצועית ותקנית. ' +
            'זהו ניסוח מחדש בלבד: כל ניסוח חייב להכיל את אותו מידע בדיוק כמו המקור — אסור להוסיף עובדה, אבחנה, מסקנה, פרשנות או פרט שלא מופיע בטקסט, ואסור להשמיט מידע. ' +
            'אסור להפוך תצפית לאבחנה. אם בטקסט יש סימון כמו "[לבדיקה: ...]" — השאר/י אותו כמו שהוא בכל ניסוח. ' +
            'אל תכלול/י שמות, מספרי זהות, טלפונים או כתובות — כתוב/י "המטופל/ת" במקום. ' +
            'שלושת הניסוחים צריכים להיות שונים זה מזה בניסוח, לא רק במילה אחת. ' +
            'החזר/י אך ורק JSON בצורה: {"suggestions": ["...", "...", "..."]}.',
        },
        {
          role: 'user',
          content: `${sectionLine}הטקסט לניסוח מחדש:\n\n${text.trim()}`,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim()
    const suggestions = parseSuggestions(raw)

    if (!suggestions) {
      return res.status(502).json({ error: 'Invalid response from AI' })
    }

    res.json({ suggestions })
  } catch (err) {
    console.error('kai-server: section rephrase failed', err)
    res.status(502).json({ error: 'Rephrase failed', detail: err.message })
  }
})

export function parseSuggestions(raw) {
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

export default router
