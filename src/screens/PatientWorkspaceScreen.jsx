import { useEffect, useState } from 'react'
import { ArrowRight, TriangleAlert } from 'lucide-react'
import { useAppView } from '../context/AppViewContext'
import { getPatient } from '../api/patients'
import PatientWorkspaceHeader from '../components/patients/PatientWorkspaceHeader'
import PatientWorkspaceActions from '../components/patients/PatientWorkspaceActions'
import PatientDocumentHistory from '../components/patients/PatientDocumentHistory'

// מסך העבודה של מטופל בודד — נקודת הכניסה המרכזית לעבודה קלינית עם מטופל.
// ה-ID הפנימי מוזרם דרך AppViewContext (openPatientWorkspace), לעולם לא
// מ-URL/route, ולעולם לא מוצג למשתמשת. הזהות הנראית היא displayCode בלבד.
//
// המסך מרכיב שלושה חלקים עצמאיים:
//   1. PatientWorkspaceHeader   — displayCode / ageRange / treatmentArea בלבד
//   2. PatientWorkspaceActions  — 3 פעולות עתידיות (placeholders בשלב הזה)
//   3. PatientDocumentHistory   — היסטוריית מסמכים דרך api/documents.js בלבד
//
// טעינה, שגיאה, ו-"מטופל לא נמצא" מטופלים ברמת המסך כדי שהרכיבים הפנימיים
// יקבלו רק patient תקין ולא צריכים לדעת על מצבי-קצה.
export default function PatientWorkspaceScreen() {
  const { selectedPatientId, closePatientWorkspace } = useAppView()

  const [patient, setPatient] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    // דגל cancelled מונע setState אחרי unmount — אם המשתמשת לוחצת "חזרה"
    // באמצע טעינה, אנחנו לא רוצים לעדכן state של קומפוננטה שכבר לא קיימת.
    let cancelled = false

    async function loadPatient() {
      if (!selectedPatientId) {
        setPatient(null)
        setIsLoading(false)
        setLoadError(null)
        return
      }

      setIsLoading(true)
      setLoadError(null)
      try {
        const result = await getPatient(selectedPatientId)
        if (cancelled) return
        // getPatient מחזיר null אם המטופל לא נמצא (למשל: נמחק במקביל).
        // אנחנו שומרים את null ומטפלים בו למטה כמצב "not found" — לא כשגיאה.
        setPatient(result)
      } catch (err) {
        if (cancelled) return
        console.error('kai: failed to load patient', err)
        setLoadError('אירעה שגיאה בטעינת נתוני המטופל. נסי לחזור למסך המטופלים ולנסות שוב.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadPatient()
    return () => {
      cancelled = true
    }
  }, [selectedPatientId])

  // מצב לא צפוי — נכנסים למסך הזה רק דרך openPatientWorkspace(id), אבל אם
  // בכל זאת אין ID (למשל refresh של הדף בעתיד), מציגים fallback ידידותי
  // במקום מסך ריק/קרוס.
  if (!selectedPatientId) {
    return (
      <NotFoundState
        title="לא נבחר מטופל"
        description="חזרי למסך המטופלים ובחרי מטופל כדי לפתוח את מסך העבודה שלו."
        onBack={closePatientWorkspace}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* כפתור חזרה קבוע בראש, זמין תמיד — גם בזמן טעינה או שגיאה */}
      <button
        type="button"
        onClick={closePatientWorkspace}
        className="flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
      >
        {/* ב-RTL, חץ ימינה משמש כ"חזור" (הכיוון האחורי בקריאה מימין לשמאל) */}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
        חזרה לרשימת המטופלים
      </button>

      {isLoading && <HeaderSkeleton />}

      {!isLoading && loadError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{loadError}</p>
        </div>
      )}

      {!isLoading && !loadError && !patient && (
        <NotFoundState
          title="מטופל לא נמצא"
          description="ייתכן שהמטופל נמחק או שהקישור אינו תקין. חזרי למסך המטופלים כדי לראות את הרשימה העדכנית."
          onBack={closePatientWorkspace}
        />
      )}

      {!isLoading && !loadError && patient && (
        <>
          {/* onPatientUpdate: אחרי עריכת displayCode מוצלחת (updatePatient),
              מעדכן את ה-state המקומי כאן כדי שהמסך ישקף מיד את הקוד החדש
              בלי לרענן דף — אותה רשומת Patient קיימת, רק עדכון state. */}
          <PatientWorkspaceHeader patient={patient} onPatientUpdate={setPatient} />
          <PatientWorkspaceActions />
          <PatientDocumentHistory patientId={patient.id} />
        </>
      )}
    </div>
  )
}

// שלד טעינה לכותרת — משמר את הגובה הצפוי כדי שהעמוד לא "יקפוץ"
// כשהנתונים מגיעים.
function HeaderSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white px-5 py-4" aria-hidden="true">
      <div className="h-6 w-40 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-4 w-64 animate-pulse rounded-lg bg-slate-100" />
    </div>
  )
}

// מצב "לא נמצא" משותף — משמש גם ל-selectedPatientId חסר וגם ל-patient=null.
// עקבי עם הסגנון של PatientsEmptyState (dashed border, טקסט מרכזי, כפתור פעולה).
function NotFoundState({ title, description, onBack }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="max-w-sm text-sm text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        חזרה למטופלים
      </button>
    </div>
  )
}
