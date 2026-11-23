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
      // שלב 6: מבקשים JSON עם 6 סעיפים נפרדים, כדי שהקלינאית תוכל לערוך כל סעיף בנפרד.
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'את/ה עוזר/ת תיעוד קליני לקלינאית תקשורת. כתוב/י בסגנון של קלינאית תקשורת מנוסה, בעברית מקצועית ותקנית. ' +
            'תפקידך הוא רק לנסח מחדש את מה שהקלינאית אמרה על המפגש הטיפולי — בלי להוסיף שום עובדה, אבחנה, שם או פרט שלא נאמר במפורש בטקסט המקור. ' +
            'אסור להפוך תצפית לאבחנה: אם תוארה התנהגות או תגובה, נסח/י אותה כתצפית בשפה מקצועית ותיאורית, בלי לפרש אותה כלקות, הפרעה או ממצא אבחוני. ' +
            'אם חסר מידע, ציין/י זאת במפורש כמידע חסר — אל תמלא/י אותו מדעתך, אל תמציא/י, ואל תסיק/י מסקנות שאינן נתמכות ישירות בטקסט. ' +
            'נקה/י חזרות, היסוסים ומילות מילוי, וטעויות תמלול ברורות — בלי לשנות את התוכן. ' +
            'אם יש סתירה בתיאור, אל תכריע/י ביניהן: כתוב/י את מה שנאמר וסמן/י "[לבדיקה: סתירה בתיאור]". ' +
            'אל תכלול/י שמות, מספרי זהות, טלפונים או כתובות, גם אם הופיעו במקור — כתוב/י "המטופל/ת" במקום. ' +
            'החזר/י אך ורק JSON עם המפתחות הבאים, כל ערך מחרוזת בעברית: ' +
            'whatHappened — תצפיות בלבד: מה נצפה במפגש. ' +
            'actions — רק מה שהמטפלת עשתה: פעולות והתערבויות. ' +
            'patientResponse — תגובת המטופל בלבד. ' +
            'futureGoals — מטרות להמשך בלבד. ' +
            'shortSummary — תמצית המפגש, 1-2 משפטים. ' +
            'shortForCopy — נוסח תמציתי של 2-3 שורות להדבקה בתיק. ' +
            'כל פרט נכנס רק לסעיף שמתאים להגדרה שלו, בלי לשכפל בין סעיפים. אם אין מידע לסעיף, כתוב/י "לא צוין בתיאור המפגש". ' +
            'אם הטקסט מחולק לכותרות, התוכן של כל חלק שייך רק לסעיף שלו — אבל אל תעתיק/י אותו כמו שהוא: נסח/י אותו מחדש בשפה של קלינאית תקשורת מקצועית, בגוף שלישי (למשל "ראיתי שהוא..." → "נצפה כי המטופל...", "עשיתי איתו..." → "בוצע תרגול של..."), והחלף/י ביטויים יומיומיים או רגשיים במונחים תיאוריים מקצועיים — בלי להוסיף עובדות ובלי לשנות את המשמעות. חלק ריק = \'לא צוין בתיאור המפגש\'. shortSummary ו-shortForCopy נכתבים מכל החלקים יחד.',
        },
        {
          role: 'user',
          content: `זהו תמלול של קלינאית שמתארת מפגש טיפולי. נסח ממנו סיכום קליני מסודר:\n\n${transcript}`,
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim()

    if (!raw) {
      return res.status(502).json({ error: 'Empty response from AI' })
    }

    // clinicalNote נשאר בתשובה (תאימות לאחור). sections — חדש בשלב 6.
    const sections = parseSections(raw)
    const clinicalNote = sections ? formatSectionsAsNote(sections) : raw

    res.json({ clinicalNote, sections, validation })
  } catch (err) {
    console.error('kai-server: clinical note generation failed', err)
    res.status(502).json({ error: 'Generation failed', detail: err.message })
  }
})

const SECTION_KEYS = ['shortSummary', 'whatHappened', 'actions', 'patientResponse', 'futureGoals', 'shortForCopy']
const SECTION_LABELS = {
  shortSummary: 'סיכום קצר',
  whatHappened: 'מה עלה במפגש',
  actions: 'פעולות והתערבויות שבוצעו',
  patientResponse: 'תגובת המטופל',
  futureGoals: 'מטרות להמשך',
  shortForCopy: 'נוסח קצר להעתקה',
}

// אם המודל לא החזיר JSON תקין — מחזירים null, וה-frontend נופל להתנהגות הישנה.
export function parseSections(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.whatHappened !== 'string') return null
    const out = {}
    for (const key of SECTION_KEYS) out[key] = typeof parsed[key] === 'string' ? parsed[key].trim() : ''
    return out
  } catch {
    return null
  }
}

function formatSectionsAsNote(sections) {
  return SECTION_KEYS.filter((k) => k !== 'shortForCopy' && sections[k])
    .map((k) => `${SECTION_LABELS[k]}:\n${sections[k]}`)
    .join('\n\n')
}

export default router
