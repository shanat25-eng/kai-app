import { useEffect, useMemo, useState } from 'react'
import { UserRoundPlus, SearchX } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppView } from '../context/AppViewContext'
import { listPatients, createPatient } from '../api/patients'
import { listSessionsByPatient } from '../api/sessions'
import { listDocumentsByPatient } from '../api/documents'
import { DOCUMENT_STATUS } from '../constants/documentStatus'
import PatientCard from '../components/patients/PatientCard'
import PatientsFilterBar from '../components/patients/PatientsFilterBar'
import PatientsEmptyState from '../components/patients/PatientsEmptyState'
import PatientFormModal from '../components/patients/PatientFormModal'

// טוענת מטופל + מעשירה אותו בנתונים מחושבים (תאריך מפגש אחרון, כמות
// מסמכים) ששני ה-API הנפרדים (sessions.js/documents.js) לא מחזירים
// ישירות. כל ההעשרה קורית כאן, במסך — הכרטיס עצמו (PatientCard) מקבל
// כבר אובייקט "מוכן" ולא יודע כלום על sessions/documents.
async function enrichPatient(patient) {
  const [sessions, documents] = await Promise.all([
    listSessionsByPatient(patient.id),
    listDocumentsByPatient(patient.id),
  ])

  const lastSessionDate =
    sessions.length > 0
      ? sessions.reduce((latest, s) => (s.sessionDate > latest ? s.sessionDate : latest), sessions[0].sessionDate)
      : null

  // סטטוס מייצג לכרטיס — תצוגה בלבד, לא סטטוס חדש: קורא את document.status
  // הקיים (מקור האמת היחיד נשאר constants/documentStatus.js). אם יש מסמך
  // כלשהו שעדיין לא approved, המטופל "בעבודה" (מוצג generated); אם יש
  // מסמכים וכולם approved, המטופל "סגור" (מוצג approved); אין מסמכים →
  // אין סטטוס מייצג בכלל (PatientCard לא יציג badge).
  const representativeStatus =
    documents.length === 0
      ? null
      : documents.some((d) => d.status !== DOCUMENT_STATUS.APPROVED)
        ? DOCUMENT_STATUS.GENERATED
        : DOCUMENT_STATUS.APPROVED

  return { ...patient, lastSessionDate, documentsCount: documents.length, representativeStatus }
}

export default function PatientsScreen() {
  const { clinician } = useAuth()
  const { openPatientWorkspace } = useAppView()

  const [patients, setPatients] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [searchValue, setSearchValue] = useState('')
  const [treatmentAreaFilter, setTreatmentAreaFilter] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)

  async function loadPatients() {
    setIsLoading(true)
    setLoadError(null)
    try {
      const rawPatients = await listPatients()
      const enriched = await Promise.all(rawPatients.map(enrichPatient))
      // מיון: מפגש אחרון קודם — כדי שמטופלים "פעילים" יופיעו למעלה
      enriched.sort((a, b) => (b.lastSessionDate ?? '').localeCompare(a.lastSessionDate ?? ''))
      setPatients(enriched)
    } catch (err) {
      console.error('kai: failed to load patients', err)
      setLoadError('אירעה שגיאה בטעינת רשימת המטופלים. נסי לרענן את הדף.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadPatients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredPatients = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase()
    return patients.filter((p) => {
      const matchesSearch = !normalizedSearch || p.displayCode.toLowerCase().includes(normalizedSearch)
      const matchesTreatmentArea = !treatmentAreaFilter || p.treatmentArea === treatmentAreaFilter
      return matchesSearch && matchesTreatmentArea
    })
  }, [patients, searchValue, treatmentAreaFilter])

  async function handleCreatePatient(formData) {
    await createPatient(formData, clinician.id)
    // תיעוד ה-AuditLog קורה אוטומטית בתוך createPatient (api/patients.js) —
    // אין צורך לקרוא ל-logAction כאן.
    setIsModalOpen(false)
    await loadPatients()
  }

  const hasNoPatientsAtAll = !isLoading && !loadError && patients.length === 0
  const hasActiveFilters = Boolean(searchValue.trim() || treatmentAreaFilter)
  const hasNoFilterResults = !isLoading && !loadError && patients.length > 0 && filteredPatients.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">מטופלים</h1>
        {!hasNoPatientsAtAll && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            <UserRoundPlus className="h-4 w-4" aria-hidden="true" />
            מטופל חדש
          </button>
        )}
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      )}

      {hasNoPatientsAtAll && <PatientsEmptyState onAddPatient={() => setIsModalOpen(true)} />}

      {!isLoading && !loadError && patients.length > 0 && (
        <>
          <PatientsFilterBar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            treatmentAreaFilter={treatmentAreaFilter}
            onTreatmentAreaFilterChange={setTreatmentAreaFilter}
          />

          <p className="text-xs text-slate-400">
            {hasActiveFilters
              ? `${filteredPatients.length} מתוך ${patients.length} מטופלים`
              : `${patients.length} מטופלים`}
          </p>

          {hasNoFilterResults ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <SearchX className="h-6 w-6 text-slate-400" aria-hidden="true" />
              <p className="text-sm text-slate-500">לא נמצאו מטופלים התואמים לחיפוש/סינון.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchValue('')
                  setTreatmentAreaFilter('')
                }}
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                איפוס סינון
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPatients.map((patient) => (
                <PatientCard
                  key={patient.id}
                  patient={patient}
                  onSelect={() => openPatientWorkspace(patient.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {isModalOpen && (
        <PatientFormModal onClose={() => setIsModalOpen(false)} onSubmit={handleCreatePatient} />
      )}
    </div>
  )
}
