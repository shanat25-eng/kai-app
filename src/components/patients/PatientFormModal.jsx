import { useState } from 'react'
import { ShieldAlert, TriangleAlert, X, Check, ArrowLeft } from 'lucide-react'
import {
  AGE_RANGE_OPTIONS,
  TREATMENT_AREA_OPTIONS,
  OTHER_TREATMENT_AREA,
  formatTreatmentAreas,
} from '../../constants/patientOptions'
import { checkForIdentifyingInfo } from '../../utils/privacyGuard'
import { setLocalPatientDetails } from '../../utils/localPatientName'

const INITIAL_FORM = {
  displayCode: '',
  ageRange: AGE_RANGE_OPTIONS[0],
  treatmentAreas: [TREATMENT_AREA_OPTIONS[0]],
  treatmentAreaOther: '',
  notes: '',
}

const EMPTY_LOCAL = {
  name: '', idNumber: '', birthDate: '', address: '',
  healthFund: '', parentNames: '', referralSource: '',
}

export default function PatientFormModal({ onClose, onSubmit }) {
  const [step, setStep] = useState('patient') // 'patient' | 'details'
  const [form, setForm] = useState(INITIAL_FORM)
  const [localForm, setLocalForm] = useState(EMPTY_LOCAL)
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }))
  }

  function toggleTreatmentArea(option) {
    setForm((prev) => {
      const exists = prev.treatmentAreas.includes(option)
      const next = exists
        ? prev.treatmentAreas.filter((a) => a !== option)
        : [...prev.treatmentAreas, option]
      return { ...prev, treatmentAreas: next }
    })
    if (errors.treatmentAreas || errors.treatmentAreaOther)
      setErrors((prev) => ({ ...prev, treatmentAreas: null, treatmentAreaOther: null }))
  }

  function validate() {
    const nextErrors = {}
    if (!form.displayCode.trim()) {
      nextErrors.displayCode = 'שדה חובה — למשל "מטופל א׳" או "PT-101"'
    } else {
      const codeCheck = checkForIdentifyingInfo(form.displayCode)
      if (codeCheck.flagged)
        nextErrors.displayCode = `⚠ ${codeCheck.reason}. אנא הזיני קוד מזהה אנונימי בלבד.`
    }
    if (form.treatmentAreas.length === 0)
      nextErrors.treatmentAreas = 'נא לבחור לפחות תחום טיפול אחד'
    if (form.treatmentAreas.includes(OTHER_TREATMENT_AREA)) {
      if (!form.treatmentAreaOther.trim()) {
        nextErrors.treatmentAreaOther = 'נא לפרט את תחום הטיפול'
      } else {
        const otherCheck = checkForIdentifyingInfo(form.treatmentAreaOther)
        if (otherCheck.flagged)
          nextErrors.treatmentAreaOther = `⚠ ${otherCheck.reason}. אנא הזיני תחום כללי ללא פרט מזהה.`
      }
    }
    const notesCheck = checkForIdentifyingInfo(form.notes)
    if (notesCheck.flagged)
      nextErrors.notes = `⚠ ${notesCheck.reason}. אנא הסירי כל פרט מזהה מההערות.`
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmitPatient(e) {
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
      setStep('details')
    } finally {
      setIsSaving(false)
    }
  }

  function handleSaveDetails() {
    setLocalPatientDetails(form.displayCode.trim(), localForm)
    onClose()
  }

  function updateLocal(field, value) {
    setLocalForm((prev) => ({ ...prev, [field]: value }))
  }

  // ---- Step 2: Local details ----
  if (step === 'details') {
    return (
      <ModalShell onClose={onClose} title="פרטים למסמכים" step={2}>
        <p className="mx-5 mt-3 text-sm text-slate-500">
          פרטי{' '}
          <span className="font-semibold text-brand-700">{form.displayCode.trim()}</span>
          {' '}— נשמרים רק במכשיר זה, לא מועלים לשרת.
        </p>

        <div className="grid grid-cols-1 gap-3 px-5 pb-2 pt-3 sm:grid-cols-2">
          <LocalField label="שם מטופל/ת" value={localForm.name}
            onChange={(v) => updateLocal('name', v)} placeholder="שם מלא" />
          <LocalField label='ת.ז' value={localForm.idNumber}
            onChange={(v) => updateLocal('idNumber', v)} placeholder="מספר זהות" />
          <LocalField label="תאריך לידה" value={localForm.birthDate}
            onChange={(v) => updateLocal('birthDate', v)} placeholder="למשל: 15/03/2015" />
          <LocalField label="קופת חולים" value={localForm.healthFund}
            onChange={(v) => updateLocal('healthFund', v)} placeholder="מכבי / כללית / מאוחדת / לאומית" />
          <LocalField label="כתובת" value={localForm.address}
            onChange={(v) => updateLocal('address', v)} placeholder="רחוב, עיר" />
          <LocalField label="גורם מפנה" value={localForm.referralSource}
            onChange={(v) => updateLocal('referralSource', v)} placeholder="שם ד״ר / מוסד / הורים" />
          <div className="sm:col-span-2">
            <LocalField label="שמות הורים" value={localForm.parentNames}
              onChange={(v) => updateLocal('parentNames', v)} placeholder="שמות ההורים" />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100"
          >
            דלג
          </button>
          <button
            type="button"
            onClick={handleSaveDetails}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            שמירה
          </button>
        </div>
      </ModalShell>
    )
  }

  // ---- Step 1: Patient (Supabase) ----
  return (
    <ModalShell onClose={onClose} title="מטופל חדש" step={1}>
      <div className="mx-5 mt-4 flex items-start gap-2 rounded-lg border border-caution-200 bg-caution-50 px-3 py-2.5 text-sm text-caution-700">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="font-medium">
          חטיבת פרטיות: אין להזין שמות פרטיים, מזהים או פרטי קשר בשום שדה — לרבות שדה ההערות.
        </p>
      </div>

      <form onSubmit={handleSubmitPatient} className="space-y-4 px-5 py-4">
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
              <option key={option} value={option}>{option}</option>
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
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'שומרת…' : (
              <>
                המשך לפרטים
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function ModalShell({ onClose, title, step, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              שלב {step} מתוך 2
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="סגירה"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function LocalField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  )
}
