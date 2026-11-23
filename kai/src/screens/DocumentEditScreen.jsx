import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  ShieldAlert,
  TriangleAlert,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppView } from '../context/AppViewContext'
import { getPatient } from '../api/patients'
import { getDocument, updateDocumentContent, approveDocument } from '../api/documents'
import { DOCUMENT_TYPE_CONFIG } from '../constants/documentType'
import StatusBadge from '../components/common/StatusBadge'

// מסך עריכה + אישור סופי למסמך — שלב 6.
//
// זרימה: 'loading' → 'edit' → 'approved' (או 'error' אם הטעינה נכשלה /
// אין הקשר מטופל+מסמך תקין).
//
// שני עקרונות מרכזיים של המסך הזה:
//   1. Autosave — כל שינוי בטקסט נשמר ל-DB (דרך updateDocumentContent) אחרי
//      השהיה קצרה, כדי שרענון עמוד בטעות לא ימחק עריכות. ראי הערה מפורטת
//      ליד ה-useEffect של ה-autosave.
//   2. אישור סופי דורש Checkbox מסומן במפורש — "בדקתי שאין פרטים מזהים" —
//      זו שכבת הגנה אנושית נוספת מעבר ל-privacyGuard האוטומטי (שרץ רק על
//      טקסט המקור בשלב 5, לא על הטיוטה הערוכה כאן).
export default function DocumentEditScreen() {
  const { clinician } = useAuth()
  const { selectedPatientId, selectedDocumentId, backToPatientWorkspace } = useAppView()

  const [patient, setPatient] = useState(null)
  // שם "currentDocument" ולא "document" בכוונה — "document" מסתיר את
  // האובייקט הגלובלי window.document (rename בלבד, בלי שינוי התנהגות).
  const [currentDocument, setCurrentDocument] = useState(null)
  const [step, setStep] = useState('loading') // 'loading' | 'edit' | 'approved' | 'error'
  const [loadError, setLoadError] = useState(null)

  const [finalText, setFinalText] = useState('')
  // דגל שמסמן עריכה אמיתית של המשתמשת (לא את הטעינה הראשונית של הטקסט
  // מה-DB) — כדי שה-autosave לא ירוץ מיד עם טעינת המסך על טקסט שלא השתנה.
  const hasEditedRef = useRef(false)
  // מזהה ה-setTimeout הממתין של ה-autosave (אם יש) — מאפשר לבטל אותו
  // מפורשות ב-handleApprove, כדי שלא תתבצע כתיבת autosave "יתומה" אחרי
  // שהמסמך כבר אושר.
  const autosaveTimeoutRef = useRef(null)

  const [autosaveStatus, setAutosaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'

  const [confirmedNoIdentifyingInfo, setConfirmedNoIdentifyingInfo] = useState(false)
  const [approveBlockedMessage, setApproveBlockedMessage] = useState(null)
  const [isApproving, setIsApproving] = useState(false)
  const [approveError, setApproveError] = useState(null)

  // ---- טעינה ראשונית: מטופל (לכותרת ההקשר) + מסמך (לעריכה) ----
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
        // הגנה מ-undefined: אם מסיבה כלשהי אין גם finalText וגם generatedText
        // (לא אמור לקרות במבנה הנתונים הקיים, אבל autosave לא אמור לכתוב
        // undefined/null ל-DB) — נופלים לברירת מחדל ריקה מפורשת.
        setFinalText(loadedDocument.finalText ?? loadedDocument.generatedText ?? '')
        hasEditedRef.current = false
        setStep('edit')
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

  // ---- Autosave מבוזר ----
  // רץ רק כש-hasEditedRef.current === true (כלומר המשתמשת באמת הקלידה,
  // לא בטעינה הראשונית), וכש-currentDocument כבר נטען בהצלחה (לא null) —
  // כדי לעולם לא לכתוב טקסט ריק/undefined ל-DB במקרה שהטעינה נכשלה
  // או עוד לא הסתיימה.
  //
  // ה-timeout נשמר ב-autosaveTimeoutRef (לא רק במשתנה מקומי) כדי ש-
  // handleApprove יוכל לבטל אותו במפורש — אחרת, אם מאשרים תוך פחות
  // משנייה מהקלדה אחרונה, ה-autosave היה יורה גם אחרי שהמסמך כבר אושר.
  useEffect(() => {
    if (!hasEditedRef.current) return
    if (!currentDocument || step !== 'edit') return
    if (typeof finalText !== 'string') return

    setAutosaveStatus('saving')
    autosaveTimeoutRef.current = setTimeout(async () => {
      autosaveTimeoutRef.current = null
      try {
        const updated = await updateDocumentContent(currentDocument.id, finalText, clinician.id)
        setCurrentDocument(updated)
        setAutosaveStatus('saved')
      } catch (err) {
        console.error('kai: autosave failed', err)
        setAutosaveStatus('error')
      }
    }, 1000)

    return () => {
      clearTimeout(autosaveTimeoutRef.current)
      autosaveTimeoutRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalText])

  function handleTextChange(value) {
    hasEditedRef.current = true
    setFinalText(value)
  }

  async function handleApprove() {
    if (!confirmedNoIdentifyingInfo) {
      setApproveBlockedMessage('יש לסמן שבדקת את הטקסט לפני אישור סופי.')
      return
    }
    setApproveBlockedMessage(null)
    setApproveError(null)

    // מבטלים כל autosave debounce שממתין לירות — אחרת הוא עלול לרוץ
    // כמה שניות אחרי האישור ולבצע כתיבה מיותרת (לא מזיקה סטטוסית, אבל
    // מיותרת) אחרי שכבר שמרנו את הגרסה הסופית ידנית למטה.
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
      autosaveTimeoutRef.current = null
    }

    setIsApproving(true)
    try {
      // ודאות שהגרסה האחרונה נשמרה לפני האישור, גם אם ה-autosave עדיין
      // "ממתין" (debounce) ברגע הלחיצה.
      const savedDocument = await updateDocumentContent(currentDocument.id, finalText, clinician.id)
      const approved = await approveDocument(savedDocument.id, clinician.id)
      setCurrentDocument(approved)
      setStep('approved')
    } catch (err) {
      console.error('kai: failed to approve document', err)
      setApproveError('אישור המסמך נכשל. נסי שוב.')
    } finally {
      setIsApproving(false)
    }
  }

  // ---- רינדור ----

  if (step === 'loading') {
    return (
      <div className="space-y-6">
        <BackLink onClick={backToPatientWorkspace} label="חזרה למסך העבודה" />
        <div className="h-12 animate-pulse rounded-xl border border-slate-200 bg-slate-100" aria-hidden="true" />
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100" aria-hidden="true" />
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="space-y-4">
        <BackLink onClick={backToPatientWorkspace} label="חזרה" />
        <ErrorCard message={loadError} />
      </div>
    )
  }

  if (step === 'approved') {
    return (
      <div className="space-y-6">
        <section
          aria-label="המסמך אושר"
          className="flex flex-col items-center gap-4 rounded-xl border border-success-100 bg-success-50 px-6 py-16 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-100">
            <Check className="h-6 w-6 text-success-700" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-success-700">המסמך אושר סופית</h2>
            <p className="max-w-sm text-sm text-slate-600">
              המסמך עודכן לסטטוס "מאושר" בהיסטוריית המטופל/ת.
            </p>
          </div>
          <button
            type="button"
            onClick={backToPatientWorkspace}
            className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            חזרה למסך העבודה של המטופל
          </button>
        </section>
      </div>
    )
  }

  // step === 'edit'
  return (
    <div className="space-y-6">
      <BackLink onClick={backToPatientWorkspace} label="חזרה למסך העבודה של המטופל" />

      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-bold text-brand-700">
          {patient?.displayCode ?? '—'}
        </span>
        <span className="text-sm text-slate-500">
          {DOCUMENT_TYPE_CONFIG[currentDocument.documentType]?.label ?? currentDocument.documentType}
        </span>
        <StatusBadge status={currentDocument.status} />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-slate-900">עריכת טיוטה</h1>
          <AutosaveIndicator status={autosaveStatus} />
        </div>
        <p className="text-sm text-slate-500">
          ניתן לערוך את הטקסט בחופשיות. השינויים נשמרים אוטומטית תוך כדי הקלדה.
        </p>
      </div>

      <textarea
        rows={16}
        value={finalText}
        onChange={(e) => handleTextChange(e.target.value)}
        className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white px-4 py-4">
        <label className="flex items-start gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={confirmedNoIdentifyingInfo}
            onChange={(e) => {
              setConfirmedNoIdentifyingInfo(e.target.checked)
              if (e.target.checked) setApproveBlockedMessage(null)
            }}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="flex items-start gap-1.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-caution-600" aria-hidden="true" />
            אני מאשרת שבדקתי את הטקסט ואין בו שמות מלאים או פרטים מזהים של המטופל/ת
          </span>
        </label>

        {approveBlockedMessage && (
          <p className="flex items-start gap-1 text-xs text-red-600">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {approveBlockedMessage}
          </p>
        )}

        {approveError && (
          <p className="flex items-start gap-1 text-xs text-red-600">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {approveError}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleApprove}
            disabled={!confirmedNoIdentifyingInfo || isApproving}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {isApproving ? 'מאשרת…' : 'אשר טיוטה סופית'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AutosaveIndicator({ status }) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        שומר…
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-success-700">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        נשמר
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-600">
        <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
        שמירה נכשלה
      </span>
    )
  }
  return null
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
