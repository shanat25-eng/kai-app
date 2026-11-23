// עיצוב תאריך אחיד לכל האפליקציה — כדי שמסך אחד לא יציג dd/mm/yyyy
// ומסך אחר yyyy-mm-dd. כל רכיב שמציג תאריך למשתמשת מייבא מכאן.

/**
 * @param {string|null|undefined} isoDate
 * @returns {string}
 */
export function formatDate(isoDate) {
  if (!isoDate) return '—'
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
