import { useEffect, useMemo, useState } from 'react'
import { FileText, Search, TriangleAlert, ChevronLeft } from 'lucide-react'
import { listAllDocuments } from '../api/documents'
import { listPatients } from '../api/patients'
import { useAppView } from '../context/AppViewContext'
import { DOCUMENT_TYPE_CONFIG } from '../constants/documentType'
import { DOCUMENT_STATUS, DOCUMENT_STATUS_CONFIG } from '../constants/documentStatus'
import StatusBadge from '../components/common/StatusBadge'
import { formatDate } from '../utils/formatDate'

export default function DocumentsScreen() {
  const { openDocumentByPatient, openPatientWorkspace } = useAppView()

  const [documents, setDocuments] = useState([])
  const [patientsById, setPatientsById] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setLoadError(null)
      try {
        const [docs, patients] = await Promise.all([listAllDocuments(), listPatients()])
        if (cancelled) return
        const map = {}
        for (const p of patients) map[p.id] = p
        setPatientsById(map)
        setDocuments(docs)
      } catch (err) {
        if (cancelled) return
        console.error('kai: failed to load all documents', err)
        setLoadError('אירעה שגיאה בטעינת רשימת המסמכים. נסי לרענן.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return documents.filter((doc) => {
      if (statusFilter !== 'all' && doc.status !== statusFilter) return false
      if (typeFilter !== 'all' && doc.documentType !== typeFilter) return false
      if (q) {
        const p = patientsById[doc.patientId]
        const hay = `${p?.displayCode ?? ''} ${p?.treatmentArea ?? ''} ${doc.finalText ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [documents, patientsById, search, statusFilter, typeFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900">מסמכים</h1>
          <p className="text-xs text-slate-500">
            כל המסמכים השמורים מכל המטופלים — לחצי על מסמך לפתיחה ועריכה.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {filtered.length} מתוך {documents.length}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי קוד מטופל או תוכן..."
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-3 pr-9 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="סינון לפי סוג מסמך"
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="all">כל סוגי המסמכים</option>
          {Object.entries(DOCUMENT_TYPE_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="סינון לפי סטטוס"
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="all">כל הסטטוסים</option>
          {Object.values(DOCUMENT_STATUS).map((st) => (
            <option key={st} value={st}>
              {DOCUMENT_STATUS_CONFIG[st]?.label ?? st}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
              aria-hidden="true"
            />
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

      {!isLoading && !loadError && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {documents.length === 0
            ? 'עדיין אין מסמכים שמורים. פתחי מטופל וצרי את סיכום המפגש הראשון.'
            : 'לא נמצאו מסמכים התואמים לסינון הנוכחי.'}
        </div>
      )}

      {!isLoading && !loadError && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((doc) => {
            const patient = patientsById[doc.patientId]
            const typeLabel = DOCUMENT_TYPE_CONFIG[doc.documentType]?.label ?? doc.documentType
            const preview = (doc.sections?.[0]?.text || doc.finalText || '').replace(/\s+/g, ' ').trim()

            return (
              <div
                key={doc.id}
                onClick={() => openDocumentByPatient(doc.patientId, doc.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openDocumentByPatient(doc.patientId, doc.id)
                  }
                }}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50/30"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (patient) openPatientWorkspace(patient.id)
                      }}
                      className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700 hover:bg-brand-100"
                    >
                      {patient?.displayCode ?? 'מטופל'}
                    </button>
                    <span className="flex items-center gap-1 text-sm font-bold text-slate-800">
                      <FileText className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      {typeLabel}
                    </span>
                    <StatusBadge status={doc.status} />
                    <span className="text-xs text-slate-400">{formatDate(doc.createdAt)}</span>
                  </div>
                  {preview && (
                    <p className="truncate text-xs text-slate-500">{preview}</p>
                  )}
                </div>
                <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
