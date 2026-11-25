import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  History,
  Lock,
  Pencil,
  ShieldAlert,
  TriangleAlert,
  CheckCircle2,
  FilePlus2,
  Sparkles,
  Mic,
  Square,
  Loader2,
} from 'lucide-react'
import { rephraseSection } from '../api/documentGeneration'
import { apiUpload } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useAppView } from '../context/AppViewContext'
import { getPatient } from '../api/patients'
import {
  getDocument,
  updateDocumentSection,
  approveDocument,
  createNewVersion,
  logDocumentExport,
  sectionsToText,
} from '../api/documents'
import { DOCUMENT_TYPE_CONFIG } from '../constants/documentType'
import StatusBadge from '../components/common/StatusBadge'
import { findIdentifyingInfo } from '../utils/privacyGuard'
import { diffAuthorship } from '../utils/textDiff'
import { formatDate } from '../utils/formatDate'
import { downloadDocumentAsWord, printDocumentAsPdf } from '../utils/exportDocument'
import { getLocalPatientName, getLocalPatientDetails } from '../utils/localPatientName'

// מסך עריכה + אישור סופי למסמך — שלב 6.
//
// מה המסך עושה:
//   1. עריכה לפי סעיפים — כל סעיף נפתח לעריכה בנפרד ונשמר בנפרד.
//   2. סימון מקור הטקסט — טקסט של AI (רקע סגול-בהיר) מול טקסט שהקלינאית
//      כתבה/שינתה (רקע צהוב עם קו תחתון). החישוב: השוואת מילים בין aiText
//      (הנוסח המקורי של ה-AI, לא משתנה) לבין text (הנוסח הנוכחי).
//   3. "קראתי ואני מאשרת" → המסמך ננעל. שינוי אחרי אישור = גרסה חדשה,
//      והגרסה המאושרת נשמרת בהיסטוריה (Document.versions).
//   4. אין העתקה/הורדה לפני אישור (הכפתורים מושבתים, ו-Ctrl+C על המסמך נחסם).
//   5. privacyGuard רץ לפני כל שמירת סעיף ולפני אישור: ת.ז/טלפון/אימייל = חסימה,
//      שם פרטי+משפחה = אזהרה ("זה לא שם — לשמור בכל זאת").
//
// הערה: ה-autosave של הגרסה הקודמת הוחלף בשמירה מפורשת לכל סעיף — כדי
// שבדיקת הפרטיות תרוץ *לפני* שהטקסט נשמר ב-localStorage, ולא אחרי.
export default function DocumentEditScreen() {
  const { clinician } = useAuth()
  const { selectedPatientId, selectedDocumentId, backToPatientWorkspace } = useAppView()

  const [patient, setPatient] = useState(null)
  // שם "currentDocument" ולא "document" בכוונה — "document" מסתיר את window.document.
  const [currentDocument, setCurrentDocument] = useState(null)
  const [step, setStep] = useState('loading') // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState(null)

  const [editingKey, setEditingKey] = useState(null)
  const [draftText, setDraftText] = useState('')
  const [sectionIssues, setSectionIssues] = useState(null) // { blocks: [], warns: [] }
  const [justSavedKey, setJustSavedKey] = useState(null)

  // "הצע ניסוח": draftAiText = הניסוח שהקלינאית בחרה (null = לא נבחר).
  // נשמר כ-aiText של הסעיף, כדי שיסומן בסגול והעריכות שלה אחריו בצהוב.
  const [draftAiText, setDraftAiText] = useState(null)
  const [rephrase, setRephrase] = useState(EMPTY_REPHRASE)

  // הקלטה ותמלול ישירות לתוך סעיף בעריכה
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordError, setRecordError] = useState(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  const [confirmedRead, setConfirmedRead] = useState(false)
  const [approveMessage, setApproveMessage] = useState(null)
  const [approveWarnAcked, setApproveWarnAcked] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [justApproved, setJustApproved] = useState(false)

  const [notice, setNotice] = useState(null)
  const [openVersion, setOpenVersion] = useState(null)

  // ---- טעינה ראשונית: מטופל (לכותרת ההקשר) + מסמך ----
  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!selectedPatientId || !selectedDocumentId) {
        setStep('error')
        setLoadError('לא נבחר מסמך לעריכה. חזרי למסך העבודה ובחרי מסמך מההיסטוריה.')
        return
      }
      setStep('loading')
      setLoadError(null)
      try {
        const [loadedPatient, loadedDocument] = await Promise.all([
          getPatient(selectedPatientId),
          getDocument(selectedDocumentId),
        ])
        if (cancelled) return
        if (!loadedDocument) {
          setStep('error')
          setLoadError('המסמך לא נמצא. ייתכן שנמחק. חזרי למסך העבודה.')
          return
        }
        setPatient(loadedPatient)
        setCurrentDocument(loadedDocument)
        setStep('ready')
      } catch (err) {
        if (cancelled) return
        console.error('kai: failed to load document for editing', err)
        setStep('error')
        setLoadError('אירעה שגיאה בטעינת המסמך. נסי שוב.')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [selectedPatientId, selectedDocumentId])

  // הודעה קצרה שנעלמת לבד
  useEffect(() => {
    if (!notice) return undefined
    const t = setTimeout(() => setNotice(null), 2500)
    return () => clearTimeout(t)
  }, [notice])

  const locked = Boolean(currentDocument?.locked)

  // ---- עריכת סעיף ----
  function startEdit(section) {
    if (locked) return
    setEditingKey(section.key)
    setDraftText(section.text)
    setSectionIssues(null)
    setJustSavedKey(null)
    setDraftAiText(null)
    setRephrase(EMPTY_REPHRASE)
  }

  function cancelEdit() {
    if (isRecording) {
      try {
        mediaRecorderRef.current?.stop()
      } catch {}
      setIsRecording(false)
    }
    setEditingKey(null)
    setDraftText('')
    setSectionIssues(null)
    setDraftAiText(null)
    setRephrase(EMPTY_REPHRASE)
    setRecordError(null)
  }

  async function handleStartSectionRecording() {
    setRecordError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const mime = mediaRecorder.mimeType || 'audio/webm'
        const audioBlob = new Blob(audioChunksRef.current, { type: mime })
        if (audioBlob.size === 0) {
          setRecordError('לא נקלט קול מהמיקרופון. בדקי שהמיקרופון מחובר ולא מושתק.')
          return
        }
        const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'
        setIsTranscribing(true)
        try {
          const formData = new FormData()
          formData.append('file', audioBlob, `section-edit.${ext}`)
          const { transcript } = await apiUpload('/transcribe', formData)
          if (transcript) {
            setDraftText((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript))
            setSectionIssues(null)
          }
        } catch (err) {
          console.error('kai: section transcription failed', err)
          setRecordError('התמלול נכשל. נסי שוב או הקלידי ידנית.')
        } finally {
          setIsTranscribing(false)
        }
      }

      mediaRecorder.start(250)
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
    } catch (err) {
      console.error('kai: microphone access failed in section edit', err)
      setRecordError('לא ניתן לגשת למיקרופון. בדקי הרשאות בדפדפן.')
    }
  }

  function handleStopSectionRecording() {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  // ---- "הצע ניסוח" ----
  // בדיקת המזהים רצה לפני השליחה: חוסם = לא נשלח בכלל; שם אפשרי = נשלח
  // רק אחרי שהקלינאית אישרה "זה לא שם".
  async function requestRephrase(ignoreWarnings = false) {
    const text = draftText.trim()
    if (!text) return
    const issues = findIdentifyingInfo(text)
    const blocks = issues.filter((i) => i.level === 'block')
    const warns = issues.filter((i) => i.level === 'warn')
    if (blocks.length > 0 || (warns.length > 0 && !ignoreWarnings)) {
      setRephrase({ ...EMPTY_REPHRASE, issues: { blocks, warns } })
      return
    }

    const sectionLabel = currentDocument.sections.find((s) => s.key === editingKey)?.label
    setRephrase({ ...EMPTY_REPHRASE, status: 'loading' })
    try {
      const suggestions = await rephraseSection(text, sectionLabel)
      setRephrase(
        suggestions.length > 0
          ? { ...EMPTY_REPHRASE, status: 'ready', suggestions }
          : { ...EMPTY_REPHRASE, status: 'error', error: 'לא התקבלו הצעות. נסי שוב.' },
      )
    } catch (err) {
      console.error('kai: section rephrase failed', err)
      setRephrase({ ...EMPTY_REPHRASE, status: 'error', error: 'הצעת הניסוח נכשלה. נסי שוב.' })
    }
  }

  function pickSuggestion(suggestion) {
    setDraftText(suggestion)
    setDraftAiText(suggestion)
    setSectionIssues(null)
  }

  async function saveSection(ignoreWarnings = false) {
    const issues = findIdentifyingInfo(draftText)
    const blocks = issues.filter((i) => i.level === 'block')
    const warns = issues.filter((i) => i.level === 'warn')
    if (blocks.length > 0 || (warns.length > 0 && !ignoreWarnings)) {
      setSectionIssues({ blocks, warns })
      return
    }
    try {
      const updated = await updateDocumentSection(
        currentDocument.id,
        editingKey,
        draftText,
        clinician.id,
        draftAiText !== null ? { aiText: draftAiText } : {},
      )
      setCurrentDocument(updated)
      setJustSavedKey(editingKey)
      cancelEdit()
      setConfirmedRead(false) // שינוי בטקסט = צריך לקרוא שוב לפני אישור
    } catch (err) {
      console.error('kai: failed to save section', err)
      setSectionIssues({ blocks: [{ reason: 'השמירה נכשלה. נסי שוב.', match: '' }], warns: [] })
    }
  }

  // ---- אישור ונעילה ----
  async function handleApprove() {
    if (!confirmedRead) {
      setApproveMessage('יש לסמן "קראתי ואני מאשרת" לפני האישור.')
      return
    }
    if (editingKey) {
      setApproveMessage('יש סעיף פתוח לעריכה. שמרי או בטלי אותו קודם.')
      return
    }
    // בדיקת פרטיות על המסמך כולו (גם טקסט ה-AI)
    const all = currentDocument.sections.flatMap((s) =>
      findIdentifyingInfo(s.text).map((i) => ({ ...i, section: s.label })),
    )
    const blocks = all.filter((i) => i.level === 'block')
    const warns = all.filter((i) => i.level === 'warn')
    if (blocks.length > 0) {
      setApproveMessage(`לא ניתן לאשר: ${blocks[0].reason} בסעיף "${blocks[0].section}". ערכי את הסעיף והסירי אותו.`)
      return
    }
    if (warns.length > 0 && !approveWarnAcked) {
      setApproveWarnAcked(true)
      setApproveMessage(`שימי לב: "${warns[0].match}" בסעיף "${warns[0].section}" נראה כמו שם. אם זה לא שם — לחצי שוב על אישור.`)
      return
    }

    setApproveMessage(null)
    setIsApproving(true)
    try {
      const approved = await approveDocument(currentDocument.id, clinician.id)
      setCurrentDocument(approved)
      setJustApproved(true)
      setJustSavedKey(null)
      setConfirmedRead(false)
      setApproveWarnAcked(false)
    } catch (err) {
      console.error('kai: failed to approve document', err)
      setApproveMessage('אישור המסמך נכשל. נסי שוב.')
    } finally {
      setIsApproving(false)
    }
  }

  async function handleNewVersion() {
    try {
      const next = await createNewVersion(currentDocument.id, clinician.id)
      setCurrentDocument(next)
      setJustApproved(false)
      setNotice(`נפתחה גרסה ${next.version} לעריכה. הגרסה המאושרת נשמרה בהיסטוריה.`)
    } catch (err) {
      console.error('kai: failed to create new version', err)
      setNotice('פתיחת גרסה חדשה נכשלה. נסי שוב.')
    }
  }

  // ---- העתקה / הורדה — רק אחרי אישור ----
  function exportText() {
    const header = `${DOCUMENT_TYPE_CONFIG[currentDocument.documentType]?.label ?? ''} · ${patient?.displayCode ?? ''} · גרסה ${currentDocument.version} · אושר ${formatDate(currentDocument.approvedAt)}`
    return `${header}\n\n${sectionsToText(currentDocument.sections)}`
  }

  async function handleCopy() {
    if (!locked) return
    try {
      await navigator.clipboard.writeText(exportText())
      await logDocumentExport(currentDocument.id, clinician.id)
      setNotice('המסמך הועתק')
    } catch (err) {
      console.warn('kai: clipboard API unavailable', err)
      setNotice('ההעתקה לא זמינה בדפדפן הזה')
    }
  }

  async function handleDownloadWord() {
    downloadDocumentAsWord({
      doc: currentDocument,
      patient,
      clinicianName: clinician?.displayName || '',
      licenseNumber: clinician?.licenseNumber || '',
      localPatientName: getLocalPatientName(patient?.displayCode),
      localDetails: getLocalPatientDetails(patient?.displayCode),
    })
    await logDocumentExport(currentDocument.id, clinician.id)
    setNotice('קובץ Word הורד בהצלחה')
  }

  async function handlePrintPdf() {
    try {
      printDocumentAsPdf({
        doc: currentDocument,
        patient,
        clinicianName: clinician?.displayName || '',
        licenseNumber: clinician?.licenseNumber || '',
        localPatientName: getLocalPatientName(patient?.displayCode),
        localDetails: getLocalPatientDetails(patient?.displayCode),
      })
      await logDocumentExport(currentDocument.id, clinician.id)
    } catch (err) {
      setNotice(err?.message || 'לא ניתן לפתוח תצוגת PDF')
    }
  }

  // חסימת Ctrl+C / גזירה מהמסמך לפני אישור
  function blockCopyBeforeApproval(e) {
    if (locked) return
    e.preventDefault()
    setNotice('אפשר להעתיק רק אחרי אישור המסמך')
  }

  // ---- רינדור ----

  if (step === 'loading') {
    return (
      <div className="space-y-6">
        <BackLink onClick={backToPatientWorkspace} label="חזרה למטופל" />
        <div className="h-12 animate-pulse rounded-xl border border-slate-200 bg-slate-100" aria-hidden="true" />
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100" aria-hidden="true" />
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="space-y-4">
        <BackLink onClick={backToPatientWorkspace} label="חזרה למטופל" />
        <ErrorCard message={loadError} />
      </div>
    )
  }

  const pastVersions = (currentDocument.versions ?? []).filter(
    (v) => !(locked && v.version === currentDocument.version),
  )

  return (
    <div className="space-y-6">
      <BackLink onClick={backToPatientWorkspace} label="חזרה למטופל" />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-bold text-brand-700">
          {patient?.displayCode ?? '—'}
        </span>
        <span className="text-sm text-slate-500">
          {DOCUMENT_TYPE_CONFIG[currentDocument.documentType]?.label ?? currentDocument.documentType}
        </span>
        <StatusBadge status={currentDocument.status} />
        <span className="text-xs text-slate-400">גרסה {currentDocument.version}</span>
        {locked && (
          <span className="flex items-center gap-1 text-xs font-medium text-success-700">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            נעול
          </span>
        )}
      </div>

      {locked && (
        <section
          aria-label="המסמך אושר"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success-100 bg-success-50 px-4 py-3"
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-success-700">
                {justApproved ? 'המסמך אושר וננעל' : 'מסמך מאושר ונעול'}
              </p>
              <p className="text-xs text-slate-600">
                אושר ב-{formatDate(currentDocument.approvedAt)}. כדי לשנות — פותחים גרסה חדשה, והגרסה הזו נשמרת.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleNewVersion}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            יצירת גרסה חדשה
          </button>
        </section>
      )}

      <div>
        <h1 className="text-lg font-bold text-slate-900">{locked ? 'המסמך' : 'עריכה ואישור'}</h1>
        {!locked && (
          <p className="mt-1 text-sm text-slate-500">לחצי על "עריכה" בכל סעיף. בסוף — קראי ואשרי.</p>
        )}
        <Legend />
      </div>

      <div className="space-y-3" onCopy={blockCopyBeforeApproval} onCut={blockCopyBeforeApproval}>
        {currentDocument.sections.map((section) => (
          <SectionCard
            key={section.key}
            section={section}
            locked={locked}
            isEditing={editingKey === section.key}
            otherEditing={Boolean(editingKey) && editingKey !== section.key}
            justSaved={justSavedKey === section.key}
            draftText={draftText}
            onDraftChange={(v) => {
              setDraftText(v)
              setSectionIssues(null)
              if (rephrase.issues) setRephrase(EMPTY_REPHRASE)
            }}
            draftAiText={draftAiText}
            rephrase={rephrase}
            onRephrase={() => requestRephrase(false)}
            onRephraseAnyway={() => requestRephrase(true)}
            onPickSuggestion={pickSuggestion}
            isRecording={editingKey === section.key && isRecording}
            isTranscribing={editingKey === section.key && isTranscribing}
            recordError={editingKey === section.key ? recordError : null}
            onStartRecording={handleStartSectionRecording}
            onStopRecording={handleStopSectionRecording}
            issues={editingKey === section.key ? sectionIssues : null}
            onEdit={() => startEdit(section)}
            onSave={() => saveSection(false)}
            onSaveAnyway={() => saveSection(true)}
            onCancel={cancelEdit}
          />
        ))}
      </div>

      {!locked && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white px-4 py-4">
          <label className="flex items-start gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={confirmedRead}
              onChange={(e) => {
                setConfirmedRead(e.target.checked)
                if (e.target.checked) setApproveMessage(null)
              }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              <span className="font-bold">קראתי ואני מאשרת</span>
              <span className="mt-0.5 flex items-start gap-1.5 text-xs text-slate-500">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-caution-600" aria-hidden="true" />
                אין במסמך פרטים מזהים. אחרי האישור המסמך ננעל, ושינוי ייצור גרסה חדשה.
              </span>
            </span>
          </label>

          {approveMessage && (
            <p role="alert" className="flex items-start gap-1 text-xs text-red-600">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {approveMessage}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleApprove}
              disabled={!confirmedRead || isApproving || Boolean(editingKey)}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              {isApproving ? 'מאשרת…' : 'אישור ונעילה'}
            </button>
          </div>
        </div>
      )}

      <ExportBar locked={locked} onCopy={handleCopy} onDownloadWord={handleDownloadWord} onPrintPdf={handlePrintPdf} />

      {pastVersions.length > 0 && (
        <section aria-label="היסטוריית גרסאות" className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
            <History className="h-4 w-4" aria-hidden="true" />
            גרסאות מאושרות קודמות
          </h2>
          {pastVersions
            .slice()
            .reverse()
            .map((v) => (
              <div key={v.version} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setOpenVersion(openVersion === v.version ? null : v.version)}
                  className="flex w-full items-center justify-between text-sm text-slate-700"
                >
                  <span>
                    גרסה {v.version} · אושרה {formatDate(v.approvedAt)}
                  </span>
                  <span className="text-xs text-brand-700">{openVersion === v.version ? 'הסתרה' : 'הצגה'}</span>
                </button>
                {openVersion === v.version && (
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
                    {v.finalText}
                  </pre>
                )}
              </div>
            ))}
        </section>
      )}

      {notice && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
        >
          {notice}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// רכיבי משנה
// ============================================================================

const EMPTY_REPHRASE = { status: 'idle', suggestions: [], issues: null, error: null }

function Legend() {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-5 rounded-sm bg-brand-100" aria-hidden="true" />
        נכתב ע"י AI
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-5 rounded-sm border-b-2 border-caution-500 bg-caution-100" aria-hidden="true" />
        נכתב או נערך על ידך
      </span>
    </div>
  )
}

function SectionCard({
  section,
  locked,
  isEditing,
  otherEditing,
  justSaved,
  draftText,
  onDraftChange,
  draftAiText,
  rephrase,
  onRephrase,
  onRephraseAnyway,
  onPickSuggestion,
  isRecording,
  isTranscribing,
  recordError,
  onStartRecording,
  onStopRecording,
  issues,
  onEdit,
  onSave,
  onSaveAnyway,
  onCancel,
}) {
  const authorship = sectionAuthorship(section)

  return (
    <div
      className={`rounded-xl border bg-white px-4 py-3 ${isEditing ? 'border-brand-300 ring-1 ring-brand-200' : 'border-slate-200'}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-700">{section.label}</h3>
          <AuthorshipBadge kind={authorship} />
          {justSaved && (
            <span className="flex items-center gap-1 text-xs text-success-700">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              נשמר
            </span>
          )}
        </div>
        {!locked && !isEditing && (
          <button
            type="button"
            onClick={onEdit}
            disabled={otherEditing}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            עריכה
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          {draftAiText !== null && (
            <p className="flex items-center gap-1.5 text-xs text-brand-700">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {draftText === draftAiText
                ? 'ניסוח של AI — קראי ובדקי לפני השמירה.'
                : 'ניסוח של AI עם עריכה שלך — השינויים שלך יסומנו בצהוב אחרי השמירה.'}
            </p>
          )}
          <textarea
            rows={Math.min(14, Math.max(4, draftText.split('\n').length + 1))}
            value={draftText}
            onChange={(e) => onDraftChange(e.target.value)}
            autoFocus
            className={`w-full resize-y rounded-lg border px-3 py-2 text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${
              draftAiText !== null && draftText === draftAiText
                ? 'border-brand-200 bg-brand-50'
                : 'border-slate-300'
            }`}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={isRecording ? onStopRecording : onStartRecording}
              disabled={isTranscribing}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isRecording
                  ? 'border-red-400 bg-red-50 text-red-700 hover:bg-red-100'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isRecording ? (
                <Square className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {isRecording ? 'עצור הקלטה' : 'הקלטת תוספת'}
            </button>
            {isTranscribing && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                מתמללת…
              </span>
            )}
          </div>
          {recordError && (
            <p className="flex items-start gap-1 text-xs text-red-600">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {recordError}
            </p>
          )}

          <RephrasePanel
            rephrase={rephrase}
            draftText={draftText}
            draftAiText={draftAiText}
            onRephrase={onRephrase}
            onRephraseAnyway={onRephraseAnyway}
            onPick={onPickSuggestion}
          />

          {issues?.blocks?.length > 0 && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <p className="flex items-start gap-1 font-bold">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                לא נשמר — יש כאן פרט מזהה:
              </p>
              <ul className="ms-5 mt-1 list-disc">
                {issues.blocks.map((i, idx) => (
                  <li key={idx}>
                    {i.reason}
                    {i.match && <> ("{i.match}")</>}
                  </li>
                ))}
              </ul>
              <p className="mt-1">מחקי אותו ונסי שוב.</p>
            </div>
          )}

          {!issues?.blocks?.length && issues?.warns?.length > 0 && (
            <div role="alert" className="rounded-lg border border-caution-200 bg-caution-50 px-3 py-2 text-xs text-caution-700">
              <p className="flex items-start gap-1 font-bold">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                נראה כמו שם: "{issues.warns[0].match}"
              </p>
              <p className="mt-1">אם זה שם — מחקי אותו. אם לא —</p>
              <button
                type="button"
                onClick={onSaveAnyway}
                className="mt-1 rounded-md border border-caution-500 bg-white px-2 py-0.5 font-medium text-caution-700 hover:bg-caution-100"
              >
                זה לא שם, לשמור
              </button>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={onSave}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              שמירת סעיף
            </button>
          </div>
        </div>
      ) : (
        <AuthoredText aiText={section.aiText} text={section.text} />
      )}
    </div>
  )
}

// כפתור "הצע ניסוח" + 3 ההצעות. לחיצה על הצעה מכניסה אותה לתיבה.
function RephrasePanel({ rephrase, draftText, draftAiText, onRephrase, onRephraseAnyway, onPick }) {
  const { status, suggestions, issues, error } = rephrase
  const loading = status === 'loading'

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onRephrase}
        disabled={loading || !draftText.trim()}
        className="flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        {loading ? 'מכינה הצעות…' : status === 'ready' ? 'הצעות נוספות' : 'הצע ניסוח'}
      </button>

      {issues?.blocks?.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <p className="flex items-start gap-1 font-bold">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            לא נשלח — יש כאן פרט מזהה:
          </p>
          <ul className="ms-5 mt-1 list-disc">
            {issues.blocks.map((i, idx) => (
              <li key={idx}>
                {i.reason}
                {i.match && <> ("{i.match}")</>}
              </li>
            ))}
          </ul>
          <p className="mt-1">מחקי אותו ונסי שוב.</p>
        </div>
      )}

      {!issues?.blocks?.length && issues?.warns?.length > 0 && (
        <div role="alert" className="rounded-lg border border-caution-200 bg-caution-50 px-3 py-2 text-xs text-caution-700">
          <p className="flex items-start gap-1 font-bold">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            לפני השליחה: "{issues.warns[0].match}" נראה כמו שם
          </p>
          <p className="mt-1">אם זה שם — מחקי אותו. אם לא —</p>
          <button
            type="button"
            onClick={onRephraseAnyway}
            className="mt-1 rounded-md border border-caution-500 bg-white px-2 py-0.5 font-medium text-caution-700 hover:bg-caution-100"
          >
            זה לא שם, לשלוח
          </button>
        </div>
      )}

      {status === 'error' && (
        <p role="alert" className="flex items-start gap-1 text-xs text-red-600">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {status === 'ready' && (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500">לחצי על ניסוח כדי להכניס אותו לתיבה:</p>
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onPick(s)}
              className={`block w-full rounded-lg border px-3 py-2 text-start text-sm leading-relaxed text-slate-800 transition-colors hover:border-brand-300 hover:bg-brand-100 ${
                draftAiText === s ? 'border-brand-500 bg-brand-100' : 'border-brand-200 bg-brand-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function sectionAuthorship(section) {
  if (!section.aiText?.trim()) return 'clinician'
  if (section.text === section.aiText) return 'ai'
  return 'mixed'
}

function AuthorshipBadge({ kind }) {
  const map = {
    ai: { label: 'AI', cls: 'bg-brand-50 text-brand-700' },
    mixed: { label: 'AI + עריכה שלך', cls: 'bg-caution-50 text-caution-700' },
    clinician: { label: 'נכתב על ידך', cls: 'bg-caution-50 text-caution-700' },
  }
  const { label, cls } = map[kind]
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>
}

// מציג את הטקסט עם סימון: קטעים שזהים לנוסח ה-AI מול קטעים שהקלינאית הוסיפה/שינתה.
function AuthoredText({ aiText, text }) {
  if (!text?.trim()) {
    return <p className="text-sm italic text-slate-400">(ריק)</p>
  }
  const segments = diffAuthorship(aiText ?? '', text)
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
      {segments.map((seg, idx) =>
        seg.source === 'ai' ? (
          <span key={idx} className="rounded-sm bg-brand-50 box-decoration-clone">
            {seg.text}
          </span>
        ) : (
          <span
            key={idx}
            className="rounded-sm bg-caution-100 underline decoration-caution-500 decoration-2 underline-offset-4 box-decoration-clone"
          >
            {seg.text}
          </span>
        ),
      )}
    </p>
  )
}

function ExportBar({ locked, onCopy, onDownloadWord, onPrintPdf }) {
  const btn =
    'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-500">
        {locked
          ? 'המסמך מאושר — אפשר להעתיק, להוריד ל-Word או לשמור כ-PDF.'
          : 'ניתן להוריד ל-Word או לשמור כ-PDF בכל שלב. העתקה זמינה אחרי אישור.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCopy}
          disabled={!locked}
          title={locked ? '' : 'זמין אחרי אישור'}
          className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300`}
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          העתקה
        </button>
        <button
          type="button"
          onClick={onDownloadWord}
          className={`${btn} border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100`}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          הורדה ל-Word
        </button>
        <button
          type="button"
          onClick={onPrintPdf}
          className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          שמירה כ-PDF
        </button>
      </div>
    </div>
  )
}

function BackLink({ onClick, label }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 bg-white px-4 pb-3 pt-2 shadow-sm">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-base font-semibold text-white shadow transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 sm:w-auto sm:justify-start"
      >
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
        {label}
      </button>
    </div>
  )
}

function ErrorCard({ message }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}
