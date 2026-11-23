import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  ArrowLeft,
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

  // שלב 6: אזהרת שם (לא חוסמת) על טקסט המקור — לחיצה שנייה על "צור טיוטה" ממשיכה
  const [nameWarning, setNameWarning] = useState(null)

  // ---- שלב 6: הקלטה מהמיקרופון → תמלול (/api/transcribe) → sourceText ----
  // מחזיר את הזרימה הקיימת בדיוק: אחרי שהתמלול ממלא את sourceText, הכל
  // ממשיך כמו טקסט מוקלד — אותה validateInput, אותו handleGenerate.
  //
  // "target" = לאן נכנס התמלול: 'free' (ה-textarea של ההקלטה החופשית) או
  // המפתח של אחת השאלות במצב "לפי שאלות". הקלטה/תמלול אחד בכל רגע.
  const [recordingTarget, setRecordingTarget] = useState(null)
  const [transcribingTarget, setTranscribingTarget] = useState(null)
  const [recordError, setRecordError] = useState(null) // { target, message } | null
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  // מצב הקלט: 'guided' (הקלטה לפי שאלות — ברירת מחדל) או 'free' (הקלטה חופשית)
  const [inputMode, setInputMode] = useState('guided')
  const [guidedAnswers, setGuidedAnswers] = useState(EMPTY_GUIDED_ANSWERS)
  // שאלה אחת בכל פעם: 0..3 = אינדקס השאלה, GUIDED_REVIEW_STEP = כל התשובות יחד לעריכה
  const [guidedStep, setGuidedStep] = useState(0)

  const isAudioBusy = recordingTarget !== null || transcribingTarget !== null

  // הטקסט שנשלח ליצירה ונשמר כ-sourceText: במצב חופשי — ה-textarea כמו
  // שהוא; במצב שאלות — טקסט אחד עם כותרת לכל שאלה.
  function getEffectiveSourceText() {
    return inputMode === 'guided' ? buildGuidedSourceText(guidedAnswers) : sourceText
  }

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
    const text = getEffectiveSourceText()
    const isEmpty =
      inputMode === 'guided'
        ? GUIDED_QUESTIONS.every((q) => !guidedAnswers[q.key].trim())
        : !sourceText.trim()
    if (isEmpty) {
      errors.sourceText =
        inputMode === 'guided'
          ? 'נא לענות על לפחות שאלה אחת (זהו המקור לטיוטה)'
          : 'נא להזין תיאור של מה שקרה במפגש (זהו המקור לטיוטה)'
    } else {
      const privacyCheck = checkForIdentifyingInfo(text)
      if (privacyCheck.flagged) {
        errors.sourceText = `⚠ ${privacyCheck.reason}. אנא הסירי כל פרט מזהה לפני המשך.`
      }
    }
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return false

    // שלב 6: שם פרטי+משפחה — אזהרה בלבד (הטקסט נשלח ל-AI). לחיצה שנייה = "זה לא שם".
    const names = findIdentifyingInfo(text).filter((i) => i.level === 'warn')
    if (names.length > 0 && nameWarning !== text) {
      setNameWarning(text)
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
      const summary = await generateTreatmentSummary(getEffectiveSourceText())
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
  async function handleStartRecording(target) {
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

        await transcribeAndAppend(target, audioBlob, 'recording.webm')
      }

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setRecordingTarget(target)
    } catch (err) {
      console.error('kai: microphone access failed', err)
      setRecordError({
        target,
        message: 'לא ניתן לגשת למיקרופון. ייתכן שההרשאה נדחתה או שהדפדפן/הרשת חוסמים גישה.',
      })
    }
  }

  function handleStopRecording() {
    mediaRecorderRef.current?.stop()
    setRecordingTarget(null)
  }

  // העלאת קובץ שמע קיים → אותו /api/transcribe בדיוק כמו הקלטה → התמלול
  // מתווסף לסוף הטקסט של אותו target.
  async function handleUploadAudioFile(target, file) {
    if (!file) return
    setRecordError(null)

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!AUDIO_UPLOAD_EXTENSIONS.includes(extension)) {
      setRecordError({
        target,
        message: 'סוג הקובץ לא נתמך. ניתן להעלות קבצי mp3, m4a, ogg, wav או webm.',
      })
      return
    }
    if (file.size > AUDIO_UPLOAD_MAX_BYTES) {
      setRecordError({ target, message: 'הקובץ גדול מדי. הגודל המקסימלי הוא 25MB.' })
      return
    }

    await transcribeAndAppend(target, file, file.name)
  }

  // משותף להקלטה ולהעלאת קובץ: שולח את השמע ל-/api/transcribe ומוסיף את
  // התמלול לסוף הטקסט של ה-target בלבד. הקלינאית עדיין יכולה לערוך אותו
  // לפני יצירת הטיוטה (בהתאם ל-PRD 7.3: "תמלול → בדיקת הקלינאית").
  async function transcribeAndAppend(target, audio, filename) {
    setTranscribingTarget(target)
    try {
      const formData = new FormData()
      formData.append('file', audio, filename)
      // אותו /api/transcribe הקיים משלב 2 — לא נוצר endpoint חדש.
      const { transcript, _mock } = await apiUpload('/transcribe', formData)

      const append = (prev) => (prev ? `${prev}\n\n${transcript}` : transcript)
      if (target === 'free') {
        setSourceText(append)
      } else {
        setGuidedAnswers((prev) => ({ ...prev, [target]: append(prev[target]) }))
      }

      if (_mock) {
        // מסומן במפורש — לא שקט — כדי שלא יתבלבל עם תמלול אמיתי.
        setRecordError({
          target,
          message: '⚠ זהו תמלול לדוגמה (mock), לא תמלול אמיתי — בדקי את הגדרות ה-Backend.',
        })
      }
    } catch (err) {
      console.error('kai: transcription failed', err)
      setRecordError({ target, message: 'התמלול נכשל. נסי שוב, או הקלידי את הטקסט ידנית.' })
    } finally {
      setTranscribingTarget(null)
    }
  }

  function handleInputModeChange(mode) {
    setInputMode(mode)
    setFormErrors({})
    setRecordError(null)
  }

  function handleGuidedAnswerChange(key, value) {
    setGuidedAnswers((prev) => ({ ...prev, [key]: value }))
  }

  function handleBackToEdit() {
    // חזרה מהצגת הטיוטה לעריכת המקור — הטיוטה נשמרת אם המשתמשת רוצה
    // רק לתקן משפט קטן ולהריץ מחדש. אם רוצים להתחיל מאפס יש כפתור "איפוס".
    setStep('input')
  }

  function handleReset() {
    // איפוס מלא — כמו טעינת המסך מחדש. כולל תאריך → היום, טקסט → ריק, טיוטה → null.
    setSourceText('')
    setGuidedAnswers(EMPTY_GUIDED_ANSWERS)
    setGuidedStep(0)
    setInputMode('guided')
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
    // אותו טקסט שממנו נוצרה הטיוטה (הקלט לא משתנה בזמן שהטיוטה מוצגת)
    const savedSourceText = getEffectiveSourceText()
    try {
      // שני יצירות רצופות: Session ואז Document שמצביע אליה.
      // אם יצירת ה-Document תיכשל אחרי שה-Session כבר נוצרה — תישאר Session
      // "יתומה" (בלי מסמך). זה תיעוד לא מלא אבל לא הרסני: המשתמשת יכולה
      // לנסות שוב ולבנות מסמך חדש עם אותה Session, או פשוט להתעלם ממנה.
      // ב-Backend אמיתי יהיה כאן transaction; כרגע ב-localStorage אין כזה.
      const session = await createSession(
        {
          patientId: selectedPatientId,
          sessionDate,
          inputMethod: 'typed',
          sourceText: savedSourceText,
        },
        clinician.id,
      )

      // שם "savedDocument" ולא "document" בכוונה — למניעת הצללה של
      // האובייקט הגלובלי window.document (rename בלבד, בלי שינוי התנהגות).
      const savedDocument = await createDocument(
        {
          patientId: selectedPatientId,
          documentType: DOCUMENT_TYPE.SESSION_SUMMARY,
          sessionId: session.id,
          sourceText: savedSourceText,
          generatedText: formatSummaryAsText(draftSummary),
          // שלב 6: סעיפים נפרדים לעריכה (aiText = הנוסח המקורי של ה-AI)
          sections: summaryToSections(draftSummary),
          // שלב 5: מעביר את תוצאת ה-Validation (שלב 4) הלאה ל-createDocument.
          // הפרמטר validationResult כבר קיים ותומך בזה מאז שלב 2
          // (api/documents.js) — לא נדרש שום שינוי שם, פשוט לא הוזן עד היום.
          validationResult: draftSummary.validation ?? null,
        },
        clinician.id,
      )

      setSavedDocumentId(savedDocument.id)
      setStep('saved')
    } catch (err) {
      console.error('kai: failed to save session summary draft', err)
      setSaveError('שמירת הטיוטה נכשלה. הטיוטה נשמרה בזיכרון — נסי שוב.')
    } finally {
      setIsSaving(false)
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
          inputMode={inputMode}
          onInputModeChange={handleInputModeChange}
          guidedAnswers={guidedAnswers}
          onGuidedAnswerChange={handleGuidedAnswerChange}
          guidedStep={guidedStep}
          onGuidedStepChange={(next) => {
            setGuidedStep(next)
            setRecordError(null)
          }}
          recordingTarget={recordingTarget}
          transcribingTarget={transcribingTarget}
          isAudioBusy={isAudioBusy}
          recordError={recordError}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onUploadAudioFile={handleUploadAudioFile}
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
  inputMode,
  onInputModeChange,
  guidedAnswers,
  onGuidedAnswerChange,
  guidedStep,
  onGuidedStepChange,
  recordingTarget,
  transcribingTarget,
  isAudioBusy,
  recordError,
  onStartRecording,
  onStopRecording,
  onUploadAudioFile,
}) {
  // כפתור יצירת הסיכום: במצב חופשי תמיד; במצב שאלות — רק במסך העריכה שאחרי השאלה הרביעית
  const showGenerateButton = inputMode === 'free' || guidedStep === GUIDED_REVIEW_STEP

  // אותם props של שמע לכל target — רק ה-target משתנה
  function audioControlsProps(target) {
    return {
      isRecording: recordingTarget === target,
      isTranscribing: transcribingTarget === target,
      isAudioBusy,
      error: recordError?.target === target ? recordError.message : null,
      onStartRecording: () => onStartRecording(target),
      onStopRecording,
      onUploadAudioFile: (file) => onUploadAudioFile(target, file),
    }
  }

  return (
    <section aria-label="הזנת תיאור המפגש" className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">סיכום מפגש טיפולי חדש</h1>
        <p className="mt-1 text-sm text-slate-500">
          {inputMode === 'guided'
            ? 'עני בהקלטה על שאלה אחת בכל פעם. אפשר לדלג על שאלה. בסוף תוכלי לעבור על כל התשובות ולערוך אותן. הטיוטה תיווצר לפי מבנה סטנדרטי של 6 סעיפים.'
            : 'תארי בטקסט חופשי מה קרה במפגש. הטיוטה תיווצר לפי מבנה סטנדרטי של 6 סעיפים.'}
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

      {/* בחירת מצב קלט. נעול בזמן הקלטה/תמלול כדי שהתמלול לא ינחת במצב שהוסתר. */}
      <div
        role="radiogroup"
        aria-label="אופן הזנת המפגש"
        className="inline-flex rounded-lg border border-slate-300 bg-white p-1"
      >
        {INPUT_MODES.map((mode) => {
          const isActive = inputMode === mode.value
          return (
            <button
              key={mode.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onInputModeChange(mode.value)}
              disabled={isAudioBusy && !isActive}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {mode.label}
            </button>
          )
        })}
      </div>

      {inputMode === 'guided' && guidedStep < GUIDED_REVIEW_STEP && (
        <GuidedQuestionStep
          index={guidedStep}
          answer={guidedAnswers[GUIDED_QUESTIONS[guidedStep].key]}
          audio={audioControlsProps(GUIDED_QUESTIONS[guidedStep].key)}
          onPrev={() => onGuidedStepChange(guidedStep - 1)}
          onNext={() => onGuidedStepChange(guidedStep + 1)}
        />
      )}

      {inputMode === 'guided' && guidedStep === GUIDED_REVIEW_STEP && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-700">כל התשובות — בדקי וערכי לפני יצירת הסיכום</h2>
            <button
              type="button"
              onClick={() => onGuidedStepChange(GUIDED_QUESTIONS.length - 1)}
              className="flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              חזרה לשאלות
            </button>
          </div>
          {GUIDED_QUESTIONS.map((q) => (
            <div key={q.key} className="space-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <label htmlFor={`guided-${q.key}`} className="block text-sm font-bold text-slate-700">
                {q.question}
              </label>
              <textarea
                id={`guided-${q.key}`}
                rows={4}
                value={guidedAnswers[q.key]}
                onChange={(e) => onGuidedAnswerChange(q.key, e.target.value)}
                placeholder="לא נענתה — אפשר להקליד כאן, או להשאיר ריק"
                className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          ))}
          {formErrors.sourceText && (
            <p className="flex items-start gap-1 text-xs text-red-600">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {formErrors.sourceText}
            </p>
          )}
        </div>
      )}

      {inputMode === 'free' && (
        <>
          {/* שלב 6: הקלטה מהמיקרופון — אזור מינימלי, ממלא את אותו textarea למטה.
              לא מסך נפרד, לא לוגיקה נוספת מעבר להקלטה→תמלול→sourceText. */}
          <AudioInputControls {...audioControlsProps('free')} />

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
        </>
      )}

      {showGenerateButton && (
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
      )}
    </section>
  )
}

// מצב "לפי שאלות": שאלה אחת, כפתור הקלטה אחד גדול, הקודם / דלג / הבא.
// אין העלאת קובץ כאן (רק במצב החופשי). "הבא" פעיל רק כשיש תשובה;
// "דלג" עובר הלאה בלי לשנות את התשובה. אחרי השאלה הרביעית — מסך העריכה.
function GuidedQuestionStep({ index, answer, audio, onPrev, onNext }) {
  const q = GUIDED_QUESTIONS[index]
  const { isRecording, isTranscribing, isAudioBusy, error, onStartRecording, onStopRecording } = audio
  const hasAnswer = Boolean(answer.trim())
  const navBtn =
    'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white px-4 py-6">
      <div className="text-center">
        <p className="text-xs font-medium text-slate-400">
          שאלה {index + 1} מתוך {GUIDED_QUESTIONS.length}
        </p>
        <h2 className="mt-1 text-lg font-bold text-slate-900">{q.question}</h2>
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={!isRecording && isAudioBusy}
          aria-label={isRecording ? 'עצור הקלטה' : 'התחלת הקלטה'}
          className={`flex h-24 w-24 items-center justify-center rounded-full text-white shadow-md transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            isRecording ? 'animate-pulse bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
          }`}
        >
          {isTranscribing ? (
            <Loader2 className="h-10 w-10 animate-spin" aria-hidden="true" />
          ) : isRecording ? (
            <Square className="h-10 w-10" aria-hidden="true" />
          ) : (
            <Mic className="h-10 w-10" aria-hidden="true" />
          )}
        </button>
        <p className="text-sm text-slate-600">
          {isTranscribing
            ? 'מתמללת…'
            : isRecording
              ? 'מקליטה — לחצי שוב כדי לעצור'
              : hasAnswer
                ? 'לחצי כדי להוסיף עוד הקלטה'
                : 'לחצי כדי להתחיל להקליט'}
        </p>
        {error && (
          <p className="flex items-start gap-1 text-xs text-red-600">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>

      {hasAnswer && (
        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
          {answer}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onPrev}
          disabled={index === 0 || isAudioBusy}
          className={`${navBtn} text-slate-600 hover:bg-slate-100`}
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          הקודם
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNext}
            disabled={isAudioBusy}
            className={`${navBtn} border border-slate-200 text-slate-600 hover:bg-slate-50`}
          >
            דלג
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!hasAnswer || isAudioBusy}
            className={`${navBtn} bg-brand-600 text-white hover:bg-brand-700`}
          >
            הבא
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

// כפתור הקלטה + כפתור העלאת קובץ + חיווי "מתמללת…" + שגיאה — לאזור טקסט אחד.
// משמש גם בהקלטה החופשית וגם בכל אחת מהשאלות.
// isAudioBusy = הקלטה/תמלול פעילים במקום כלשהו במסך — אז הכל נעול, חוץ
// מ"עצור הקלטה" של ההקלטה הפעילה.
function AudioInputControls({
  isRecording,
  isTranscribing,
  isAudioBusy,
  error,
  onStartRecording,
  onStopRecording,
  onUploadAudioFile,
}) {
  const audioFileInputRef = useRef(null)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={!isRecording && isAudioBusy}
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
        <button
          type="button"
          onClick={() => audioFileInputRef.current?.click()}
          disabled={isAudioBusy}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          העלאת קובץ שמע
        </button>
        <input
          ref={audioFileInputRef}
          type="file"
          accept={AUDIO_UPLOAD_EXTENSIONS.map((ext) => `.${ext}`).join(',')}
          className="hidden"
          onChange={(e) => {
            onUploadAudioFile(e.target.files?.[0])
            // איפוס כדי שבחירה חוזרת של אותו קובץ תפעיל onChange שוב
            e.target.value = ''
          }}
        />
        {isTranscribing && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            מתמללת…
          </span>
        )}
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
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{saveError}</p>
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

// העלאת קובץ שמע: הסוגים שהכפתור מקבל, ומגבלת 25MB (מגבלת Whisper).
const AUDIO_UPLOAD_EXTENSIONS = ['mp3', 'm4a', 'ogg', 'wav', 'webm']
const AUDIO_UPLOAD_MAX_BYTES = 25 * 1024 * 1024

const INPUT_MODES = [
  { value: 'guided', label: 'הקלטה לפי שאלות' },
  { value: 'free', label: 'הקלטה חופשית' },
]

// מצב "לפי שאלות": כל שאלה ממופה לסעיף בסיכום (key = מפתח הסעיף בשרת).
// header = הכותרת שנשלחת לשרת בטקסט המשולב.
const GUIDED_QUESTIONS = [
  { key: 'whatHappened', question: 'מה נצפה אצל המטופל?', header: 'מה נצפה' },
  { key: 'actions', question: 'מה עשית במפגש (תרגילים, טכניקות)?', header: 'מה נעשה במפגש' },
  { key: 'patientResponse', question: 'איך המטופל הגיב?', header: 'תגובת המטופל' },
  { key: 'futureGoals', question: 'מה המטרה להמשך?', header: 'מטרה להמשך' },
]

const GUIDED_REVIEW_STEP = GUIDED_QUESTIONS.length

const EMPTY_GUIDED_ANSWERS =Object.fromEntries(GUIDED_QUESTIONS.map((q) => [q.key, '']))

// טקסט אחד עם כותרות, למשל "[מה נצפה]: ...". שאלה ריקה נשלחת עם כותרת
// ריקה — השרת יודע לכתוב עבורה "לא צוין בתיאור המפגש".
function buildGuidedSourceText(answers) {
  return GUIDED_QUESTIONS.map((q) => `[${q.header}]: ${answers[q.key].trim()}`.trimEnd()).join('\n\n')
}

// תאריך היום ב-ISO (YYYY-MM-DD) — המבנה ש-<input type="date"> מצפה לו,
// וגם המבנה שאנחנו שומרים ב-Session.sessionDate (עקבי לכל האפליקציה).
function todayIsoDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
