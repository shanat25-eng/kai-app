// שכבת תקשורת עתידית מול ה-Backend האמיתי (כלל ברזל #3: Architecture Ready).
// כרגע אין שום Backend מחובר, ואין Mock Data קשיח בתוך רכיבי ה-UI —
// כשיהיה שרת אמיתי, כל קריאה תעבור דרך apiRequest() ותקבל תשובה אמיתית,
// בלי לשנות אף קומפוננטה שצורכת את הנתונים.
//
// שימוש ב-fetch סטנדרטי בלבד (HTTP/HTTPS) — תואם לדרישת NetFree Compatibility.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

// שלב 6 (הקלטה): להעלאת קבצים (multipart/form-data — כמו אודיו ל-/api/transcribe).
// לא ניתן להשתמש ב-apiRequest הרגיל: הוא קובע תמיד Content-Type: application/json,
// בעוד ש-FormData חייב שהדפדפן עצמו יקבע Content-Type עם ה-boundary הנכון.
export async function apiUpload(path, formData) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`)
  }

  return response.json()
}
