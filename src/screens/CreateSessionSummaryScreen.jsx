import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  Sparkles,
  ShieldAlert,
  TriangleAlert,
  RotateCcw,
  Save,
  Mic,
  Square,
  Loader2,
  Upload,
  CheckSquare,
  Square as EmptySquare,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppView } from '../context/AppViewContext'
import { getPatient } from '../api/patients'
import { createSession } from '../api/sessions'
import { createDocument } from '../api/documents'
import { apiUpload } from '../api/client'
import { DOCUMENT_TYPE } from '../constants/documentType'
import {
  generateTreatmentSummary,
  formatSummaryAsText,
  summaryToSections,
} from '../api/documentGeneration'
import { checkForIdentifyingInfo, findIdentifyingInfo } from '../utils/privacyGuard'
import { formatDate } from '../utils/formatDate'

const CHECKLIST_ITEMS = [
  { key: 'observed', label: 'מה נצפה אצל המטופל/ת' },
  { key: 'actions', label: 'אילו פעולות ותרגולים בוצעו' },
  { key: 'response', label: 'איך המטופל/ת הגיב/ה' },
  { key: 'goals', label: 'מה המטרות להמשך' },
]

export default function CreateSessionSummaryScreen() {
  const { clinician } = useAuth()
  const { selectedPatientId, backToPatientWorkspace, openDocumentEdit } = useAppView()

  const [patient, setPatient] = useState(null)
  const [isLoadingPatient, setIsLoadingPatient] = useState(true)
  const [patientLoadError, setPatientLoadError] = useState(null)

  const [step, setStep] = useState('input') // 'input' | 'draft' | 'saved'

  const [sessionDate, setSessionDate] = useState(() => todayIsoDate())
  const [sourceText, setSourceText] = useState('')
  const [checkedPoints, setCheckedPoints] = useState({})
  const [formErrors, setFormErrors] = useState({})

  const [draftSummary, setDraftSummary] = useState(null)
  const [savedDocumentId, setSavedDocumentId] = useState(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [nameWarning, setNameWarning] = useState(null)

  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordError, setRecordError] = useState(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  const isAudioBusy = isRecording || isTranscribing

  useEffect(() => {
    let cancelled = false
    async function loadPatient() {
      if (!selectedPatientId) {
        setIsLoadingPatient(false)
        return
      }
      setIsLoadingPatient(true)
      setPatientLoadError(null)
      try {
        const result = await getPatient(selectedPatientId)
        if (cancelled) return
        setPatient(result)
      } catch (err) {
        if (cancelled) return
        console.error('kai: failed to load patient in create-session-summary', err)
        setPatientLoadError('אירעה שגיאה בטעינת פרטי המטופל. חזרי למסך העבודה ונסי שוב.')
      } finally {
        if (!cancelled) setIsLoadingPatient(false)
      }
    }
    loadPatient()
    return () => {
      cancelled = true
    }
  }, [selectedPatientId])

  function validateInput() {
    const errors = {}
    if (!sessionDate) {
      errors.sessionDate = 'נא לבחור תאריך מפגש'
    } else if (sessionDate > todayIsoDate()) {
      errors.sessionDate = 'תאריך המפגש לא יכול להיות בעתיד'
    }
    if (!sourceText.trim()) {
      errors.sourceText = 'נא להקליט או להזין תיאור של מה שקרה במפגש'
    } else {
      const privacyCheck = checkForIdentifyingInfo(sourceText)
      if (privacyCheck.flagged) {
        errors.sourceText = `⚠ ${privacyCheck.reason}. אנא הסירי כל פרט מזהה לפני המשך.`
      }
    }
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return false

    const names = findIdentifyingInfo(sourceText).filter((i) => i.level === 'warn')
    if (names.length > 0 && nameWarning !== sourceText) {
      setNameWarning(sourceText)
      setFormErrors({
        sourceText: `⚠ נראה שיש כאן שם: "${names[0].match}". אם זה שם — מחקי אותו. אם לא — לחצי שוב כדי להמשיך.`,
      })
      return false
    }
    return true
  }

  async function handleGenerate() {
    if (!validateInput()) return
    setIsGenerating(true)
    try {
      const summary = await generateTreatmentSummary(sourceText)
      setDraftSummary(summary)
      setStep('draft')
    } catch (err) {
      console.error('kai: generation failed', err)
      setFormErrors({
        sourceText: 'שגיאה ביצירת הטיוטה. נסי שוב או פני לצוות התמיכה.',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleStartRecording() {
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
        await transcribeAndAppend(audioBlob, `recording.${ext}`)
      }

      mediaRecorder.start(250)
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
    } catch (err) {
      console.error('kai: microphone access failed', err)
      setRecordError('לא ניתן לגשת למיקרופון. ייתכן שההרשאה נדחתה או שהדפדפן/הרשת חוסמים גישה.')
    }
  }

  function handleStopRecording() {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  async function handleUploadAudioFile(file) {
    if (!file) return
    setRecordError(null)

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!AUDIO_UPLOAD_EXTENSIONS.includes(extension)) {
      setRecordError('סוג הקובץ לא נתמך. ניתן להעלות קבצי mp3, m4a, ogg, wav או webm.')
      return
    }
    if (file.size > AUDIO_UPLOAD_MAX_BYTES) {
      setRecordError('הקובץ גדול מדי. הגודל המקסימלי הוא 25MB.')
      return
    }
    await transcribeAndAppend(file, file.name)
  }

  async function transcribeAndAppend(audio, filename) {
    setIsTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('file', audio, filename)
      const { transcript, _mock } = await apiUpload('/transcribe', formData)

      setSourceText((prev) => (prev ? `${prev}\n\n${transcript}` : transcript))
      if (formErrors.sourceText) {
        setFormErrors((prev) => ({ ...prev, sourceText: null }))
      }
      if (_mock) {
        setRecordError('⚠ זהו תמלול לדוגמה (mock), לא תמלול אמיתי — בדקי את הגדרות ה-Backend.')
      }
    } catch (err) {
      console.error('kai: transcription failed', err)
      setRecordError('התמלול נכשל. נסי שוב, או הקלידי את הטקסט ידנית.')
    } finally {
      setIsTranscribing(false)
    }
  }

  function toggleChecklistPoint(key) {
    setCheckedPoints((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleBackToEdit() {
    setStep('input')
  }

  function handleReset() {
    setSourceText('')
    setCheckedPoints({})
    setSessionDate(todayIsoDate())
    setDraftSummary(null)
    setSavedDocumentId(null)
    setFormErrors({})
    setSaveError(null)
    setRecordError(null)
    setStep('input')
  }

  async function handleSaveDraft() {
    if (!draftSummary || !selectedPatientId) return
    setIsSaving(true)
    setSaveError(null)

    const MAX_SOURCE_CHARS = 2000
    const savedSourceText =
      sourceText.length > MAX_SOURCE_CHARS
        ? sourceText.slice(0, MAX_SOURCE_CHARS) + '\n[... קוצר לאחסון]'
        : sourceText

    const generatedText = formatSummaryAsText(draftSummary)

    try {
      const session = await createSession(
        {
          patientId: selectedPatientId,
          sessionDate,
          inputMethod: 'typed',
          sourceText: savedSourceText,
        },
        clinician.id,
      )

      const savedDocument = await createDocument(
        {
          patientId: selectedPatientId,
          documentType: DOCUMENT_TYPE.SESSION_SUMMARY,
          sessionId: session.id,
          sourceText: null,
          generatedText,
          sections: summaryToSections(draftSummary),
          validationResult: draftSummary.validation ?? null,
        },
        clinician.id,
      )

      setSavedDocumentId(savedDocument.id)
      setStep('saved')
    } catch (err) {
      console.error('kai: failed to save session summary draft', err)
      setSaveError(`שמירת הטיוטה נכשלה (${err?.message ?? 'שגיאה לא ידועה'}). נסי שוב.`)
    } finally {
      setIsSaving(false)
    }
  }

  if (!selectedPatientId) {
    return (
      <div className="space-y-4">
        <BackLink onClick={backToPatientWorkspace} label="חזרה" />
        <ErrorCard message="לא נבחר מטופל. חזרי למסך המטופלים ובחרי מטופל." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <BackLink
        onClick={backToPatientWorkspace}
        label={step === 'saved' ? 'חזרה למסך העבודה' : 'חזרה למסך העבודה של המטופל'}
      />

      <PatientContextBar
        patient={patient}
        isLoading={isLoadingPatient}
        loadError={patientLoadError}
      />

      {step === 'input' && (
        <InputStep
          sessionDate={sessionDate}
          onSessionDateChange={setSessionDate}
          sourceText={sourceText}
          onSourceTextChange={(val) => {
            setSourceText(val)
            if (formErrors.sourceText) setFormErrors((prev) => ({ ...prev, sourceText: null }))
          }}
          checkedPoints={checkedPoints}
          onToggleChecklistPoint={toggleChecklistPoint}
          formErrors={formErrors}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          isAudioBusy={isAudioBusy}
          recordError={recordError}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onUploadAudioFile={handleUploadAudioFile}
        />
      )}

      {step === 'draft' && draftSummary && (
        <DraftStep
          summary={draftSummary}
          sessionDate={sessionDate}
          onBackToEdit={handleBackToEdit}
          onReset={handleReset}
          onSave={handleSaveDraft}
          isSaving={isSaving}
          saveError={saveError}
        />
      )}

      {step === 'saved' && (
        <SavedStep
          onBackToWorkspace={backToPatientWorkspace}
          onCreateAnother={handleReset}
          onEditNow={() => openDocumentEdit(savedDocumentId)}
        />
      )}
    </div>
  )
}

function BackLink({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
    >
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  )
}

function PatientContextBar({ patient, isLoading, loadError }) {
  if (isLoading) {
    return (
      <div
        className="h-12 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
        aria-hidden="true"
      />
    )
  }
  if (loadError) return <ErrorCard message={loadError} />
  if (!patient) return <ErrorCard message="פרטי המטופל לא נמצאו." />
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-bold text-brand-700">
        {patient.displayCode}
      </span>
      <span className="text-sm text-slate-500">
        {patient.ageRange} · {patient.treatmentArea}
      </span>
    </div>
  )
}

function InputStep({
  sessionDate,
  onSessionDateChange,
  sourceText,
  onSourceTextChange,
  checkedPoints,
  onToggleChecklistPoint,
  formErrors,
  onGenerate,
  isGenerating,
  isRecording,
  isTranscribing,
  isAudioBusy,
  recordError,
  onStartRecording,
  onStopRecording,
  onUploadAudioFile,
}) {
  const audioFileInputRef = useRef(null)

  return (
    <section aria-label="הזנת תיאור המפגש" className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">סיכום מפגש טיפולי חדש</h1>
        <p className="mt-1 text-sm text-slate-500">
          הקליטי בחופשיות או הקלידי מה קרה במפגש — K.ai יסדר את הכל אוטומטית לטיוטת סיכום מובנית ב-6 סעיפים.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-caution-500 bg-caution-50 px-3 py-2.5 text-sm text-caution-700">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="font-medium">
          אין להזין שמות, ת.ז, מספרי טלפון או כל פרט מזהה אחר בטקסט המפגש.
        </p>
      </div>

      <div>
        <label htmlFor="sessionDate" className="mb-1 block text-sm font-medium text-slate-700">
          תאריך המפגש <span className="text-red-500">*</span>
        </label>
        <input
          id="sessionDate"
          type="date"
          value={sessionDate}
          onChange={(e) => onSessionDateChange(e.target.value)}
          max={todayIsoDate()}
          className={`w-full max-w-xs rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
            formErrors.sessionDate
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
              : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'
          }`}
        />
        {formErrors.sessionDate && (
          <p className="mt-1 flex items-start gap-1 text-xs text-red-600">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {formErrors.sessionDate}
          </p>
        )}
      </div>

      {/* פריסה דו-עמודתית: הקלטה + טקסט מימין, וצ'ק-ליסט תזכורת בצד משמאל */}
      <div className="grid gap-5 lg:grid-cols-[1fr_270px] lg:items-start">
        <div className="space-y-4">
          {/* כרטיס הקלטה מרכזי */}
          <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-6 text-center">
            <button
              type="button"
              onClick={isRecording ? onStopRecording : onStartRecording}
              disabled={!isRecording && isAudioBusy}
              aria-label={isRecording ? 'עצור הקלטה' : 'התחלת הקלטה מהמיקרופון'}
              className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                isRecording
                  ? 'animate-pulse bg-red-600 hover:bg-red-700'
                  : 'bg-brand-600 hover:bg-brand-700'
              }`}
            >
              {isRecording ? (
                <Square className="h-8 w-8" aria-hidden="true" />
              ) : (
                <Mic className="h-8 w-8" aria-hidden="true" />
              )}
            </button>

            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700">
                {isRecording
                  ? 'מקליטה… לחצי שוב לעצירה ותמלול'
                  : isTranscribing
                    ? 'מתמללת את ההקלטה…'
                    : 'לחצי להקלטה חופשית של המפגש'}
              </p>
              {isTranscribing && (
                <span className="inline-flex items-center gap-1.5 text-xs text-brand-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  מעבדת שמע…
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => audioFileInputRef.current?.click()}
              disabled={isAudioBusy}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              או העלאת קובץ שמע
            </button>
            <input
              ref={audioFileInputRef}
              type="file"
              accept={AUDIO_UPLOAD_EXTENSIONS.map((ext) => `.${ext}`).join(',')}
              className="hidden"
              onChange={(e) => {
                onUploadAudioFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />

            {recordError && (
              <p className="flex items-start gap-1 text-xs text-red-600">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {recordError}
              </p>
            )}
          </div>

          {/* טקסט המפגש (מתמלא מהתמלול, פתוח תמיד לעריכה או להקלדה ישירה) */}
          <div>
            <label htmlFor="sourceText" className="mb-1 block text-sm font-medium text-slate-700">
              תיאור המפגש <span className="text-red-500">*</span>
            </label>
            <textarea
              id="sourceText"
              rows={8}
              value={sourceText}
              onChange={(e) => onSourceTextChange(e.target.value)}
              placeholder="התמלול יופיע כאן אוטומטית (אפשר גם להקליד או להוסיף הקלטה נוספת)..."
              className={`w-full resize-y rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                formErrors.sourceText
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'
              }`}
            />
            {formErrors.sourceText ? (
              <p className="mt-1 flex items-start gap-1 text-xs text-red-600">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {formErrors.sourceText}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">{sourceText.length} תווים</p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onGenerate}
              disabled={isGenerating || isAudioBusy}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {isGenerating ? 'מייצרת טיוטה…' : 'צור/י טיוטת סיכום'}
            </button>
          </div>
        </div>

        {/* צ'ק-ליסט בצד — תזכורת נוחה בזמן ההקלטה כדי שלא יישכח כלום */}
        <aside
          aria-label="נקודות שכדאי להזכיר"
          className="rounded-xl border border-brand-200 bg-brand-50/50 p-4"
        >
          <h2 className="text-sm font-bold text-brand-800">נקודות שכדאי להזכיר</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            אפשר לסמן תוך כדי דיבור — לא חובה לענות על הכל.
          </p>
          <ul className="mt-3 space-y-2">
            {CHECKLIST_ITEMS.map((item) => {
              const checked = Boolean(checkedPoints[item.key])
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => onToggleChecklistPoint(item.key)}
                    className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-start text-xs font-medium transition-colors ${
                      checked
                        ? 'border-success-200 bg-success-50 text-success-700 line-through'
                        : 'border-white bg-white text-slate-700 hover:border-brand-200'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
                    ) : (
                      <EmptySquare className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                    )}
                    <span>{item.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            דברי ברצף טבעי — K.ai יפצל ל-6 סעיפים, ובמה שלא הוזכר יכתוב "לא צוין בתיאור המפגש".
          </p>
        </aside>
      </div>
    </section>
  )
}

function DraftStep({
  summary,
  sessionDate,
  onBackToEdit,
  onReset,
  onSave,
  isSaving,
  saveError,
}) {
  return (
    <section aria-label="טיוטת הסיכום" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">טיוטת סיכום מפגש</h1>
          <p className="mt-1 text-sm text-slate-500">
            מפגש מתאריך {formatDate(sessionDate)} · טיוטה טרם נשמרה
          </p>
        </div>
      </div>

      {/* באנר הסבר שקוף על מקור הטיוטה. שלב 5: טקסט עודכן לנייטרלי — כבר לא
          "סטאב זמני", אבל עדיין לא כל הסעיפים מופרדים בנפרד ע"י ה-AI. */}
      <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm text-brand-700">
        <p>
          <span className="font-semibold">שימי לב:</span> הטיוטה נכתבה ע"י AI. אחרי השמירה אפשר לערוך כל סעיף ולאשר.
          {!summary.sectionsSeparated && ' חלק מהסעיפים עדיין לא מופרדים — התוכן המלא מופיע תחת "מה עלה במפגש".'}
        </p>
      </div>

      <SummarySection label="סיכום קצר" content={summary.shortSummary} />
      <SummarySection label="מה עלה במפגש" content={summary.whatHappened} />
      <SummarySection label="פעולות והתערבויות שבוצעו" content={summary.actions} />
      <SummarySection label="תגובת המטופל" content={summary.patientResponse} />
      <SummarySection label="מטרות להמשך" content={summary.futureGoals} />
      <SummarySection label="נוסח קצר להעתקה" content={summary.shortForCopy} />

      {/* שלב 6: אין העתקה/הורדה לפני אישור. ההעתקה עברה למסך העריכה, אחרי "קראתי ואני מאשרת". */}
      <p className="text-xs text-slate-500">העתקה והורדה יתאפשרו אחרי אישור המסמך.</p>

      {saveError && (
        <div
          role="alert"
          className="rounded-xl border-2 border-red-500 bg-red-50 px-4 py-4 text-red-800"
        >
          <div className="mb-2 flex items-center gap-2 font-bold">
            <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
            שגיאה בשמירה
          </div>
          <pre className="whitespace-pre-wrap break-all text-sm leading-relaxed">{saveError}</pre>
        </div>
      )}

      {/* פעולות: חזרה לעריכה / איפוס / שמירה כטיוטה. אין כאן "אישור סופי" —
          זה יגיע בשלב 6 אחרי שיהיה מסך עריכה. כרגע השמירה מסמנת status='generated'. */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onBackToEdit}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          חזרה לעריכת המקור
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          איפוס
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {isSaving ? 'שומרת…' : 'שמירה והמשך לעריכה'}
        </button>
      </div>
    </section>
  )
}

function SummarySection({ label, content, actionButton }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-700">{label}</h3>
        {actionButton ?? (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
            נכתב ע"י AI
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap border-s-2 border-brand-200 ps-3 text-sm leading-relaxed text-slate-800">{content}</p>
    </div>
  )
}

function SavedStep({ onBackToWorkspace, onCreateAnother, onEditNow }) {
  return (
    <section
      aria-label="הטיוטה נשמרה"
      className="flex flex-col items-center gap-4 rounded-xl border border-success-100 bg-success-50 px-6 py-16 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-100">
        <Check className="h-6 w-6 text-success-700" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-bold text-success-700">הטיוטה נשמרה בהצלחה</h2>
        <p className="max-w-sm text-sm text-slate-600">
          המסמך נוסף להיסטוריית המטופל בסטטוס "טיוטה".
        </p>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onCreateAnother}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          יצירת טיוטה נוספת
        </button>
        <button
          type="button"
          onClick={onBackToWorkspace}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          חזרה למסך העבודה של המטופל
        </button>
        <button
          type="button"
          onClick={onEditNow}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          לעריכה ואישור
        </button>
      </div>
    </section>
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

// ---- עזרים ----

const AUDIO_UPLOAD_EXTENSIONS = ['mp3', 'm4a', 'ogg', 'wav', 'webm']
const AUDIO_UPLOAD_MAX_BYTES = 25 * 1024 * 1024

function todayIsoDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
