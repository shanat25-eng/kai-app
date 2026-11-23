import { Router } from 'express'
import multer from 'multer'
import { toFile } from 'openai'
import { getOpenAIClient } from '../lib/openaiClient.js'

// אחסון בזיכרון בלבד (לא כותב את הקובץ לדיסק) — עקבי עם עקרון
// Data Minimization בסעיף 17 ב-PRD.
const upload = multer({ storage: multer.memoryStorage() })
const router = Router()

const MOCK_TRANSCRIPT = '[MOCK] זהו תמלול לדוגמה — לא תוצאה אמיתית של תמלול'

// POST /api/transcribe — multipart/form-data, שדה בשם "file"
//
// שלב 2: אם יש OPENAI_API_KEY — תמלול אמיתי דרך Whisper. אם אין —
// נופל בחזרה ל-mock מסומן, בדיוק כמו שלב 1, ולא קורס. חוזה הבקשה
// והתשובה ({ transcript }) זהים בשני המקרים — ה-frontend (שלב 5)
// לא ידע את ההבדל.
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'file is required (multipart/form-data, field name "file")' })
  }

  const openai = getOpenAIClient()

  if (!openai) {
    return res.json({ _mock: true, transcript: MOCK_TRANSCRIPT })
  }

  try {
    const file = await toFile(req.file.buffer, req.file.originalname || 'audio.webm', {
      type: req.file.mimetype || undefined,
    })

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      // מרמז לתמלול שהשפה עברית — PRD סעיף 9: "תמלול חייב לתמוך
      // בעברית באיכות סבירה".
      language: 'he',
      // משפט דוגמה בעברית עם פיסוק מלא — Whisper מחקה את הסגנון של ה-prompt,
      // ובלעדיו נוטה להחזיר עברית בלי נקודות ופסיקים. ניטרלי בכוונה, בלי
      // מונחים מקצועיים: Whisper מוטה לכיוון מילים שמופיעות ב-prompt.
      prompt: 'היום, אחרי הצהריים, ישבנו יחד ודיברנו על כמה דברים.',
    })

    res.json({ _mock: false, transcript: transcription.text })
  } catch (err) {
    console.error('kai-server: Whisper transcription failed', err)
    res.status(502).json({ error: 'Transcription failed', detail: err.message })
  }
})

export default router
