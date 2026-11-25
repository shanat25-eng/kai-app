// מקור אמת יחיד לאפשרויות טופס המטופל (קבוצת גיל / תחום טיפול).
// רשימה ממוקדת לקלינאיות ילדים ונוער + "אחר" לפחות נפוצים, עם תמיכה בבחירה מרובה.

export const AGE_RANGE_OPTIONS = [
  'גיל הרך (0-3)',
  'גיל הגן (3-6)',
  'גיל בית ספר (6-12)',
  'התבגרות (12-18)',
  'בגרות (18+)',
]

export const OTHER_TREATMENT_AREA = 'אחר'

export const TREATMENT_AREA_OPTIONS = [
  'היגוי',
  'שפה',
  'תקשורת חברתית / אוטיזם (ASD)',
  'שטף דיבור (גמגום)',
  'דחיקת לשון ותפקודי פה',
  'שפה כתובה וקריאה',
  'תקשורת תומכת וחלופית (AAC)',
  'שמיעה ושיקום שמיעה',
  'אכילה והאכלה',
  OTHER_TREATMENT_AREA,
]

const PRESET_AREAS = new Set(TREATMENT_AREA_OPTIONS.filter((o) => o !== OTHER_TREATMENT_AREA))

// ממיר מחרוזת שמורה ב-DB (למשל "היגוי, שפה, קול") למערך בחירות + טקסט "אחר"
export function parseTreatmentAreas(str) {
  const parts = (str ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const selected = []
  const custom = []
  for (const p of parts) {
    if (PRESET_AREAS.has(p)) {
      if (!selected.includes(p)) selected.push(p)
    } else if (p !== OTHER_TREATMENT_AREA) {
      custom.push(p)
    }
  }
  if (custom.length > 0) {
    selected.push(OTHER_TREATMENT_AREA)
  }
  return { selected, otherText: custom.join(', ') }
}

// ממיר מערך בחירות + טקסט "אחר" למחרוזת אחת לשמירה ב-DB
export function formatTreatmentAreas(selected, otherText) {
  const items = selected.filter((s) => s !== OTHER_TREATMENT_AREA)
  if (selected.includes(OTHER_TREATMENT_AREA)) {
    const trimmed = (otherText ?? '').trim()
    if (trimmed) items.push(trimmed)
  }
  return items.join(', ')
}
