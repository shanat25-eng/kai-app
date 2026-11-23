// שכבת עזר גנרית לעבודה עם LocalStorage, בפורמט שתואם למבנה ה-DB האמיתי
// שיבוא בעתיד (טבלה = מערך אובייקטים, לפי id).
//
// כל api/*.js ספציפי (patients.js, sessions.js, documents.js, auditLog.js)
// בנוי מעל הפונקציות האלה, ולא נוגע ב-localStorage ישירות.
// כשיהיה Backend אמיתי, רק הקבצים האלה יוחלפו בקריאות fetch דרך api/client.js —
// שאר האפליקציה (המסכים) לא תדע את ההבדל.

const STORAGE_PREFIX = 'kai:'

function readCollection(key) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    return raw ? JSON.parse(raw) : []
  } catch (err) {
    console.error(`kai storage: failed to read "${key}"`, err)
    return []
  }
}

function writeCollection(key, items) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(items))
  } catch (err) {
    console.error(`kai storage: failed to write "${key}"`, err)
  }
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const storage = {
  readCollection,
  writeCollection,
  generateId,
}
