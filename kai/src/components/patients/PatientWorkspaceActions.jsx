import { useState } from 'react'
import { FileSearch, PlusCircle, TrendingUp, FileClock, Info } from 'lucide-react'
import { useAppView } from '../../context/AppViewContext'

// ארבע הפעולות של מסך העבודה. שינוי מרכזי בשלב 5:
//   • session_summary  — הפכה לפעילה (פותחת את CreateSessionSummaryScreen).
//   • initial_assessment / progress — נשארו placeholders (מסך הטיפול בהן יגיע בשלבים 6+).
//   • continuation_request — נוסף כ-placeholder רביעי DISABLED לחלוטין,
//     לפי החלטה מפורשת: יופיע בעיצוב אבל בלי onClick ובלי לוגיקה.
//
// למה לא לפתוח מסך יצירה גם ל-initial_assessment / progress? כי לפי הבריף לשלב 5
// אנחנו בונים סוג מסמך אחד בלבד (session_summary). כל תוספת של סוג נוסף היא
// שלב נפרד — עם סטאב יצירה משלו, טופס מותאם, וכו'.
const ACTIONS = [
  {
    key: 'initial_assessment',
    label: 'אבחון ראשוני',
    description: 'יצירת מסמך אבחון חדש למטופל',
    icon: FileSearch,
    status: 'placeholder', // עדיין לא מומש — יגיע בשלב מאוחר יותר
  },
  {
    key: 'session_summary',
    label: 'סיכום מפגש טיפולי',
    description: 'תיעוד מפגש חדש ויצירת טיוטת סיכום',
    icon: PlusCircle,
    status: 'active', // ✅ פעיל בשלב 5
  },
  {
    key: 'progress',
    label: 'סיכום סדרה',
    description: 'סיכום סדרת מפגשים ומעקב התקדמות',
    icon: TrendingUp,
    status: 'placeholder',
  },
  {
    key: 'continuation_request',
    label: 'בקשה להמשך טיפול',
    description: 'יגיע בשלב הבא',
    icon: FileClock,
    status: 'disabled', // מודגם בעיצוב, אבל בלי onClick ובלי לוגיקה
  },
]

export default function PatientWorkspaceActions() {
  const { openCreateSessionSummary } = useAppView()
  // pendingPlaceholderKey = איזה placeholder נלחץ (כדי להראות הודעה של "בשלב הבא").
  // ל-active/disabled אין state — active מנווט מיידית, disabled בכלל לא לחיץ.
  const [pendingPlaceholderKey, setPendingPlaceholderKey] = useState(null)

  function handleActionClick(action) {
    if (action.status === 'active' && action.key === 'session_summary') {
      openCreateSessionSummary()
      return
    }
    if (action.status === 'placeholder') {
      setPendingPlaceholderKey(action.key)
      return
    }
    // 'disabled' — לא אמור להגיע לכאן בכלל (הכפתור לא לחיץ), אבל בכל מקרה: לא עושים כלום.
  }

  return (
    <section aria-label="פעולות ראשיות" className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((action) => {
          const { key, label, description, icon: Icon, status } = action
          const isPending = pendingPlaceholderKey === key
          const isDisabled = status === 'disabled'

          // סגנון בסיסי משותף, ואז שכבת סגנון ייחודית לפי status.
          // active   → מלא צבע (בולט), hover ברור
          // placeholder → אפור-נייטרלי, hover עדין
          // disabled → אופסיטי מופחת, בלי hover, cursor-not-allowed
          const baseClass =
            'flex flex-col items-start gap-2 rounded-xl border bg-white p-4 text-right transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1'
          const statusClass = isDisabled
            ? 'border-slate-200 opacity-60 cursor-not-allowed'
            : status === 'active'
              ? 'border-brand-200 hover:border-brand-500 hover:shadow-sm'
              : `hover:border-brand-200 hover:shadow-sm ${isPending ? 'border-brand-200' : 'border-slate-200'}`

          return (
            <button
              key={key}
              type="button"
              onClick={isDisabled ? undefined : () => handleActionClick(action)}
              disabled={isDisabled}
              aria-disabled={isDisabled}
              aria-pressed={status === 'placeholder' ? isPending : undefined}
              className={`${baseClass} ${statusClass}`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  status === 'active' ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-700'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">{label}</div>
                <div className="mt-0.5 text-xs text-slate-500">{description}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* הודעה מוצגת רק כשנלחץ placeholder (לא active — הוא מנווט, ולא disabled — הוא לא לחיץ) */}
      {pendingPlaceholderKey && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <p>פעולה זו תופעל בשלב פיתוח הבא. כרגע בשלב 5 פעילה רק "סיכום מפגש טיפולי".</p>
        </div>
      )}
    </section>
  )
}
