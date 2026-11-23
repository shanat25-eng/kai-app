import { Router } from 'express'
import { getOpenAIClient } from '../lib/openaiClient.js'
import { validateTranscript } from '../validation.js'

const router = Router()

// POST /api/generate-clinical-note
// מקבל { transcript } (טקסט חופשי — לרוב הפלט של /api/transcribe),
// ומחזיר { clinicalNote, validation } — ניסוח קליני מסודר בעברית +
// תוצאת בדיקת validation.js (שלב 4) על ה-transcript המקורי.
//
// מכוון בלי fallback ל-mock: אם אין מפתח, או שהקריאה ל-AI נכשלת, ה-endpoint
// מחזיר שגיאה אמיתית — לא תוצאה מדומה שנראית כמו הצלחה. זה שונה בכוונה
// מ-/api/transcribe (שלב 2), לפי הדרישה המפורשת "לא לדמות תשובה" לשלב הזה.
//
// מופרד לגמרי משלב התמלול: מקבל טקסט בלבד, לא אודיו, ולא נוגע ב-
// routes/transcribe.js או routes/generate.js (ה-mock של שלב 1) בכלל.
router.post('/', async (req, res) => {
  const { transcript } = req.body ?? {}

  if (typeof transcript !== 'string' || !transcript.trim()) {
    return res.status(400).json({ error: 'transcript is required' })
  }

  // שלב 4: Validation *לפני* הקריאה ל-AI — בדיקת כללים, לא קריאת AI
  // נוספת. לא חוסמת: גם אם passed=false, ממשיכים ליצור clinicalNote —
  // רק מצרפים אזהרה ברורה לתשובה, שהקלינאית תראה ותחליט בעצמה.
  const validation = validateTranscript(transcript)

  const openai = getOpenAIClient()
  if (!openai) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' })
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'את/ה עוזר/ת תיעוד קליני לקלינאית תקשורת. תפקידך לנסח מחדש, בעברית תקנית ומקצועית, את מה שהקלינאית תיארה על מפגש טיפולי — בלי להוסיף שום עובדה, אבחנה, שם, או פרט שלא נאמר במפורש בטקסט המקור. אם חסר מידע, ציין זאת במפורש כמידע חסר — אל תמלא אותו מדעתך, אל תמציא, ואל תסיק מסקנות שאינן נתמכות ישירות בטקסט.',
        },
        {
          role: 'user',
          content: `זהו תמלול של קלינאית שמתארת מפגש טיפולי. נסח ממנו סיכום קליני מסודר:\n\n${transcript}`,
        },
      ],
    })

    const clinicalNote = completion.choices[0]?.message?.content?.trim()

    if (!clinicalNote) {
      return res.status(502).json({ error: 'Empty response from AI' })
    }

    res.json({ clinicalNote, validation })
  } catch (err) {
    console.error('kai-server: clinical note generation failed', err)
    res.status(502).json({ error: 'Generation failed', detail: err.message })
  }
})

export default router
