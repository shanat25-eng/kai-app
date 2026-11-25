import { FileSearch, PlusCircle, TrendingUp, FileClock } from 'lucide-react'
import { useAppView } from '../../context/AppViewContext'
import { DOCUMENT_TYPE } from '../../constants/documentType'

const ACTIONS = [
  {
    key: DOCUMENT_TYPE.INITIAL_ASSESSMENT,
    label: 'אבחון ראשוני',
    description: 'יצירת דוח אבחון שפה ודיבור חדש',
    icon: FileSearch,
  },
  {
    key: DOCUMENT_TYPE.SESSION_SUMMARY,
    label: 'סיכום מפגש טיפולי',
    description: 'תיעוד מפגש חדש ויצירת טיוטת סיכום',
    icon: PlusCircle,
  },
  {
    key: DOCUMENT_TYPE.SERIES_SUMMARY,
    label: 'סיכום סדרה',
    description: 'סיכום סדרת טיפולים מתוך המסמכים הקיימים',
    icon: TrendingUp,
  },
  {
    key: DOCUMENT_TYPE.CONTINUATION_REQUEST,
    label: 'בקשה להמשך טיפול',
    description: 'טיוטת בקשה מנומקת לקופת חולים / ועדה',
    icon: FileClock,
  },
]

export default function PatientWorkspaceActions() {
  const { openCreateSessionSummary, openCreateClinicalDocument } = useAppView()

  function handleActionClick(action) {
    if (action.key === DOCUMENT_TYPE.SESSION_SUMMARY) {
      openCreateSessionSummary()
      return
    }
    openCreateClinicalDocument(action.key)
  }

  return (
    <section aria-label="פעולות ראשיות" className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((action) => {
          const { key, label, description, icon: Icon } = action
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleActionClick(action)}
              className="flex flex-col items-start gap-2 rounded-xl border border-brand-200 bg-white p-4 text-right transition-all hover:border-brand-500 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
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
    </section>
  )
}
