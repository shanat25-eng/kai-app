import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Copy,
  Check,
  Sparkles,
  ShieldAlert,
  TriangleAlert,
  RotateCcw,
  Save,
  Mic,
  Square,
  Loader2,
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
} from '../api/documentGeneration'
import { checkForIdentifyingInfo } from '../utils/privacyGuard'
import { formatDate } from '../utils/formatDate'

// מסך יצירת סיכום מפגש טיפולי — הזרימה המרכזית של שלב 5.
//
// שלושה שלבים קטנים באותו המסך (בלי ניווט בין מסכים):
//   1. INPUT   — הקלינאית ממלאת תאריך + טקסט מקור, עוברת בדיקת privacyGuard.
//   2. DRAFT   — 6 סעיפי הסיכום מוצגים על המסך (עם כפתור העתקה על הסעיף הקצר).
//   3. SAVED   — המסמך נשמר כ-'generated' ב-DB, מציגים אישור וחוזרים לworkspace.
//
// למה בכוונה אין עדיין עריכה/אישור של הטיוטה בשלב הזה?
//   • הבריף לשלב 5 מגדיר: "טקסט נכנס ← כפתור עובד ← טיוטת סיכום אחת מוצגת במסך".
//   • המחזור generated → reviewed → approved קיים ב-api/documents.js ומחכה
//     למסך עריכה ייעודי — שיגיע בשלב 6. עד אז, טיוטות נשארות ב-'generated'
//     וניתן לראות אותן בהיסטוריה.
//
// למה יוצרים Session ולא רק Document?
//   • entities.js/session_summary מקושר ל-Session דרך sessionId.
//   • PatientsScreen ממיין את הכרטיסים לפי lastSessionDate — בלי Session,
//     המטופל לא היה עולה למעלה אחרי מפגש חדש. זו לא תוספת feature — זו
//     הכרחיות למודל הנתונים הקיים.
export default function CreateSessionSummaryScreen() {
  const { clinician } = useAuth()
  const { selectedPatientId, backToPatientWorkspace, openDocumentEdit } = useAppView()

  // טעינת המטופל (רק כדי להראות את ה-displayCode בכותרת ההקשר)
  const [patient, setPatient] = useState(null)
  const [isLoadingPatient, setIsLoadingPatient] = useState(true)
  const [patientLoadError, setPatientLoadError] = useState(null)

  // שלבי המסך: 'input' → 'draft' → 'saved'
  const [step, setStep] = useState('input')

  // שדות הטופס
  const [sessionDate, setSessionDate] = useState(() => todayIsoDate())
  const [sourceText, setSourceText] = useState('')
  const [formErrors, setFormErrors] = useState({})

  // תוצאת הסטאב (אובייקט TreatmentSummary) — נשמר בזיכרון בלבד עד לחיצה על "שמירה"
  const [draftSummary, setDraftSummary] = useState(null)

  // ה-id של ה-Document שנוצר בפועל ב-handleSaveDraft — נדרש כדי לאפשר
  // "ערכי טיוטה עכשיו" מתוך SavedStep (openDocumentEdit דורש documentId).
  const [savedDocumentId, setSavedDocumentId] = useState(null)

  // מצבי פעולה אסינכרוניים
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Feedback ל"הועתק ללוח" — נעלם אחרי 2 שניות
  const [copiedTick, setCopiedTick] = useState(false)

  // ---- שלב 6: הקלטה מהמיקרופון → תמלול (/api/transcribe) → sourceText ----
  // מחזיר את הזרימה הקיימת בדיוק: אחרי שהתמלול ממלא את sourceText, הכל
  // ממשיך כמו טקסט מוקלד — אותה validateInput, אותו handleGenerate.
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordError, setRecordError] = useState(null)
  const [wasRecorded, setWasRecorded] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  // ---- טעינת המטופל להצגת הקוד בכותרת ----
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

  // ---- פעולות המשתמשת ----

  function validateInput() {
    const errors = {}
    if (!sessionDate) {
      errors.sessionDate = 'נא לבחור תאריך מפגש'
    } else if (sessionDate > todayIsoDate()) {
      // מגן מפני תאריך עתידי — לרוב טעות הקלדה
      errors.sessionDate = 'תאריך המפגש לא יכול להיות בעתיד'
    }
    if (!sourceText.trim()) {
      errors.sourceText = 'נא להזין תיאור של מה שקרה במפגש (זהו המקור לטיוטה)'
    } else {
      const privacyCheck = checkForIdentifyingInfo(sourceText)
      if (privacyCheck.flagged) {
        errors.sourceText = `⚠ ${privacyCheck.reason}. אנא הסירי כל פרט מזהה לפני המשך.`
      }
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleGenerate() {
    if (!validateInput()) return
    setIsGenerating(true)
    try {
      const summary = await generateTreatmentSummary(sourceText)
      setDraftSummary(summary)
      setStep('draft')
    } catch (err) {
      // הסטאב הנוכחי לא זורק — אבל כשיוחלף ב-AI אמיתי, כן יוכל להיכשל.
      // הטיפול כאן כבר מוכן לזה: לא קורסים, מציגים שגיאה ידידותית.
      console.error('kai: generation stub failed unexpectedly', err)
      setFormErrors({
        sourceText: 'שגיאה ביצירת הטיוטה. נסי שוב או פני לצוות התמיכה.',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // מבקשת הרשאת מיקרופון ומתחילה הקלטה. כשל כאן (הרשאה נדחתה/דפדפן
  // חוסם/רשת מסוננת) הוא בדיוק השאלה הפתוחה #1 שסומנה ב-PRD (סעיף 20) —
  // מטופל בעדינות: הודעה ברורה, לא קריסה, אפשר עדיין להקליד ידנית.
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
        // עוצרים את כל ה-tracks כדי לכבות את חיווי "המיקרופון פעיל" בדפדפן.
        stream.getTracks().forEach((track) => track.stop())

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        })

        setIsTranscribing(true)
        try {
          const formData = new FormData()
          formData.append('file', audioBlob, 'recording.webm')
          // אותו /api/transcribe הקיים משלב 2 — לא נוצר endpoint חדש.
          const { transcript, _mock } = await apiUpload('/transcribe', formData)

          // מחליף את sourceText בתמלול — הקלינאית עדיין יכולה לערוך אותו
          // ב-textarea הקיים לפני יצירת הטיוטה (בהתאם ל-PRD 7.3: "תמלול →
          // בדיקת הקלינאית"), ולא נדרש שום UI נוסף לצורך זה.
          setSourceText(transcript)
          setWasRecorded(true)

          if (_mock) {
            // מסומן במפורש — לא שקט — כדי שלא יתבלבל עם תמלול אמיתי.
            setRecordError('⚠ זהו תמלול לדוגמה (mock), לא תמלול אמיתי — בדקי את הגדרות ה-Backend.')
          }
        } catch (err) {
          console.error('kai: transcription failed', err)
          setRecordError('התמלול נכשל. נסי שוב, או הקלידי את הטקסט ידנית.')
        } finally {
          setIsTranscribing(false)
        }
      }

      mediaRecorder.start()
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

  function handleBackToEdit() {
    // חזרה מהצגת הטיוטה לעריכת המקור — הטיוטה נשמרת אם המשתמשת רוצה
    // רק לתקן משפט קטן ולהריץ מחדש. אם רוצים להתחיל מאפס יש כפתור "איפוס".
    setStep('input')
  }

  function handleReset() {
    setSourceText('')
    setSessionDate(todayIsoDate())
    setDraftSummary(null)
    setSavedDocumentId(null)
    setFormErrors({})
    setSaveError(null)
    setRecordError(null)
    setWasRecorded(false)
    setStep('input')
  }

  async function handleSaveDraft() {
    if (!draftSummary || !selectedPatientId) return
    setIsSaving(true)
    setSaveError(null)

    // מחשבים את גודל הנתונים לפני השמירה — לצורך הצגת שגיאה מפורטת אם תיכשל.
    const generatedText = formatSummaryAsText(draftSummary)
    // גרסת sourceText לאחסון: חותכים ל-2000 תווים כדי לא לפוצץ את ה-5MB של
    // localStorage. הטקסט המלא נשמר בזיכרון ב-state בזמן המפגש — הוא לא
    // נדרש לאחסון ארוך-טווח, רק ה-generatedText הוא הערך הנשמר.
    const MAX_SOURCE_CHARS = 2000
    const sourceTextForStorage =
      sourceText.length > MAX_SOURCE_CHARS
        ? sourceText.slice(0, MAX_SOURCE_CHARS) + '\n[... קוצר לאחסון]'
        : sourceText
    const draftSizeKB = Math.round(
      (JSON.stringify({ patientId: selectedPatientId, sessionDate, sourceTextForStorage, generatedText }).length) / 1024
    )

    try {
      const session = await createSession(
        {
          patientId: selectedPatientId,
          sessionDate,
          inputMethod: wasRecorded ? 'recording' : 'typed',
          sourceText: sourceTextForStorage,
        },
        clinician.id,
      )

      // sourceText לא נשמר ב-Document — הוא כבר קיים ב-Session (דרך sessionId).
      // שמירה כפולה של הטרנסקריפט המלא הייתה מכפילה את גודל האחסון לשווא.
      const savedDocument = await createDocument(
        {
          patientId: selectedPatientId,
          documentType: DOCUMENT_TYPE.SESSION_SUMMARY,
          sessionId: session.id,
          sourceText: null,
          generatedText,
          validationResult: draftSummary.validation ?? null,
        },
        clinician.id,
      )

      setSavedDocumentId(savedDocument.id)
      setStep('saved')
    } catch (err) {
      console.error('kai: failed to save session summary draft', err)
      let storageUsedKB = '?'
      try {
        let total = 0
        for (const k of Object.keys(localStorage)) total += (localStorage.getItem(k) ?? '').length
        storageUsedKB = Math.round(total / 1024)
      } catch {}
      setSaveError(
        `שמירת הטיוטה נכשלה.\n` +
        `סוג שגיאה: ${err?.name ?? 'Unknown'}\n` +
        `הודעה: ${err?.message ?? '(ריק)'}\n` +
        `גודל טיוטה: ~${draftSizeKB} KB\n` +
        `localStorage בשימוש: ~${storageUsedKB} KB / 5120 KB`
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCopyShort() {
    if (!draftSummary) return
    try {
      await navigator.clipboard.writeText(draftSummary.shortForCopy)
      setCopiedTick(true)
      setTimeout(() => setCopiedTick(false), 2000)
    } catch (err) {
      // navigator.clipboard לא זמין ב-HTTP או בדפדפנים ישנים.
      // Fallback שקט: המשתמשת יכולה עדיין לסמן ולהעתיק ידנית.
      console.warn('kai: clipboard API unavailable', err)
    }
  }

  // ---- מקרי קצה של המסך כולו ----

  // אין מטופל נבחר (למשל: refresh של הדף) — חוזרים למסך המטופלים
  if (!selectedPatientId) {
    return (
      <div className="space-y-4">
        <BackLink onClick={backToPatientWorkspace} label="חזרה" />
        <ErrorCard message="לא נבחר מטופל. חזרי למסך המטופלים ובחרי מטופל." />
      </div>
    )
  }

  // ---- רינדור עיקרי ----

  return (
    <div className="space-y-6">
      <BackLink
        onClick={backToPatientWorkspace}
        label={step === 'saved' ? 'חזרה למסך העבודה' : 'חזרה למסך העבודה של המטופל'}
      />

      {/* כותרת ההקשר — displayCode של המטופל, כדי שהמשתמשת תדע לאיזה מטופל היא כותבת */}
      <PatientContextBar
        patient={patient}
        isLoading={isLoadingPatient}
        loadError={patientLoadError}
      />

      {/* שלב 1: קלט */}
      {step === 'input' && (
        <InputStep
          sessionDate={sessionDate}
          onSessionDateChange={setSessionDate}
          sourceText={sourceText}
          onSourceTextChange={setSourceText}
          formErrors={formErrors}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          recordError={recordError}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
        />
      )}

      {/* שלב 2: טיוטה מוצגת */}
      {step === 'draft' && draftSummary && (
        <DraftStep
          summary={draftSummary}
          sessionDate={sessionDate}
          onBackToEdit={handleBackToEdit}
          onReset={handleReset}
          onSave={handleSaveDraft}
          onCopyShort={handleCopyShort}
          copiedTick={copiedTick}
          isSaving={isSaving}
          saveError={saveError}
        />
      )}

      {/* שלב 3: נשמר בהצלחה */}
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

// ============================================================================
// רכיבי משנה — מפוצלים בקובץ אחד כי כולם משמשים רק כאן ואינם מיועדים לשימוש חוזר.
// אם בעתיד יימצא שימוש חוזר, קל להוציא אותם לקבצים נפרדים.
// ============================================================================

function BackLink({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
    >
      {/* ב-RTL, חץ ימינה = "חזור" (הכיוון האחורי בקריאה מימין לשמאל) */}
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
  if (loadError) {
    return <ErrorCard message={loadError} />
  }
  if (!patient) {
    return <ErrorCard message="פרטי המטופל לא נמצאו." />
  }
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
  formErrors,
  onGenerate,
  isGenerating,
  isRecording,
  isTranscribing,
  recordError,
  onStartRecording,
  onStopRecording,
}) {
  return (
    <section aria-label="הזנת תיאור המפגש" className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">סיכום מפגש טיפולי חדש</h1>
        <p className="mt-1 text-sm text-slate-500">
          תארי בטקסט חופשי מה קרה במפגש. הטיוטה תיווצר לפי מבנה סטנדרטי של 6 סעיפים.
        </p>
      </div>

      {/* אזהרת פרטיות — עקבית עם PatientFormModal (כלל ברזל #1) */}
      <div className="flex items-start gap-2 rounded-lg border border-caution-500 bg-caution-50 px-3 py-2.5 text-sm text-caution-700">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="font-medium">
          אין להזין שמות, ת.ז, מספרי טלפון או כל פרט מזהה אחר בטקסט המפגש.
        </p>
      </div>

      {/* תאריך מפגש */}
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

      {/* שלב 6: הקלטה מהמיקרופון — אזור מינימלי, ממלא את אותו textarea למטה.
          לא מסך נפרד, לא לוגיקה נוספת מעבר להקלטה→תמלול→sourceText. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={isRecording ? onStopRecording : onStartRecording}
            disabled={isTranscribing}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              isRecording
                ? 'border-red-400 bg-red-50 text-red-700 hover:bg-red-100'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {isRecording ? (
              <Square className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Mic className="h-4 w-4" aria-hidden="true" />
            )}
            {isRecording ? 'עצור הקלטה' : 'הקלטה מהמיקרופון'}
          </button>
          {isTranscribing && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
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
      </div>

      {/* טקסט מקור */}
      <div>
        <label htmlFor="sourceText" className="mb-1 block text-sm font-medium text-slate-700">
          תיאור המפגש <span className="text-red-500">*</span>
        </label>
        <textarea
          id="sourceText"
          rows={10}
          value={sourceText}
          onChange={(e) => onSourceTextChange(e.target.value)}
          placeholder="לדוגמה: במפגש עסקנו בתרגילי היגוי. המטופל/ת שיתפ/ה פעולה, ביצוע התרגילים היה..."
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
          <p className="mt-1 text-xs text-slate-400">
            {sourceText.length} תווים
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating || isRecording || isTranscribing}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {isGenerating ? 'מייצרת טיוטה…' : 'צור/י טיוטת סיכום'}
        </button>
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
  onCopyShort,
  copiedTick,
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
          <span className="font-semibold">שים לב:</span> טיוטה נוצרה אוטומטית. חלק מהסעיפים
          עדיין אינם מופרדים בנפרד — התוכן המלא מופיע תחת "מה עלה במפגש".
        </p>
      </div>

      <SummarySection label="סיכום קצר" content={summary.shortSummary} />
      <SummarySection label="מה עלה במפגש" content={summary.whatHappened} />
      <SummarySection label="פעולות והתערבויות שבוצעו" content={summary.actions} />
      <SummarySection label="תגובת המטופל" content={summary.patientResponse} />
      <SummarySection label="מטרות להמשך" content={summary.futureGoals} />
      <SummarySection
        label="נוסח קצר להעתקה"
        content={summary.shortForCopy}
        actionButton={
          <button
            type="button"
            onClick={onCopyShort}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            {copiedTick ? (
              <>
                <Check className="h-3.5 w-3.5 text-success-600" aria-hidden="true" />
                <span className="text-success-700">הועתק</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                העתק
              </>
            )}
          </button>
        }
      />

      {saveError && (
        <div
          role="alert"
          className="rounded-xl border-2 border-red-500 bg-red-50 px-4 py-4 text-red-800"
        >
          <div className="mb-2 flex items-center gap-2 text-base font-bold">
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
          {isSaving ? 'שומרת…' : 'שמור כטיוטה'}
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
        {actionButton}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{content}</p>
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
          ערכי טיוטה עכשיו
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

// תאריך היום ב-ISO (YYYY-MM-DD) — המבנה ש-<input type="date"> מצפה לו,
// וגם המבנה שאנחנו שומרים ב-Session.sessionDate (עקבי לכל האפליקציה).
function todayIsoDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
