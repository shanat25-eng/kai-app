import { Router } from 'express'

const router = Router()

// POST /api/generate
// ⚠️ שלב 1 בלבד: מחזיר תמיד mock מסומן (_mock: true), בלי שום קריאה
// אמיתית ל-AI. שלב 3 יחליף רק את גוף הפונקציה הזו בקריאה אמיתית
// ל-OpenAI — חוזה הבקשה ({ sourceText }) וחוזה התשובה (6 השדות למטה)
// לא ישתנו, כדי ש-src/api/documentGeneration.js (שלב 5) יוכל להתחבר
// בלי לשנות אף קומפוננטה שצורכת אותו.
//
// שדה validationResult מוחזר כבר עכשיו (כ-null) כדי שהחוזה המלא יהיה
// קבוע מהיום הראשון — שלב 4 ימלא אותו בפועל, בלי לשנות את הצורה.
router.post('/', (req, res) => {
  const { sourceText } = req.body ?? {}

  if (typeof sourceText !== 'string' || !sourceText.trim()) {
    return res.status(400).json({ error: 'sourceText is required' })
  }

  res.json({
    _mock: true, // ⚠️ תוצאה מדומה — לא AI אמיתי. יוסר בשלב 3.
    shortSummary: '[MOCK] סיכום קצר לדוגמה',
    whatHappened: '[MOCK] מה שעלה במפגש, לפי הטקסט שסופק',
    actions: '[MOCK] פעולות והתערבויות לדוגמה',
    patientResponse: '[MOCK] תגובת המטופל לדוגמה',
    futureGoals: '[MOCK] מטרות להמשך לדוגמה',
    shortForCopy: '[MOCK] נוסח קצר להעתקה',
    // ימולא בפועל בשלב 4 (Validation) — כרגע תמיד null בכוונה.
    validationResult: null,
  })
})

export default router
