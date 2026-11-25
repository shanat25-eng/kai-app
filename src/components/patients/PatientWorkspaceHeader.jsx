import { useState } from 'react'
import { Pencil, Check, X, TriangleAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { updatePatient } from '../../api/patients'
import { AGE_RANGE_OPTIONS, TREATMENT_AREA_OPTIONS } from '../../constants/patientOptions'
import { checkForIdentifyingInfo } from '../../utils/privacyGuard'

const OTHER_OPTION = 'אחר'
const AGE_SELECT_OPTIONS = [...AGE_RANGE_OPTIONS, OTHER_OPTION]

// כותרת מסך העבודה של מטופל — מציגה אך ורק את שלושת השדות הלא-מזהים
// מ-entities.js/Patient: displayCode, ageRange, treatmentArea.
//
// לעולם לא מציגה:
// - id פנימי (טכני; לא זהות המטופל)
// - notes (שדה חופשי — אין להציגו כאן כדי לא לחשוף בטעות טקסט שהוקלד)
// - createdAt (מטא-דאטה של המערכת, לא רלוונטי לזיהוי בעבודה השוטפת)
//
// עריכת displayCode, ageRange ו-treatmentArea: אותה רשומת Patient קיימת בלבד
// (updatePatient) — לא נוצר מטופל חדש, וכל טקסט חופשי עובר checkForIdentifyingInfo.
export default function PatientWorkspaceHeader({ patient, onPatientUpdate }) {
  const { clinician } = useAuth()
  const { displayCode, ageRange, treatmentArea } = patient

  const [editingField, setEditingField] = useState(null) // 'displayCode' | 'ageRange' | 'treatmentArea' | null
  const [editValue, setEditValue] = useState('')
  const [editOtherValue, setEditOtherValue] = useState('')
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  function startEditingDisplayCode() {
    setEditingField('displayCode')
    setEditValue(displayCode)
    setEditOtherValue('')
    setError(null)
  }

  function startEditingOption(field, currentValue, presetOptions) {
    setEditingField(field)
    const isPreset = presetOptions.includes(currentValue) && currentValue !== OTHER_OPTION
    if (isPreset) {
      setEditValue(currentValue)
      setEditOtherValue('')
    } else {
      setEditValue(OTHER_OPTION)
      setEditOtherValue(currentValue === OTHER_OPTION ? '' : (currentValue ?? ''))
    }
    setError(null)
  }

  function cancelEditing() {
    setEditingField(null)
    setError(null)
  }

  async function handleSaveDisplayCode() {
    const trimmed = editValue.trim()

    if (!trimmed) {
      setError('שדה חובה — למשל "מטופל א׳" או "PT-101"')
      return
    }
    const codeCheck = checkForIdentifyingInfo(trimmed)
    if (codeCheck.flagged) {
      setError(`⚠ ${codeCheck.reason}. אנא הזיני קוד מזהה אנונימי בלבד.`)
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const updated = await updatePatient(patient.id, { displayCode: trimmed }, clinician.id)
      onPatientUpdate(updated)
      setEditingField(null)
    } catch (err) {
      console.error('kai: failed to update patient displayCode', err)
      setError('העדכון נכשל. נסי שוב.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveOption(field) {
    let finalValue = editValue
    if (editValue === OTHER_OPTION) {
      const trimmedOther = editOtherValue.trim()
      if (!trimmedOther) {
        setError(field === 'ageRange' ? 'נא לפרט קבוצת גיל' : 'נא לפרט תחום טיפול')
        return
      }
      const check = checkForIdentifyingInfo(trimmedOther)
      if (check.flagged) {
        setError(`⚠ ${check.reason}. אנא הזיני ערך כללי ללא פרט מזהה.`)
        return
      }
      finalValue = trimmedOther
    }

    setIsSaving(true)
    setError(null)
    try {
      const updated = await updatePatient(patient.id, { [field]: finalValue }, clinician.id)
      onPatientUpdate(updated)
      setEditingField(null)
    } catch (err) {
      console.error(`kai: failed to update patient ${field}`, err)
      setError('העדכון נכשל. נסי שוב.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-center gap-3">
        {editingField === 'displayCode' ? (
          <EditableDisplayCode
            value={editValue}
            onChange={setEditValue}
            onSave={handleSaveDisplayCode}
            onCancel={cancelEditing}
            isSaving={isSaving}
            error={error}
          />
        ) : (
          <>
            <span className="rounded-lg bg-brand-50 px-3 py-1.5 text-base font-bold text-brand-700">
              {displayCode}
            </span>
            <button
              type="button"
              onClick={startEditingDisplayCode}
              aria-label="עריכת קוד המטופל/ת"
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </>
        )}
        <h1 className="text-lg font-bold text-slate-900">מסך עבודה</h1>
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-2 text-sm text-slate-600">
        {editingField === 'ageRange' ? (
          <EditableSelectField
            label="קבוצת גיל"
            options={AGE_SELECT_OPTIONS}
            value={editValue}
            otherValue={editOtherValue}
            otherPlaceholder="פרטי קבוצת גיל..."
            onChange={(val) => {
              setEditValue(val)
              setError(null)
            }}
            onOtherChange={(val) => {
              setEditOtherValue(val)
              setError(null)
            }}
            onSave={() => handleSaveOption('ageRange')}
            onCancel={cancelEditing}
            isSaving={isSaving}
            error={error}
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <span>
              <span className="text-slate-400">קבוצת גיל: </span>
              {ageRange}
            </span>
            <button
              type="button"
              onClick={() => startEditingOption('ageRange', ageRange, AGE_SELECT_OPTIONS)}
              aria-label="עריכת קבוצת גיל"
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {editingField === 'treatmentArea' ? (
          <EditableSelectField
            label="תחום טיפול"
            options={TREATMENT_AREA_OPTIONS}
            value={editValue}
            otherValue={editOtherValue}
            otherPlaceholder="פרטי תחום טיפול..."
            onChange={(val) => {
              setEditValue(val)
              setError(null)
            }}
            onOtherChange={(val) => {
              setEditOtherValue(val)
              setError(null)
            }}
            onSave={() => handleSaveOption('treatmentArea')}
            onCancel={cancelEditing}
            isSaving={isSaving}
            error={error}
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <span>
              <span className="text-slate-400">תחום טיפול: </span>
              {treatmentArea}
            </span>
            <button
              type="button"
              onClick={() => startEditingOption('treatmentArea', treatmentArea, TREATMENT_AREA_OPTIONS)}
              aria-label="עריכת תחום טיפול"
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

// טופס עריכה מוקטן, inline — מוצג במקום ה-chip כשעורכים.
function EditableDisplayCode({ value, onChange, onSave, onCancel, isSaving, error }) {
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={isSaving}
          aria-label="קוד המטופל/ת"
          className={`w-full max-w-xs rounded-lg border px-2.5 py-1.5 text-base font-bold focus:outline-none focus:ring-1 ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
              : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'
          }`}
        />
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          aria-label="שמירת קוד המטופל/ת"
          className="rounded-md p-1.5 text-success-700 transition-colors hover:bg-success-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          aria-label="ביטול עריכה"
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p className="flex items-start gap-1 text-xs text-red-600">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

function EditableSelectField({
  label,
  options,
  value,
  otherValue,
  otherPlaceholder,
  onChange,
  onOtherChange,
  onSave,
  onCancel,
  isSaving,
  error,
}) {
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-slate-400">{label}:</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={isSaving}
          aria-label={label}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        {value === OTHER_OPTION && (
          <input
            type="text"
            value={otherValue}
            onChange={(e) => onOtherChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            placeholder={otherPlaceholder}
            aria-label={otherPlaceholder}
            className={`w-44 rounded-lg border px-2.5 py-1 text-sm focus:outline-none focus:ring-1 ${
              error
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'
            }`}
          />
        )}

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          aria-label={`שמירת ${label}`}
          className="rounded-md p-1 text-success-700 transition-colors hover:bg-success-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          aria-label="ביטול עריכה"
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p className="flex items-start gap-1 text-xs text-red-600">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
