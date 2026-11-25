import { useEffect, useState } from 'react'
import { CheckCircle2, ShieldCheck, TriangleAlert, UserCheck, Save } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../utils/formatDate'

export default function SettingsScreen() {
  const { clinician, updateProfile } = useAuth()

  const [fullName, setFullName] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [privacyChecked, setPrivacyChecked] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    if (!clinician) return
    setFullName(clinician.displayName || '')
    setLicenseNumber(clinician.licenseNumber || '')
    setPrivacyChecked(Boolean(clinician.privacyAcceptedAt))
  }, [clinician?.id])

  async function handleSave(e) {
    e.preventDefault()
    setIsSaving(true)
    setSavedOk(false)
    setSaveError(null)
    try {
      await updateProfile({
        fullName,
        licenseNumber,
        privacyAcceptedAt: privacyChecked
          ? clinician?.privacyAcceptedAt || new Date().toISOString()
          : null,
      })
      setSavedOk(true)
    } catch (err) {
      console.error('kai: failed to update clinician profile', err)
      setSaveError('שמירת ההגדרות נכשלה. נסי שוב.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">הגדרות ופרטיות</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          פרטי החתימה שלך יופיעו אוטומטית בתחתית דוחות ה-Word וה-PDF שתייצאי.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-brand-600" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">פרטי הקלינאית לחתימה בדוחות</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="clinicianFullName" className="mb-1 block text-sm font-medium text-slate-700">
                שם מלא לחתימה
              </label>
              <input
                id="clinicianFullName"
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value)
                  setSavedOk(false)
                }}
                placeholder="לדוגמה: תמר כהן"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <label htmlFor="clinicianLicense" className="mb-1 block text-sm font-medium text-slate-700">
                מספר רישיון משרד הבריאות (מ.ר.)
              </label>
              <input
                id="clinicianLicense"
                type="text"
                value={licenseNumber}
                onChange={(e) => {
                  setLicenseNumber(e.target.value)
                  setSavedOk(false)
                }}
                placeholder="לדוגמה: 13-129391"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <p className="text-xs text-slate-400">
            חשבון מחובר: {clinician?.email ?? '—'}
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success-700" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">פרטיות, אבטחה ואחסון מידע (פיילוט)</h2>
          </div>

          <ul className="list-disc space-y-1.5 ps-5 text-xs leading-relaxed text-slate-600">
            <li>
              <strong>ללא פרטים מזהים בענן:</strong> במערכת מוזנים אך ורק קודים אנונימיים (למשל "מטופל א׳"). שם המטופל, ת.ז. ותאריך הלידה אינם נשמרים במערכת — הם מתווספים ידנית רק בקובץ ה-Word המקומי במחשב שלך.
            </li>
            <li>
              <strong>אחסון מוצפן והפרדת חשבונות:</strong> המסמכים נשמרים בבסיס נתונים מאובטח ומוצפן, וכל קלינאית רואה אך ורק את המטופלים והמסמכים של עצמה.
            </li>
            <li>
              <strong>עיבוד AI ותמלול:</strong> ההקלטות והטקסטים נשלחים ליצירת טיוטה ותמלול בלבד עבור משתמשת מחוברת, והאחריות הקלינית המלאה לאישור הטיוטה היא של הקלינאית.
            </li>
          </ul>

          <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={privacyChecked}
              onChange={(e) => {
                setPrivacyChecked(e.target.checked)
                setSavedOk(false)
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              קראתי ואני מאשרת שימוש במערכת באמצעות קודים אנונימיים בלבד, ללא הזנת שמות מטופלים או פרטים מזהים.
              {clinician?.privacyAcceptedAt && (
                <span className="mt-0.5 block text-[11px] text-success-700">
                  אושר ב-{formatDate(clinician.privacyAcceptedAt)}
                </span>
              )}
            </span>
          </label>
        </section>

        {saveError && (
          <p role="alert" className="flex items-start gap-1 text-xs text-red-600">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {saveError}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          {savedOk && (
            <span className="flex items-center gap-1 text-xs font-medium text-success-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              ההגדרות נשמרו בהצלחה
            </span>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {isSaving ? 'שומרת…' : 'שמירת הגדרות'}
          </button>
        </div>
      </form>
    </div>
  )
}
