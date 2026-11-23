import { useEffect, useState } from 'react'
import { FileText, TriangleAlert } from 'lucide-react'
import { listDocumentsByPatient } from '../../api/documents'
import { DOCUMENT_TYPE_CONFIG } from '../../constants/documentType'
import StatusBadge from '../common/StatusBadge'
import { formatDate } from '../../utils/formatDate'
import { useAppView } from '../../context/AppViewContext'

// היסטוריית המסמכים של מטופל. טוענת אך ורק דרך api/documents.js —
// כלל ברזל: רכיבי React לעולם לא ניגשים ל-localStorage/sessionStorage
// ישירות (יש לזה שכבת storage.js שנצרכת רק על ידי api/*).
//
// מציג רק שדות שקיימים בפועל ב-Document/entities.js:
//   • documentType — עם התווית הקריאה מ-DOCUMENT_TYPE_CONFIG
//   • updatedAt   — התאריך היחסי האחרון (עדכני יותר מ-createdAt לעבודה שוטפת)
//   • status      — דרך StatusBadge הגנרי הקיים
//
// לעולם לא מציג את generatedText/finalText/sourceText — תצוגה מלאה של מסמך
// תגיע במסך העריכה בשלב הבא (שם יש גם privacyGuard לפני שמירה).
export default function PatientDocumentHistory({ patientId }) {
  const { openDocumentEdit } = useAppView()
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    // דגל cancelled מונע setState אחרי unmount אם המטופל התחלף באמצע הטעינה
    // (למשל: לחיצה חזרה למטופלים בעודנו טוענים) — מונע warning ב-React.
    let cancelled = false

    async function loadDocuments() {
      setIsLoading(true)
      setLoadError(null)
      try {
        const result = await listDocumentsByPatient(patientId)
        if (cancelled) return
        // מיון: העדכני ביותר קודם. updatedAt קיים לכל Document (נכתב ב-createDocument).
        const sorted = [...result].sort((a, b) =>
          (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
        )
        setDocuments(sorted)
      } catch (err) {
        if (cancelled) return
        console.error('kai: failed to load documents', err)
        setLoadError('אירעה שגיאה בטעינת המסמכים.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadDocuments()
    return () => {
      cancelled = true
    }
  }, [patientId])

  return (
    <section aria-label="היסטוריית מסמכים" className="space-y-3">
      <h2 className="text-base font-bold text-slate-900">היסטוריית מסמכים</h2>

      {isLoading && (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      )}

      {!isLoading && loadError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{loadError}</p>
        </div>
      )}

      {!isLoading && !loadError && documents.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <FileText className="h-6 w-6 text-slate-400" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-700">עדיין אין מסמכים למטופל/ת זה</p>
            <p className="max-w-sm text-xs text-slate-500">
              כאן יופיעו האבחונים, סיכומי המפגשים והמסמכים המאושרים.
            </p>
          </div>
        </div>
      )}

      {!isLoading && !loadError && documents.length > 0 && (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id}>
              {/* button (לא li עם onClick) — נגישות מקלדת (Enter/Space) בחינם,
                  בלי צורך ב-role/tabIndex/onKeyDown ידניים. doc.id הוא ה-id
                  האמיתי של המסמך הזה בדיוק (מגיע ישירות מה-map, לא מאינדקס). */}
              <button
                type="button"
                onClick={() => openDocumentEdit(doc.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {DOCUMENT_TYPE_CONFIG[doc.documentType]?.label ?? doc.documentType}
                    </div>
                    <div className="text-xs text-slate-500">
                      עודכן: {formatDate(doc.updatedAt)}
                      {doc.version > 1 && <> · גרסה {doc.version}</>}
                    </div>
                  </div>
                </div>
                <StatusBadge status={doc.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
