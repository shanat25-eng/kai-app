import { useState } from 'react'
import { Pencil, Check, X, TriangleAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { updatePatient } from '../../api/patients'
import { checkForIdentifyingInfo } from '../../utils/privacyGuard'

// כותרת מסך העבודה של מטופל — מציגה אך ורק את שלושת השדות הלא-מזהים
// מ-entities.js/Patient: displayCode, ageRange, treatmentArea.
//
// לעולם לא מציגה:
// - id פנימי (טכני; לא זהות המטופל)
// - notes (שדה חופשי — אין להציגו כאן כדי לא לחשוף בטעות טקסט שהוקלד)
// - createdAt (מטא-דאטה של המערכת, לא רלוונטי לזיהוי בעבודה השוטפת)
//
// עריכת displayCode: אותה רשומת Patient קיימת בלבד (updatePatient) —
// לא נוצר מטופל חדש, ולא נוסף שום שדה מעבר למה שכבר קיים ב-entities.js.
// אותה בדיקת checkForIdentifyingInfo בדיוק כמו ב-PatientFormModal, בלי
// לוגיקת פרטיות חדשה.
export default function PatientWorkspaceHeader({ patient, onPatientUpdate }) {
  const { clinician } = useAuth()
  const { displayCode, ageRange, treatmentArea } = patient

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  function startEditing() {
    setEditValue(displayCode)
    setError(null)
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setError(null)
  }

  async function handleSave() {
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
      setIsEditing(false)
    } catch (err) {
      console.error('kai: failed to update patient displayCode', err)
      setError('העדכון נכשל. נסי שוב.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <header className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-center gap-3">
        {isEditing ? (
          <EditableDisplayCode
            value={editValue}
            onChange={setEditValue}
            onSave={handleSave}
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
              onClick={startEditing}
              aria-label="עריכת קוד המטופל/ת"
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </>
        )}
        <h1 className="text-lg font-bold text-slate-900">מסך עבודה</h1>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
        <div>
          <span className="text-slate-400">קבוצת גיל: </span>
          {ageRange}
        </div>
        <div>
          <span className="text-slate-400">תחום טיפול: </span>
          {treatmentArea}
        </div>
      </div>
    </header>
  )
}

// טופס עריכה מוקטן, inline — מוצג במקום ה-chip כשעורכים. מפוצל כדי לא
// להעמיס את הרינדור הראשי, ולא מיועד לשימוש חוזר מחוץ לכותרת הזו.
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
