import { useState, useRef } from 'react'
import { Pencil, Check, X, TriangleAlert, Mic, MicOff, FileDown } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { updatePatient } from '../../api/patients'
import { supabase } from '../../api/supabaseClient'
import { getLocalPatientDetails, setLocalPatientDetails, FRAMEWORK_OPTIONS } from '../../utils/localPatientName'
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

      <LocalNameField displayCode={displayCode} patient={patient} clinician={clinician} />
    </header>
  )
}

function LocalNameField({ displayCode, patient, clinician }) {
  const [details, setDetails] = useState(() => getLocalPatientDetails(displayCode))
  const [savedAt, setSavedAt] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)

  function update(field, value) {
    const next = { ...details, [field]: value }
    setDetails(next)
    setLocalPatientDetails(displayCode, next)
  }

  function handleSave() {
    setLocalPatientDetails(displayCode, details)
    setSavedAt(new Date())
  }

  async function transcribeAudio(blob) {
    const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
    const url = `${BASE_URL}/transcribe`
    const formData = new FormData()
    formData.append('audio', blob, 'recording.webm')

    async function doPost(token) {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      return fetch(url, { method: 'POST', headers, body: formData })
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      let token = sessionData?.session?.access_token
      let response = await doPost(token)

      if (response.status === 401) {
        const { data: refreshed } = await supabase.auth.refreshSession()
        token = refreshed?.session?.access_token
        response = await doPost(token)
      }

      if (!response.ok) return null
      const json = await response.json()
      return json.text || json.transcription || null
    } catch {
      return null
    }
  }

  async function handleMicToggle() {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        setIsRecording(false)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setIsTranscribing(true)
        const text = await transcribeAudio(blob)
        setIsTranscribing(false)
        if (text) {
          setDetails((prev) => {
            const next = {
              ...prev,
              additionalDiagnoses: prev.additionalDiagnoses
                ? prev.additionalDiagnoses + '\n' + text
                : text,
            }
            setLocalPatientDetails(displayCode, next)
            return next
          })
        }
      }

      recorder.start()
      setIsRecording(true)
    } catch {
      // permission denied or not supported — fail silently
    }
  }

  function buildExportHtml(forWord) {
    const now = new Date()
    const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`

    function esc(str) {
      return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }

    const clinicianName = clinician?.full_name || ''
    const licenseNumber = clinician?.license_number || ''
    const name = details.name || ''

    const htmlTag = forWord
      ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="he">`
      : `<html lang="he" dir="rtl">`

    const additionalSection = details.additionalDiagnoses
      ? `<div class="section"><h2>אבחונים נוספים:</h2><div class="body">${esc(details.additionalDiagnoses).replace(/\n/g, '<br/>')}</div></div>`
      : ''
    const recommendationsSection = details.frameworkRecommendations
      ? `<div class="section"><h2>המלצות למסגרת:</h2><div class="body">${esc(details.frameworkRecommendations).replace(/\n/g, '<br/>')}</div></div>`
      : ''

    return `<!DOCTYPE html>
${htmlTag}
<head>
<meta charset="utf-8" />
<title>פרטי מטופל — ${esc(displayCode)}</title>
<style>
  @page { size: A4; margin: 18mm 18mm 20mm 18mm; }
  body { font-family: 'David', 'Arial', 'Segoe UI', Tahoma, sans-serif; direction: rtl; text-align: right; color: #1e293b; line-height: 1.65; font-size: 12pt; margin: 0; padding: 0; background: #ffffff; }
  .page { max-width: 720px; margin: 0 auto; padding: 16px 8px; }
  .top-row { display: flex; justify-content: space-between; font-size: 10.5pt; color: #475569; margin-bottom: 8px; }
  .header { border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 18px; }
  .header h1 { margin: 0 0 10px 0; font-size: 17pt; color: #1e1b4b; text-align: center; }
  .meta { width: 100%; border-collapse: collapse; font-size: 10.5pt; color: #334155; background: #f8fafc; border: 1px solid #e2e8f0; }
  .meta td { padding: 5px 10px; border: 1px solid #e2e8f0; width: 50%; }
  .meta strong { color: #0f172a; }
  .section { margin-bottom: 15px; page-break-inside: avoid; }
  .section h2 { margin: 0 0 5px 0; font-size: 12.5pt; color: #1e1b4b; text-decoration: underline; }
  .section .body { font-size: 11.5pt; color: #1e293b; }
  .signature { margin-top: 28px; page-break-inside: avoid; font-size: 11.5pt; line-height: 1.7; }
  .footer-note { margin-top: 20px; padding-top: 8px; border-top: 1px solid #cbd5e1; font-size: 9pt; color: #64748b; }
</style>
</head>
<body>
  <div class="page">
    <div class="top-row">
      <span>בס"ד</span>
      <span>תאריך: ${esc(dateStr)}</span>
    </div>
    <div class="header">
      <h1>פרטי מטופל — ${esc(displayCode)}</h1>
      <table class="meta">
        <tr>
          <td><strong>שם המטופל/ת:</strong> ${name ? esc(name) : '_______________________'}</td>
          <td><strong>ת.ז.:</strong> ${details.idNumber ? esc(details.idNumber) : '___________________'}</td>
        </tr>
        <tr>
          <td><strong>תאריך לידה:</strong> ${details.birthDate ? esc(details.birthDate) : '_______________'}</td>
          <td><strong>קופת חולים:</strong> ${details.healthFund ? esc(details.healthFund) : '_______________'}</td>
        </tr>
        <tr>
          <td><strong>קבוצת גיל:</strong> ${esc(patient?.ageRange ?? '—')}</td>
          <td><strong>תחום טיפול:</strong> ${esc(patient?.treatmentArea ?? '—')}</td>
        </tr>
        ${details.parentNames ? `<tr><td colspan="2"><strong>שמות הורים:</strong> ${esc(details.parentNames)}</td></tr>` : ''}
        ${details.referralSource ? `<tr><td colspan="2"><strong>גורם שהמליץ:</strong> ${esc(details.referralSource)}</td></tr>` : ''}
        ${details.address ? `<tr><td colspan="2"><strong>כתובת:</strong> ${esc(details.address)}</td></tr>` : ''}
        <tr>
          <td><strong>סוג מסגרת:</strong> ${details.frameworkType ? esc(details.frameworkType) : '_______________'}</td>
          <td><strong>בדיקת שמיעה:</strong> ${details.hearingTestDate || details.hearingTestResult
            ? `${esc(details.hearingTestDate ?? '')} ${esc(details.hearingTestResult ?? '')}`.trim()
            : '_______________'}</td>
        </tr>
      </table>
    </div>
    ${additionalSection}
    ${recommendationsSection}
    <div class="signature">
      <div>בברכה,</div>
      <table style="width:100%;margin-top:14px;border-collapse:collapse;">
        <tr>
          <td style="width:50%;padding:4px 8px 4px 0;vertical-align:top;">
            <div style="font-size:10.5pt;color:#475569;margin-bottom:2px;">שם הבודקת:</div>
            <div style="font-weight:bold;">${clinicianName ? esc(clinicianName) : '_______________________'}</div>
            <div style="font-size:10pt;color:#475569;">קלינאית תקשורת</div>
            <div style="font-size:10pt;color:#475569;">מ.ר. ${licenseNumber ? esc(licenseNumber) : '____________'}</div>
          </td>
          <td style="width:50%;padding:4px 0 4px 8px;vertical-align:top;border-right:1px solid #e2e8f0;">
            <div style="font-size:10.5pt;color:#475569;margin-bottom:2px;">תאריך:</div>
            <div>${esc(dateStr)}</div>
            <div style="margin-top:28px;border-bottom:1px solid #334155;width:140px;">&nbsp;</div>
            <div style="font-size:9pt;color:#64748b;margin-top:3px;">חתימה וחותמת</div>
          </td>
        </tr>
      </table>
    </div>
    <div class="footer-note" style="text-align:center;">
      הופק באמצעות K.ai &nbsp;|&nbsp; &copy; 2026 K.ai &nbsp;|&nbsp; פיילוט — לשימוש בדיקה בלבד
    </div>
  </div>
</body>
</html>`
  }

  function handleExportWord() {
    const html = buildExportHtml(true)
    const blob = new Blob(['﻿', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `פרטי_מטופל_${displayCode}.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportPdf() {
    const html = buildExportHtml(false)
    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.onload = () => { win.focus(); win.print() }
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-400'
  const labelCls = 'mb-1 block text-xs font-medium text-slate-500'

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <p className="mb-3 text-xs font-semibold text-slate-500">פרטים למסמכים</p>

      <p className="mb-2 text-xs text-slate-400 font-medium">פרטים אישיים</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>שם מטופל/ת</label>
          <input type="text" value={details.name} onChange={(e) => update('name', e.target.value)}
            placeholder="שם מלא" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>ת.ז</label>
          <input type="text" value={details.idNumber} onChange={(e) => update('idNumber', e.target.value)}
            placeholder="מספר זהות" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>תאריך לידה</label>
          <input type="text" value={details.birthDate} onChange={(e) => update('birthDate', e.target.value)}
            placeholder="למשל: 15/03/2015" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>קופת חולים</label>
          <input type="text" value={details.healthFund} onChange={(e) => update('healthFund', e.target.value)}
            placeholder="מכבי / כללית / מאוחדת / לאומית" className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>כתובת</label>
          <input type="text" value={details.address} onChange={(e) => update('address', e.target.value)}
            placeholder="רחוב, עיר" className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>שמות הורים</label>
          <input type="text" value={details.parentNames} onChange={(e) => update('parentNames', e.target.value)}
            placeholder="שמות ההורים" className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>גורם שהמליץ</label>
          <input type="text" value={details.referralSource} onChange={(e) => update('referralSource', e.target.value)}
            placeholder="שם ד״ר / מסגרת חינוכית / הורים" className={inputCls} />
        </div>
      </div>

      <p className="mb-2 mt-4 text-xs text-slate-400 font-medium">פרטים קליניים</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>סוג מסגרת</label>
          <select value={details.frameworkType} onChange={(e) => update('frameworkType', e.target.value)}
            className={inputCls}>
            {FRAMEWORK_OPTIONS.map((o) => (
              <option key={o} value={o}>{o || '— לא נבחר —'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>בדיקת שמיעה — תאריך</label>
          <input type="text" value={details.hearingTestDate} onChange={(e) => update('hearingTestDate', e.target.value)}
            placeholder="למשל: 03/2025" className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>בדיקת שמיעה — תוצאה</label>
          <input type="text" value={details.hearingTestResult} onChange={(e) => update('hearingTestResult', e.target.value)}
            placeholder="למשל: תקין / ירידה קלה בתדרים גבוהים" className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <label className={labelCls} style={{ marginBottom: 0 }}>אבחונים נוספים</label>
            <button
              type="button"
              onClick={handleMicToggle}
              disabled={isTranscribing}
              aria-label={isRecording ? 'עצור הקלטה' : 'הקלט ותמלל'}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                isRecording
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : isTranscribing
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                  : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
              }`}
            >
              {isRecording ? (
                <><MicOff className="h-3.5 w-3.5" aria-hidden="true" /> עצור</>
              ) : isTranscribing ? (
                <><Mic className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" /> מתמלל...</>
              ) : (
                <><Mic className="h-3.5 w-3.5" aria-hidden="true" /> הקלטה</>
              )}
            </button>
          </div>
          <textarea value={details.additionalDiagnoses} onChange={(e) => update('additionalDiagnoses', e.target.value)}
            placeholder="למשל: ADHD, ASD, עיכוב שפה..." rows={3}
            className={`${inputCls} resize-none`} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>המלצות למסגרת</label>
          <textarea value={details.frameworkRecommendations} onChange={(e) => update('frameworkRecommendations', e.target.value)}
            placeholder="למשל: המלצה לשילוב עם ליווי צמוד..." rows={2}
            className={`${inputCls} resize-none`} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
        >
          שמירה
        </button>
        {savedAt && (
          <span className="text-sm text-success-700">
            נשמר ✓ {savedAt.getHours().toString().padStart(2, '0')}:{savedAt.getMinutes().toString().padStart(2, '0')}
          </span>
        )}
        <div className="mr-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportWord}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <FileDown className="h-4 w-4" aria-hidden="true" />
            Word
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <FileDown className="h-4 w-4" aria-hidden="true" />
            PDF
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">נשמר רק במכשיר זה, לא נשמר בשרת</p>
    </div>
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
