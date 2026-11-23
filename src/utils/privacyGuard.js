// שכבת הגנה נוספת על כלל הברזל "Strict Anonymization".
// entities.js/patients.js כבר דואגים שלא *יהיה* שדה לשם/ת.ז/טלפון —
// אבל שום דבר לא מונע מקלינאית להקליד בטעות "052-1234567" בתוך
// displayCode או notes (שני השדות היחידים שהם טקסט חופשי בטופס).
// הפונקציה כאן היא היוריסטיקה בסיסית בצד הלקוח — לא ולידציה משפטית
// מוחלטת — שמטרתה לתפוס את הטעויות הנפוצות ביותר ולתת פידבק מיידי,
// לפני שהמידע בכלל נשמר ב-localStorage.
//
// שלב 6: נוספו אימייל וזיהוי שם פרטי+משפחה (findIdentifyingInfo).
// שתי רמות חומרה:
//   • 'block' — ת.ז / טלפון / אימייל / רצף ספרות ארוך. ודאות גבוהה → חוסם שמירה.
//   • 'warn'  — דפוס של שם פרטי+משפחה. היוריסטיקה (למשל "דוד" = גם קרוב משפחה),
//               לכן רק מזהיר, והקלינאית יכולה לאשר "זה לא שם" ולהמשיך.

const PHONE_PATTERN = /(?:\+?972[-\s]?|0)([1-9])[-\s]?\d{2,3}[-\s]?\d{4,7}\b/
// טלפון ישראלי נפוץ: 05X-XXXXXXX / 0X-XXXXXXX / +972, עם או בלי מקפים/רווחים
const IL_PHONE_PATTERN = /(?:\+972[-\s]?|\b0)(?:5\d|7\d|[23489])[-\s]?\d{3}[-\s]?\d{4}\b/
const ISRAELI_ID_PATTERN = /\b\d{9}\b/
const ID_WITH_CHECK_DIGIT_PATTERN = /\b\d{8}-\d\b/
const LONG_DIGIT_RUN_PATTERN = /\d{7,}/
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/

// שמות פרטיים נפוצים (כולל נפוצים בציבור החרדי). לא רשימה ממצה —
// מטרתה לתפוס את המקרה הנפוץ: "משה כהן", "רבקה לוי", "יוסי בן דוד".
const COMMON_FIRST_NAMES = [
  // בנים
  'אברהם', 'יצחק', 'יעקב', 'משה', 'אהרן', 'אהרון', 'יוסף', 'יוסי', 'דוד', 'שלמה',
  'שמואל', 'שמוליק', 'מנחם', 'מענדי', 'מרדכי', 'מוטי', 'חיים', 'אליהו', 'אלי',
  'ישראל', 'נחום', 'נחמן', 'אליעזר', 'אלעזר', 'בנימין', 'בני', 'יהודה', 'לוי',
  'שמעון', 'ראובן', 'נפתלי', 'אשר', 'זבולון', 'יששכר', 'גד', 'דן', 'מאיר', 'צבי',
  'הרשי', 'הערשי', 'שלום', 'פנחס', 'עזרא', 'נתן', 'יונתן', 'יהושע', 'שמחה',
  'ברוך', 'בנציון', 'מיכאל', 'גבריאל', 'רפאל', 'עמרם', 'יחזקאל', 'ישעיהו',
  'ירמיהו', 'דניאל', 'אריה', 'זאב', 'דב', 'בער', 'יואל', 'שאול', 'עקיבא',
  'אפרים', 'מנשה', 'יחיאל', 'אלחנן', 'אליקים', 'הלל', 'שרגא', 'פייבל', 'זלמן',
  'מתתיהו', 'נועם', 'איתי', 'עומר', 'אורי', 'יואב', 'רועי', 'אביתר',
  // בנות
  'שרה', 'רבקה', 'רחל', 'לאה', 'חנה', 'מרים', 'אסתר', 'חיה', 'דבורה', 'יהודית',
  'רות', 'נחמה', 'מלכה', 'פייגי', 'פיגא', 'בלומה', 'בלומי', 'גיטי', 'גיטל',
  'צירל', 'שושנה', 'שושי', 'אביגיל', 'תמר', 'נעמי', 'אילה', 'שירה', 'שולמית',
  'שולי', 'רייזי', 'חוי', 'חני', 'פערל', 'פנינה', 'טובה', 'טובי', 'ברכה', 'בתיה',
  'בתיה', 'הדסה', 'זהבה', 'יוכבד', 'מיכל', 'נועה', 'אפרת', 'הודיה', 'אורית',
  'מרגלית', 'פרידה', 'ריקי', 'דינה', 'אודליה', 'יעל', 'נגה', 'שפרה', 'צפורה',
  'ציפורה', 'ציפי', 'אלישבע', 'רינה', 'חדוה', 'מינדי', 'סימה', 'עדינה',
]

// מילים שבאות הרבה אחרי שם פרטי ואינן שם משפחה (כדי לצמצם התרעות שווא:
// "משה הגיע", "חנה אמרה", "דוד שלו").
const NOT_A_SURNAME = new Set([
  'הגיע', 'הגיעה', 'אמר', 'אמרה', 'שלו', 'שלה', 'שלי', 'שלך', 'היה', 'היתה', 'הייתה',
  'ענה', 'ענתה', 'ביצע', 'ביצעה', 'שיתף', 'שיתפה', 'הצליח', 'הצליחה', 'עבד', 'עבדה',
  'תרגל', 'תרגלה', 'הראה', 'הראתה', 'ציין', 'ציינה', 'סיפר', 'סיפרה', 'גם', 'לא',
  'כן', 'עם', 'של', 'את', 'על', 'אל', 'מאוד', 'קצת', 'יותר', 'פחות', 'עוד', 'כבר',
  'המלך', 'רבנו', 'אבינו', 'אמנו', 'הנביא', 'הכהן', 'ו', 'או',
])

const HEBREW_WORD = /[\u05D0-\u05EA][\u05D0-\u05EA'"׳״-]*/g

function stripPrefix(word) {
  // אותיות שימוש נפוצות: ו/ה/ל/ב/כ/ש/מ — "ומשה" → "משה"
  return word.replace(/^[והלבכשמ]/, '')
}

function findNamePatterns(value) {
  const words = value.match(HEBREW_WORD) ?? []
  const hits = []
  for (let i = 0; i < words.length - 1; i += 1) {
    const raw = words[i]
    const candidate = COMMON_FIRST_NAMES.includes(raw)
      ? raw
      : COMMON_FIRST_NAMES.includes(stripPrefix(raw))
        ? stripPrefix(raw)
        : null
    if (!candidate) continue

    let next = words[i + 1]
    // "משה בן יעקב" / "רחל בת שרה"
    if ((next === 'בן' || next === 'בת') && words[i + 2]) {
      hits.push(`${raw} ${next} ${words[i + 2]}`)
      continue
    }
    if (next.length < 2 || NOT_A_SURNAME.has(next)) continue
    // מילה שמתחילה ב-ה' הידיעה היא לרוב לא שם משפחה ("משה התקדם")
    if (next.startsWith('ה') && next.length > 3 && !COMMON_FIRST_NAMES.includes(next)) continue
    hits.push(`${raw} ${next}`)
  }
  // שם לועזי: שתי מילים באות גדולה ברצף ("John Smith")
  const latin = value.match(/\b[A-Z][a-z]{1,}\s+[A-Z][a-z]{1,}\b/g) ?? []
  return [...hits, ...latin]
}

/**
 * בדיקה מלאה. מחזירה את כל הממצאים, כל אחד עם רמת חומרה.
 * @param {string} value
 * @returns {{ level: 'block'|'warn', reason: string, match: string }[]}
 */
export function findIdentifyingInfo(value) {
  if (!value) return []
  const issues = []

  const email = value.match(EMAIL_PATTERN)
  if (email) issues.push({ level: 'block', reason: 'כתובת אימייל', match: email[0] })

  const id = value.match(ISRAELI_ID_PATTERN) || value.match(ID_WITH_CHECK_DIGIT_PATTERN)
  if (id) issues.push({ level: 'block', reason: 'מספר שנראה כמו תעודת זהות', match: id[0] })

  const phone = value.match(IL_PHONE_PATTERN) || value.match(PHONE_PATTERN)
  if (phone) issues.push({ level: 'block', reason: 'מספר טלפון', match: phone[0] })

  if (!id && !phone) {
    const run = value.match(LONG_DIGIT_RUN_PATTERN)
    if (run) issues.push({ level: 'block', reason: 'רצף ספרות ארוך (מזהה אישי?)', match: run[0] })
  }

  for (const name of findNamePatterns(value)) {
    issues.push({ level: 'warn', reason: 'נראה כמו שם פרטי ושם משפחה', match: name })
  }
  return issues
}

/**
 * הפונקציה המקורית (משמשת בטופס מטופל ובטקסט המקור). מתנהגת כמו קודם —
 * רק ממצאים חוסמים (שמות לא נבדקים כאן) — ונוסף לה אימייל.
 * @param {string} value
 * @returns {{ flagged: boolean, reason: string|null }}
 */
export function checkForIdentifyingInfo(value) {
  if (!value) return { flagged: false, reason: null }

  if (PHONE_PATTERN.test(value) || IL_PHONE_PATTERN.test(value)) {
    return { flagged: true, reason: 'הטקסט נראה כמו מספר טלפון' }
  }
  if (ISRAELI_ID_PATTERN.test(value) || LONG_DIGIT_RUN_PATTERN.test(value)) {
    return { flagged: true, reason: 'הטקסט מכיל רצף ספרות ארוך שעלול להיות ת.ז או מזהה אישי' }
  }
  if (EMAIL_PATTERN.test(value)) {
    return { flagged: true, reason: 'הטקסט מכיל כתובת אימייל' }
  }
  return { flagged: false, reason: null }
}
