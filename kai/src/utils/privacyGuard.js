// שכבת הגנה נוספת על כלל הברזל "Strict Anonymization".
// entities.js/patients.js כבר דואגים שלא *יהיה* שדה לשם/ת.ז/טלפון —
// אבל שום דבר לא מונע מקלינאית להקליד בטעות "052-1234567" בתוך
// displayCode או notes (שני השדות היחידים שהם טקסט חופשי בטופס).
// הפונקציה כאן היא היוריסטיקה בסיסית בצד הלקוח — לא ולידציה משפטית
// מוחלטת — שמטרתה לתפוס את הטעויות הנפוצות ביותר ולתת פידבק מיידי,
// לפני שהמידע בכלל נשמר ב-localStorage.

const PHONE_PATTERN = /(?:\+?972[-\s]?|0)([1-9])[-\s]?\d{2,3}[-\s]?\d{4,7}\b/
const ISRAELI_ID_PATTERN = /\b\d{9}\b/
const LONG_DIGIT_RUN_PATTERN = /\d{7,}/

/**
 * @param {string} value
 * @returns {{ flagged: boolean, reason: string|null }}
 */
export function checkForIdentifyingInfo(value) {
  if (!value) return { flagged: false, reason: null }

  if (PHONE_PATTERN.test(value)) {
    return { flagged: true, reason: 'הטקסט נראה כמו מספר טלפון' }
  }
  if (ISRAELI_ID_PATTERN.test(value) || LONG_DIGIT_RUN_PATTERN.test(value)) {
    return { flagged: true, reason: 'הטקסט מכיל רצף ספרות ארוך שעלול להיות ת.ז או מזהה אישי' }
  }
  return { flagged: false, reason: null }
}
