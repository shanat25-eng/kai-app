import { useState } from 'react'
import { Pencil, Check, X, TriangleAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { updatePatient } from '../../api/patients'
import {
  AGE_RANGE_OPTIONS,
  TREATMENT_AREA_OPTIONS,
  OTHER_TREATMENT_AREA,
  parseTreatmentAreas,
  formatTreatmentAreas,
} from '../../constants/patientOptions'
import { checkForIdentifyingInfo } from '../../utils/privacyGuard'

const AGE_SELECT_OPTIONS = [...AGE_RANGE_OPTIONS, OTHER_TREATMENT_AREA]

export default function PatientWorkspaceHeader({ patient, onPatientUpdate }) {
  const { clinician } = useAuth()
  const { displayCode, ageRange, treatmentArea } = patient

  const [editingField, setEditingField] = useState(null) // 'displayCode' | 'ageRange' | 'treatmentArea' | null
  const [editValue, setEditValue] = useState('')
  const [editAreas, setEditAreas] = useState([])
  const [editOtherValue, setEditOtherValue] = useState('')
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  function startEditingDisplayCode() {
    setEditingField('displayCode')
    setEditValue(displayCode)
    setError(null)
  }

  function startEditingAge() {
    setEditingField('ageRange')
    const isPreset = AGE_RANGE_OPTIONS.includes(ageRange)
    if (isPreset) {
      setEditValue(ageRange)
      setEditOtherValue('')
    } else {
      setEditValue(OTHER_TREATMENT_AREA)
      setEditOtherValue(ageRange ?? '')
    }
    setError(null)
  }

  function startEditingTreatmentArea() {
    setEditingField('treatmentArea')
    const parsed = parseTreatmentAreas(treatmentArea)
    setEditAreas(parsed.selected)
    setEditOtherValue(parsed.otherText)
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

  async function handleSaveAge() {
    let finalValue = editValue
    if (editValue === OTHER_TREATMENT_AREA) {
      const trimmed = editOtherValue.trim()
      if (!trimmed) {
        setError('נא לפרט קבוצת גיל')
        return
      }
      const check = checkForIdentifyingInfo(trimmed)
      if (check.flagged) {
        setError(`⚠ ${check.reason}. אנא הזיני ערך כללי ללא פרט מזהה.`)
        return
      }
      finalValue = trimmed
    }
    setIsSaving(true)
    setError(null)
    try {
      const updated = await updatePatient(patient.id, { ageRange: finalValue }, clinician.id)
      onPatientUpdate(updated)
      setEditingField(null)
    } catch (err) {
      console.error('kai: failed to update patient ageRange', err)
      setError('העדכון נכשל. נסי שוב.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveTreatmentArea() {
    if (editAreas.length === 0) {
      setError('נא לבחור לפחות תחום טיפול אחד')
      return
    }
    if (editAreas.includes(OTHER_TREATMENT_AREA)) {
      const trimmed = editOtherValue.trim()
      if (!trimmed) {
        setError('נא לפרט תחום טיפול נוסף')
        return
      }
      const check = checkForIdentifyingInfo(trimmed)
      if (check.flagged) {
        setError(`⚠ ${check.reason}. אנא הזיני ערך כללי ללא פרט מזהה.`)
        return
      }
    }
    const finalValue = formatTreatmentAreas(editAreas, editOtherValue)
    setIsSaving(true)
    setError(null)
    try {
      const updated = await updatePatient(patient.id, { treatmentArea: finalValue }, clinician.id)
      onPatientUpdate(updated)
      setEditingField(null)
    } catch (err) {
      console.error('kai: failed to update patient treatmentArea', err)
      setError('העדכון נכשל. נסי שוב.')
    } finally {
      setIsSaving(false)
    }
  }

  function toggleArea(opt) {
    setEditAreas((prev) => (prev.includes(opt) ? prev.filter((a) => a !== opt) : [...prev, opt]))
    setError(null)
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
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400">קבוצת גיל:</span>
              <select
                value={editValue}
                onChange={(e) => {
                  setEditValue(e.target.value)
                  setError(null)
                }}
                autoFocus
                disabled={isSaving}
                aria-label="קבוצת גיל"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {AGE_SELECT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {editValue === OTHER_TREATMENT_AREA && (
                <input
                  type="text"
                  value={editOtherValue}
                  onChange={(e) => {
                    setEditOtherValue(e.target.value)
                    setError(null)
                  }}
                  disabled={isSaving}
                  placeholder="פרטי קבוצת גיל..."
                  className="w-40 rounded-lg border border-slate-300 px-2.5 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              )}
              <button
                type="button"
                onClick={handleSaveAge}
                disabled={isSaving}
                aria-label="שמירת קבוצת גיל"
                className="rounded-md p-1 text-success-700 hover:bg-success-50 disabled:opacity-60"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                disabled={isSaving}
                aria-label="ביטול עריכה"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-60"
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
        ) : (
          <div className="flex items-center gap-1.5">
            <span>
              <span className="text-slate-400">קבוצת גיל: </span>
              {ageRange}
            </span>
            <button
              type="button"
              onClick={startEditingAge}
              aria-label="עריכת קבוצת גיל"
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {editingField === 'treatmentArea' ? (
          <div className="flex w-full flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-600">
                בחרי תחום טיפול (אפשר יותר מאחד):
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSaveTreatmentArea}
                  disabled={isSaving}
                  className="flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  שמירה
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-200"
                >
                  ביטול
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TREATMENT_AREA_OPTIONS.map((opt) => {
                const selected = editAreas.includes(opt)
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleArea(opt)}
                    disabled={isSaving}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" aria-hidden="true" />}
                    {opt}
                  </button>
                )
              })}
            </div>
            {editAreas.includes(OTHER_TREATMENT_AREA) && (
              <input
                type="text"
                value={editOtherValue}
                onChange={(e) => {
                  setEditOtherValue(e.target.value)
                  setError(null)
                }}
                disabled={isSaving}
                placeholder="פרטי תחום טיפול נוסף (למשל: קול / בליעה)..."
                className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            )}
            {error && (
              <p className="flex items-start gap-1 text-xs text-red-600">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span>
              <span className="text-slate-400">תחום טיפול: </span>
              {treatmentArea}
            </span>
            <button
              type="button"
              onClick={startEditingTreatmentArea}
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
