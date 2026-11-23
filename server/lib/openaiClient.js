import OpenAI from 'openai'

// לקוח OpenAI יחיד, משותף לכל route שצריך AI אמיתי (Whisper משלב 2,
// Generation משלב 3). אם אין מפתח מוגדר — מחזיר null במקום לזרוק
// שגיאה, כדי שכל route יוכל להחליט בעצמו ליפול בחזרה ל-mock ולא
// להפיל את השרת כולו.
let client = null

export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}
