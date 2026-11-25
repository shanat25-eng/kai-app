import { useState } from 'react'
import { ShieldAlert, TriangleAlert, X, Check } from 'lucide-react'
import {
  AGE_RANGE_OPTIONS,
  TREATMENT_AREA_OPTIONS,
  OTHER_TREATMENT_AREA,
  formatTreatmentAreas,
} from '../../constants/patientOptions'
import { checkForIdentifyingInfo } from '../../utils/privacyGuard'

const INITIAL_FORM = {
  displayCode: '',
  ageRange: AGE_RANGE_OPTIONS[0],
  treatmentAreas: [TREATMENT_AREA_OPTIONS[0]],
  treatmentAreaOther: '',
  notes: '',
}

export default function PatientFormModal({ onClose, onSubmit }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  function toggleTreatmentArea(option) {
    setForm((prev) => {
      const exists = prev.treatmentAreas.includes(option)
      const next = exists
        ? prev.treatmentAreas.filter((a) => a !== option)
        : [...prev.treatmentAreas, option]
      return { ...prev, treatmentAreas: next }
    })
    if (errors.treatmentAreas || errors.treatmentAreaOther) {
      setErrors((prev) => ({ ...prev, treatmentAreas: null, treatmentAreaOther: null }))
    }
  }

  function validate() {
    const nextErrors = {}

    if (!form.displayCode.trim()) {
      nextErrors.displayCode = 'שדה חובה — למשל "מטופל א׳" או "PT-101"'
    } else {
      const codeCheck = checkForIdentifyingInfo(form.displayCode)
      if (codeCheck.flagged) {
        nextErrors.displayCode = `⚠ ${codeCheck.reason}. אנא הזיני קוד מזהה אנונימי בלבד.`
      }
    }

    if (form.treatmentAreas.length === 0) {
      nextErrors.treatmentAreas = 'נא לבחור לפחות תחום טיפול אחד'
    }

    if (form.treatmentAreas.includes(OTHER_TREATMENT_AREA)) {
      if (!form.treatmentAreaOther.trim()) {
        nextErrors.treatmentAreaOther = 'נא לפרט את תחום הטיפול'
      } else {
        const otherCheck = checkForIdentifyingInfo(form.treatmentAreaOther)
        if (otherCheck.flagged) {
          nextErrors.treatmentAreaOther = `⚠ ${otherCheck.reason}. אנא הזיני תחום כללי ללא פרט מזהה.`
        }
      }
    }

    const notesCheck = checkForIdentifyingInfo(form.notes)
    if (notesCheck.flagged) {
      nextErrors.notes = `⚠ ${notesCheck.reason}. אנא הסירי כל פרט מזהה מההערות.`
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    try {
      await onSubmit({
        displayCode: form.displayCode.trim(),
        ageRange: form.ageRange,
        treatmentArea: formatTreatmentAreas(form.treatmentAreas, form.treatmentAreaOther),
        notes: form.notes.trim(),
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-form-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="patient-form-title" className="text-base font-bold text-slate-900">
            מטופל חדש
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="סגירה"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mx-5 mt-4 flex items-start gap-2 rounded-lg border border-caution-200 bg-caution-50 px-3 py-2.5 text-sm text-caution-700">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="font-medium">
            חטיבת פרטיות: אין להזין שמות פרטיים, מזהים או פרטי קשר בשום שדה — לרבות שדה ההערות.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor="displayCode" className="mb-1 block text-sm font-medium text-slate-700">
              קוד מזהה אנונימי <span className="text-red-500">*</span>
            </label>
            <input
              id="displayCode"
              type="text"
              value={form.displayCode}
              onChange={(e) => updateField('displayCode', e.target.value)}
              placeholder='למשל: "מטופל א׳" או "PT-101"'
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.displayCode
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'
              }`}
            />
            {errors.displayCode && (
              <p className="mt-1 flex items-start gap-1 text-xs text-red-600">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {errors.displayCode}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="ageRange" className="mb-1 block text-sm font-medium text-slate-700">
              קבוצת גיל
            </label>
            <select
              id="ageRange"
              value={form.ageRange}
              onChange={(e) => updateField('ageRange', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {AGE_RANGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              תחום טיפול <span className="text-xs font-normal text-slate-400">(אפשר לבחור יותר מאחד)</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {TREATMENT_AREA_OPTIONS.map((option) => {
                const selected = form.treatmentAreas.includes(option)
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleTreatmentArea(option)}
                    aria-pressed={selected}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" aria-hidden="true" />}
                    {option}
                  </button>
                )
              })}
            </div>
            {errors.treatmentAreas && (
              <p className="mt-1 text-xs text-red-600">{errors.treatmentAreas}</p>
            )}

            {form.treatmentAreas.includes(OTHER_TREATMENT_AREA) && (
              <div className="mt-2">
                <input
                  type="text"
                  value={form.treatmentAreaOther}
                  onChange={(e) => updateField('treatmentAreaOther', e.target.value)}
                  placeholder="פרטי תחום טיפול נוסף (למשל: קול / בליעה)..."
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    errors.treatmentAreaOther
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                      : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'
                  }`}
                />
                {errors.treatmentAreaOther && (
                  <p className="mt-1 text-xs text-red-600">{errors.treatmentAreaOther}</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700">
              הערות כלליות
            </label>
            <textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="הערות קליניות כלליות — ללא פרטים מזהים"
              className={`w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                errors.notes
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'
              }`}
            />
            {errors.notes && (
              <p className="mt-1 flex items-start gap-1 text-xs text-red-600">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {errors.notes}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'שומרת...' : 'שמירת מטופל'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
