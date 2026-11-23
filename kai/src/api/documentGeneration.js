// ⚠️ שלב 5: הסטאב הוחלף בקריאה אמיתית ל-Backend (שלב 7 — server/routes/generateClinicalNote.js).
//
// חוזה ההחזרה (TreatmentSummary עם 6 השדות) נשמר במכוון — אף רכיב React
// לא השתנה בגלל זה (כלל ברזל #3, Architecture Ready). תוספת יחידה:
// שדה validation (שלב 4), שלא היה קיים בסטאב.
//
// למה עדיין 6 שדות, כשה-Backend מחזיר clinicalNote אחד בלבד?
// ה-AI האמיתי (שלב 7) עדיין לא מפריד את הפלט ל-6 סעיפים נפרדים —
// הוא מייצר ניסוח קליני מאוחד אחד. כדי לא לשנות את עיצוב/מבנה המסך
// (לא התבקש בשלב 5), clinicalNote ממופה ל-whatHappened (השדה הטבעי
// לתוכן חופשי, כמו שהיה גם בסטאב), וארבעת השדות שה-AI עוד לא מפריד
// נשארים עם תווית ברורה — לא בגלל "AI חלש", אלא כי זו עדיין לא יכולת
// שקיימת היום. פיצול אמיתי ל-6 סעיפים הוא שינוי לצד ה-AI/prompt,
// לא לצד הקובץ הזה — לא בוצע כאן כי לא התבקש.
//
// למה קריאת רשת דרך api/client.js ולא fetch ישיר?
//   • כלל ברזל #4 (NetFree) — כל תקשורת עם ה-AI עוברת רק דרך דומיין
//     ה-Backend של k.ai עצמו (proxy של Vite בפיתוח מקומי).

import { apiRequest } from './client.js'

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} passed
 * @property {string[]} warnings   // מ-server/validation.js (שלב 4)
 */

/**
 * @typedef {Object} TreatmentSummary
 * @property {string} shortSummary      // סיכום קצר של המפגש
 * @property {string} whatHappened      // מה עלה במפגש — כאן יושב clinicalNote המלא מה-AI
 * @property {string} actions           // פעולות/התערבויות שבוצעו
 * @property {string} patientResponse   // תגובת המטופל
 * @property {string} futureGoals       // מטרות להמשך
 * @property {string} shortForCopy      // נוסח קצר להעתקה (למשל להדבקה לתיק המטופל בכרטיס)
 * @property {ValidationResult|null} validation   // שלב 4 — מה-Backend, לא היה קיים בסטאב
 */

// תווית לשדות שה-AI היום עוד לא מייצר בנפרד (ראי הסבר למעלה) — לא
// "AI חלש", פשוט עדיין לא קיימת הפרדה כזו ב-endpoint הנוכחי.
const NOT_SEPARATED_YET = '[עדיין לא מופרד בנפרד — התוכן המלא נמצא תחת "מה עלה במפגש"]'

/**
 * מקבלת את הטקסט החופשי שהקלינאית כתבה על המפגש, שולחת אותו ל-AI
 * האמיתי (POST /api/generate-clinical-note), ומחזירה אותו מסודר לתוך
 * 6 סעיפי הסיכום הסטנדרטיים + תוצאת Validation.
 *
 * הפונקציה עדיין async ועדיין מחזירה את אותו חוזה בדיוק כמו הסטאב —
 * שום מסך שכבר עושה `await generateTreatmentSummary(...)` לא השתנה.
 *
 * @param {string} sourceText
 * @returns {Promise<TreatmentSummary>}
 */
export async function generateTreatmentSummary(sourceText) {
  const trimmed = (sourceText ?? '').trim()

  if (!trimmed) {
    // אם המשתמשת לחצה על "צור טיוטה" בלי להזין טקסט (למשל לאחר איפוס)
    // אנחנו לא זורקים שגיאה ולא פונים לרשת — המסך אמור למנוע את זה,
    // אבל מחזירים אובייקט תקין כדי שגם כשל UX לא ישבור את התצוגה.
    return {
      shortSummary: NOT_SEPARATED_YET,
      whatHappened: NOT_SEPARATED_YET,
      actions: NOT_SEPARATED_YET,
      patientResponse: NOT_SEPARATED_YET,
      futureGoals: NOT_SEPARATED_YET,
      shortForCopy: NOT_SEPARATED_YET,
      validation: null,
    }
  }

  // הקריאה האמיתית. אם השרת מחזיר שגיאה (400/502/503) — apiRequest זורק,
  // ו-CreateSessionSummaryScreen.jsx כבר תופס את זה (handleGenerate) ומציג
  // הודעת שגיאה ידידותית — לא נדרש שינוי שם.
  const { clinicalNote, validation } = await apiRequest('/generate-clinical-note', {
    method: 'POST',
    body: JSON.stringify({ transcript: trimmed }),
  })

  return {
    shortSummary: NOT_SEPARATED_YET,
    whatHappened: clinicalNote,
    actions: NOT_SEPARATED_YET,
    patientResponse: NOT_SEPARATED_YET,
    futureGoals: NOT_SEPARATED_YET,
    shortForCopy:
      clinicalNote.length > 200 ? `${clinicalNote.slice(0, 200)}…` : clinicalNote,
    validation: validation ?? null,
  }
}

/**
 * ממירה TreatmentSummary לטקסט מעוצב עם כותרות סעיפים.
 * זה מה שנשמר ב-Document.generatedText (שהוא שדה string ב-entities.js) —
 * כדי שכשמישהו יפתח את המסמך מההיסטוריה בשלבים הבאים, יראה אותו מסודר
 * גם בלי להעביר עוד אובייקט מובנה בין שכבות.
 *
 * @param {TreatmentSummary} summary
 * @returns {string}
 */
export function formatSummaryAsText(summary) {
  return [
    'סיכום קצר',
    '---------',
    summary.shortSummary,
    '',
    'מה עלה במפגש',
    '-------------',
    summary.whatHappened,
    '',
    'פעולות והתערבויות שבוצעו',
    '------------------------',
    summary.actions,
    '',
    'תגובת המטופל',
    '-------------',
    summary.patientResponse,
    '',
    'מטרות להמשך',
    '-------------',
    summary.futureGoals,
    '',
    'נוסח קצר להעתקה',
    '-----------------',
    summary.shortForCopy,
  ].join('\n')
}
