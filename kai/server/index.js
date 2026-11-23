import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import healthRouter from './routes/health.js'
import generateRouter from './routes/generate.js'
import transcribeRouter from './routes/transcribe.js'
import generateClinicalNoteRouter from './routes/generateClinicalNote.js'

// ⚠️ שלב 1 בלבד (שלד): /api/generate ו-/api/transcribe מחזירים כרגע
// תמיד mock מסומן (_mock: true) — ראי הערות בקבצי ה-routes עצמם.
// שלב 2 (transcribe) ושלב 3 (generate) יחליפו רק את הפנים של כל
// route בקריאה אמיתית ל-OpenAI — חוזה הבקשה/תשובה כאן לא ישתנה,
// כדי ש-frontend (שלב 5) לא יצטרך לדעת את ההבדל.

const app = express()
const PORT = process.env.PORT || 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

// CORS מוגבל למקור אחד ידוע (ה-Vite dev server), לא wildcard פתוח —
// עקבי עם עקרון "התאמה לאינטרנט מסונן" ב-PRD (סעיף 16): התקשורת
// כולה נשארת בין ה-frontend של K.ai לבין ה-Backend של K.ai בלבד.
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json())

app.use('/api/health', healthRouter)
app.use('/api/generate', generateRouter)
app.use('/api/transcribe', transcribeRouter)
app.use('/api/generate-clinical-note', generateClinicalNoteRouter)

app.listen(PORT, () => {
  console.log(`k.ai backend (שלב 1 — שלד) מאזין על http://localhost:${PORT}`)
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  אין OPENAI_API_KEY מוגדר — כל ה-endpoints יחזירו mock בלבד.')
  }
})
