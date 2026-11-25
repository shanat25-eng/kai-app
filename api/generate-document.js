import { validateTranscript } from '../server/validation.js'

const DOC_TEMPLATES = {
  initial_assessment: {
    title: 'אבחון ראשוני',
    role: 'הכן טיוטת דוח אבחון ראשוני מקצועית בקלינאות תקשורת בעברית (ילדים/נוער) על בסיס תיאור המפגש בלבד.',
    sections: [
      { key: 'referralAndBackground', label: 'סיבת הפניה ורקע' },
      { key: 'generalImpression', label: 'התרשמות כללית (תקשורת, משחק ושיתוף פעולה)' },
      { key: 'languageFindings', label: 'ממצאי אבחון — שפה (הבנה והבעה)' },
      { key: 'speechAndOralFindings', label: 'ממצאי אבחון — היגוי, דיבור ותפקודי פה' },
      { key: 'clinicalSummary', label: 'סיכום קליני' },
      { key: 'recommendationsAndGoals', label: 'המלצות ומטרות ראשוניות לטיפול' },
    ],
  },
  series_summary: {
    title: 'סיכום סדרת טיפולים',
    role: 'הכן טיוטת דוח סיכום סדרת טיפולים מקצועית בקלינאות תקשורת בעברית על בסיס סיכומי המפגשים, האבחון והערות הקלינאית שצורפו בלבד.',
    sections: [
      { key: 'seriesOverview', label: 'רקע ומסגרת סדרת הטיפולים' },
      { key: 'initialStatus', label: 'מצב בתחילת הסדרה' },
      { key: 'interventions', label: 'מטרות ותחומי עבודה במהלך הסדרה' },
      { key: 'progressAndResponse', label: 'התקדמות ותגובת המטופל/ת' },
      { key: 'currentStatus', label: 'מצב תפקודי נוכחי' },
      { key: 'recommendations', label: 'המלצות להמשך' },
    ],
  },
  continuation_request: {
    title: 'בקשה להמשך טיפול',
    role: 'הכן טיוטת מכתב/בקשה מקצועית להמשך טיפול בקלינאות תקשורת בעברית (לקופת חולים / ועדה / גורם מאשר) על בסיס התיעוד הקליני שצורף בלבד. הדגש באופן מקצועי ועובדתי את ההתקדמות שהושגה, הפערים שעדיין קיימים, והצורך הקליני בהמשך טיפול.',
    sections: [
      { key: 'requestOverview', label: 'פרטי הבקשה ורקע טיפולי' },
      { key: 'clinicalProgress', label: 'התקדמות שהושגה עד כה' },
      { key: 'remainingGaps', label: 'פערים וצרכים שטרם הושגו' },
      { key: 'clinicalJustification', label: 'נימוק קליני להמשך טיפול' },
      { key: 'proposedGoals', label: 'מטרות טיפוליות לתקופה המבוקשת' },
      { key: 'requestedScope', label: 'היקף הטיפול המבוקש' },
    ],
  },
}

const MISSING_FALLBACK = 'לא צוין בתיאור'

function buildSystemPrompt(template) {
  const keysSpec = template.sections.map((s) => `- "${s.key}": ${s.label}`).join('\n')
  return `אתה עוזר תיעוד קליני לקלינאיות תקשורת בישראל.
${template.role}

כללי ברזל:
1. כתוב אך ורק על בסיס המידע שסופק. אל תמציא ציונים, בדיקות, אבחנות, תאריכים, גילאים או עובדות שלא נכתבו במפורש.
2. אם חסר מידע לסעיף מסוים — כתוב בדיוק: "${MISSING_FALLBACK}".
3. שפה קלינית עברית מקצועית, ברורה, תמציתית ותקנית. בלי אימוג'ים, בלי כוכביות, בלי כותרות מיותרות בתוך ערך הסעיף.
4. שמור על פרטיות: אל תוסיף שמות אמיתיים או מזהים.

החזר JSON תקין בלבד עם המפתח "sections" הכולל בדיוק את המפתחות הבאים (מחרוזת לכל מפתח):
${keysSpec}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { documentType, sourceText, patientContext } = req.body ?? {}
  const template = DOC_TEMPLATES[documentType]
  if (!template) {
    return res.status(400).json({ error: 'סוג מסמך לא נתמך' })
  }
  if (!sourceText || typeof sourceText !== 'string' || !sourceText.trim()) {
    return res.status(400).json({ error: 'נא להזין תיאור או לבחור מסמכי מקור' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'המערכת אינה מוגדרת עדיין (חסר OPENAI_API_KEY)' })
  }

  const trimmed = sourceText.trim()
  const validation = validateTranscript(trimmed)

  const contextLines = []
  if (patientContext?.ageRange) contextLines.push(`קבוצת גיל: ${patientContext.ageRange}`)
  if (patientContext?.treatmentArea) contextLines.push(`תחום טיפול: ${patientContext.treatmentArea}`)
  const userMessage =
    (contextLines.length > 0 ? `פרטי רקע כלליים (לא מזהים):\n${contextLines.join(' | ')}\n\n` : '') +
    `חומר המקור מהקלינאית:\n${trimmed}`

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.25,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt(template) },
          { role: 'user', content: userMessage },
        ],
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      console.error('OpenAI generate-document error:', resp.status, errText.slice(0, 300))
      return res.status(502).json({ error: 'שגיאה בקבלת תשובה משירות ה-AI' })
    }

    const data = await resp.json()
    const raw = data?.choices?.[0]?.message?.content ?? '{}'
    let parsed = {}
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = {}
    }

    const secObj = parsed?.sections && typeof parsed.sections === 'object' ? parsed.sections : parsed
    const sections = template.sections.map((s) => {
      const val = typeof secObj?.[s.key] === 'string' && secObj[s.key].trim()
        ? secObj[s.key].trim()
        : MISSING_FALLBACK
      return {
        key: s.key,
        label: s.label,
        aiText: val,
        text: val,
      }
    })

    const generatedText = sections
      .map((s) => `${s.label}\n${'-'.repeat(Math.max(s.label.length, 3))}\n${s.text}`)
      .join('\n\n')

    return res.status(200).json({ sections, generatedText, validation })
  } catch (err) {
    console.error('generate-document failed:', err)
    return res.status(500).json({ error: 'שגיאה פנימית ביצירת המסמך' })
  }
}
