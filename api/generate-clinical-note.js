import { requireAuthenticatedUser } from './_auth.js'
import { validateTranscript } from '../server/validation.js'

const SECTION_KEYS = [
  'shortSummary',
  'whatHappened',
  'actions',
  'patientResponse',
  'futureGoals',
  'shortForCopy',
]

const SECTION_LABELS = {
  shortSummary: 'סיכום קצר',
  whatHappened: 'מה עלה במפגש',
  actions: 'פעולות והתערבויות שבוצעו',
  patientResponse: 'תגובת המטופל',
  futureGoals: 'מטרות להמשך',
  shortForCopy: 'נוסח קצר להעתקה',
}

const SYSTEM_PROMPT =
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
  'אם הטקסט מחולק לכותרות, התוכן של כל חלק שייך רק לסעיף שלו — אבל אל תעתיק/י אותו כמו שהוא: נסח/י אותו מחדש בשפה של קלינאית תקשורת מקצועית, בגוף שלישי (למשל "ראיתי שהוא..." → "נצפה כי המטופל...", "עשיתי איתו..." → "בוצע תרגול של..."), והחלף/י ביטויים יומיומיים או רגשיים במונחים תיאוריים מקצועיים — בלי להוסיף עובדות ובלי לשנות את המשמעות. חלק ריק = \'לא צוין בתיאור המפגש\'. shortSummary ו-shortForCopy נכתבים מכל החלקים יחד.'

function parseSections(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.whatHappened !== 'string') return null
    const out = {}
    for (const key of SECTION_KEYS) {
      out[key] = typeof parsed[key] === 'string' ? parsed[key].trim() : ''
    }
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

  const authUser = await requireAuthenticatedUser(req, res)
  if (!authUser) return

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const { transcript } = body ?? {}
  if (typeof transcript !== 'string' || !transcript.trim()) {
    return res.status(400).json({ error: 'transcript is required' })
  }

  const validation = validateTranscript(transcript)
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' })
  }

  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `זהו תמלול של קלינאית שמתארת מפגש טיפולי. נסח ממנו סיכום קליני מסודר:\n\n${transcript}`,
          },
        ],
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => '')
      console.error('kai-api: OpenAI clinical note error', aiRes.status, errText.slice(0, 300))
      return res.status(502).json({ error: 'Generation failed', detail: `OpenAI HTTP ${aiRes.status}` })
    }

    const data = await aiRes.json()
    const raw = data?.choices?.[0]?.message?.content?.trim()
    if (!raw) {
      return res.status(502).json({ error: 'Empty response from AI' })
    }

    const sections = parseSections(raw)
    const clinicalNote = sections ? formatSectionsAsNote(sections) : raw
    return res.status(200).json({ clinicalNote, sections, validation })
  } catch (err) {
    console.error('kai-api: clinical note generation failed', err)
    return res.status(502).json({ error: 'Generation failed', detail: err.message })
  }
}
