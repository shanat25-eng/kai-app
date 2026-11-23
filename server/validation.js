// שלב 4 — שכבת Validation בסיסית (PRD §10.2, §5.3).
//
// רצה *לפני* הקריאה ל-AI, על ה-transcript הגולמי — לא סומכת על שהמודל
// "יזכור" בעצמו לציין שחסר מידע (זה בדיוק הפער שנמצא בסבב הבדיקות
// הקודם: transcript קצר וברור לא סומן עקבי כ"חסר מידע" ע"י ה-prompt
// בלבד). זו בדיקת כללים פשוטה, לא קריאת AI נוספת.
//
// עקרון מרכזי: **לא חוסמת** — רק מסמנת אזהרה ברורה. ה-route עדיין
// ממשיך ליצור clinicalNote גם כש-passed הוא false; ההחלטה אם להסתמך
// על התוצאה נשארת אצל הקלינאית (§5.5, אישור אנושי), לא אצל הקוד.

const MIN_LENGTH = 40 // תווים
const MIN_WORDS = 8

// מילות מפתח בסיסיות שמעידות שהטקסט בכלל מתאר מפגש טיפולי/קליני.
// רשימה היוריסטית ולא ממצה בכוונה — מטרתה לתפוס את המקרה הברור של
// "זה בכלל לא תיאור מפגש" (למשל שיחת חולין), לא לשפוט איכות קלינית.
const CLINICAL_KEYWORDS = [
  'מטופל', 'מטופלת', 'מפגש', 'טיפול', 'תרגיל', 'תרגול',
  'דיבור', 'היגוי', 'שפה', 'תקשורת', 'קלינאית', 'קלינאי',
  'אבחון', 'מטרה', 'מטרות', 'התקדמות', 'הורה', 'הורים', 'ילד', 'ילדה',
]

/**
 * @param {string} transcript
 * @returns {{ passed: boolean, warnings: string[] }}
 */
export function validateTranscript(transcript) {
  const warnings = []
  const text = (transcript ?? '').trim()

  // בדיקה 1: ריק. ב-route הקורא (routes/generateClinicalNote.js) טקסט
  // ריק כבר נחסם קודם (400) — הבדיקה כאן נשארת כהגנה עצמאית של
  // הפונקציה עצמה, למקרה שתיקרא בעתיד ממקום אחר שלא בדק את זה בעצמו.
  if (!text) {
    warnings.push('הטקסט ריק — אין תוכן לנתח.')
    return { passed: false, warnings }
  }

  // בדיקה 2: קצר מדי
  const wordCount = text.split(/\s+/).filter(Boolean).length
  if (text.length < MIN_LENGTH || wordCount < MIN_WORDS) {
    warnings.push(
      `הטקסט קצר במיוחד (${wordCount} מילים) — ייתכן שאין מספיק מידע ליצירת סיכום קליני מלא ומהימן.`,
    )
  }

  // בדיקה 3: אין סימנים בסיסיים לתוכן טיפולי/קליני
  const hasClinicalMarker = CLINICAL_KEYWORDS.some((word) => text.includes(word))
  if (!hasClinicalMarker) {
    warnings.push(
      'לא זוהו מילות מפתח שמעידות על תיאור מפגש טיפולי (למשל "מטופל", "תרגול", "מטרות") — ייתכן שהטקסט אינו תיאור מפגש כלל.',
    )
  }

  // בדיקה 4: החלטה מצטברת — passed=false אם נמצאה אזהרה כלשהי
  return {
    passed: warnings.length === 0,
    warnings,
  }
}
