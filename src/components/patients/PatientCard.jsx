import { Calendar, FileText, Trash2 } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'
import StatusBadge from '../common/StatusBadge'

export default function PatientCard({ patient, onSelect, onDelete }) {
  const { displayCode, ageRange, treatmentArea, lastSessionDate, documentsCount, representativeStatus } = patient

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-bold text-brand-700">
          {displayCode}
        </span>
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            aria-label={`מחיקת מטופל ${displayCode}`}
            className="rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <div>
          <span className="text-slate-400">קבוצת גיל: </span>
          {ageRange}
        </div>
        <div>
          <span className="text-slate-400">תחום טיפול: </span>
          {treatmentArea}
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          <span>מפגש אחרון: {formatDate(lastSessionDate)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {documentsCount} {documentsCount === 1 ? 'מסמך' : 'מסמכים'}
          </span>
          <StatusBadge status={representativeStatus} />
        </div>
      </div>
    </>
  )

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-label={`פתיחת מסך העבודה של מטופל ${displayCode}`}
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-right transition-all hover:border-brand-200 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
      >
        {body}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm">
      {body}
    </div>
  )
}
