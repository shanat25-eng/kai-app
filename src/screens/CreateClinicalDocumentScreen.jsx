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
  FileText,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppView } from '../context/AppViewContext'
import { getPatient } from '../api/patients'
import { createDocument, listDocumentsByPatient } from '../api/documents'
import { generateClinicalDocument } from '../api/documentGeneration'
import { apiUpload } from '../api/client'
import { DOCUMENT_TYPE, DOCUMENT_TYPE_CONFIG } from '../constants/documentType'
import StatusBadge from '../components/common/StatusBadge'
import { checkForIdentifyingInfo, findIdentifyingInfo } from '../utils/privacyGuard'
import { formatDate } from '../utils/formatDate'

const AUDIO_UPLOAD_EXTENSIONS = ['mp3', 'm4a', 'ogg', 'wav', 'webm']
const AUDIO_UPLOAD_MAX_BYTES = 25 * 1024 * 1024

const DOC_META = {
  [DOCUMENT_TYPE.INITIAL_ASSESSMENT]: {
    title: 'אבחון ראשוני חדש',
    subtitle:
      'הקליטי בחופשיות או הקלידי את ממצאי האבחון — K.ai יסדר הכל לטיוטת דוח אבחון מובנית ב-6 סעיפים.',
    usesPriorDocs: false,
    notesLabel: 'תיאור וממצאי האבחון',
    notesPlaceholder:
      'תארי בחופשיות סיבת הפניה, רקע, שיתוף פעולה, ממצאים בשפה/היגוי/תקשורת, והמלצות ראשוניות...',
    checklistTitle: 'נקודות שכדאי להזכיר באבחון',
    checklist: [
      { key: 'ref', label: 'סיבת הפניה ורקע כללי' },
      { key: 'imp', label: 'תקשורת, משחק ושיתוף פעולה' },
      { key: 'lang', label: 'ממצאי שפה (הבנה והבעה)' },
      { key: 'speech', label: 'ממצאי היגוי, דיבור ותפקודי פה' },
      { key: 'sum', label: 'סיכום והתרשמות קלינית' },
      { key: 'rec', label: 'המלצות ומטרות ראשוניות' },
    ],
  },
  [DOCUMENT_TYPE.SERIES_SUMMARY]: {
    title: 'סיכום סדרת טיפולים חדש',
    subtitle:
      'בחרי את המסמכים הקודמים של המטופל/ת שמהם ייבנה סיכום הסדרה, והוסיפי הערות או הקלטה קצרה אם תרצי.',
    usesPriorDocs: true,
    notesLabel: 'הערות נוספות לסיכום הסדרה (אופציונלי אם נבחרו מסמכים)',
    notesPlaceholder:
      'לדוגמה: מסגרת הסדרה (12 מפגשים, אחת לשבוע), הדרכת הורים, המלצות להמשך...',
    checklistTitle: 'מה כדאי לכלול בסיכום סדרה',
    checklist: [
      { key: 'scope', label: 'מספר מפגשים ותדירות' },
      { key: 'start', label: 'מצב בתחילת הסדרה' },
      { key: 'prog', label: 'התקדמות עיקרית שהושגה' },
      { key: 'now', label: 'מצב תפקודי נוכחי' },
      { key: 'rec', label: 'המלצות להמשך / סיום טיפול' },
    ],
  },
  [DOCUMENT_TYPE.CONTINUATION_REQUEST]: {
    title: 'בקשה להמשך טיפול',
    subtitle:
      'בחרי את האבחון וסיכומי המפגשים הרלוונטיים, וצייני את מספר המפגשים המבוקש — K.ai יכין טיוטת בקשה מנומקת.',
    usesPriorDocs: true,
    notesLabel: 'דגשים והיקף הטיפול המבוקש',
    notesPlaceholder:
      'לדוגמה: מבקשת 12 מפגשים נוספים בתדירות של אחת לשבוע לצורך הטמעת היגוי ש/ס בדיבור ספונטני...',
    checklistTitle: 'מה חשוב להזכיר בבקשה להמשך',
    checklist: [
      { key: 'done', label: 'התקדמות שהושגה עד כה' },
      { key: 'gaps', label: 'פערים שעדיין קיימים' },
      { key: 'why', label: 'למה נדרש המשך טיפול דווקא עכשיו' },
      { key: 'goals', label: 'מטרות לתקופה המבוקשת' },
      { key: 'count', label: 'מספר מפגשים ותדירות מבוקשת' },
    ],
  },
}

export default function CreateClinicalDocumentScreen() {
  const { clinician } = useAuth()
  const { selectedPatientId, selectedDocumentType, backToPatientWorkspace, openDocumentEdit } = useAppView()

  const docType = selectedDocumentType || DOCUMENT_TYPE.INITIAL_ASSESSMENT
  const meta = DOC_META[docType] ?? DOC_META[DOCUMENT_TYPE.INITIAL_ASSESSMENT]

  const [patient, setPatient] = useState(null)
  const [priorDocs, setPriorDocs] = useState([])
  const [selectedDocIds, setSelectedDocIds] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [step, setStep] = useState('input') // 'input' | 'draft'
  const [notesText, setNotesText] = useState('')
  const [checkedPoints, setCheckedPoints] = useState({})
  const [formError, setFormError] = useState(null)
  const [nameWarning, setNameWarning] = useState(null)

  const [draft, setDraft] = useState(null) // { sections, generatedText, validation }
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordError, setRecordError] = useState(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const audioFileInputRef = useRef(null)
  const isAudioBusy = isRecording || isTranscribing

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!selectedPatientId) {
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      setLoadError(null)
      try {
        const [p, docs] = await Promise.all([
          getPatient(selectedPatientId),
          meta.usesPriorDocs ? listDocumentsByPatient(selectedPatientId) : Promise.resolve([]),
        ])
        if (cancelled) return
        setPatient(p)
        setPriorDocs(docs)
        setSelectedDocIds(docs.map((d) => d.id))
      } catch (err) {
        if (cancelled) return
        console.error('kai: failed to load clinical doc context', err)
        setLoadError('אירעה שגיאה בטעינת נתוני המטופל. נסי שוב.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedPatientId, docType])

  function togglePriorDoc(id) {
    setSelectedDocIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setFormError(null)
  }

  function buildCombinedSourceText() {
    const parts = []
    if (meta.usesPriorDocs && selectedDocIds.length > 0) {
      const chosen = priorDocs.filter((d) => selectedDocIds.includes(d.id))
      for (const d of chosen) {
        const typeLabel = DOCUMENT_TYPE_CONFIG[d.documentType]?.label ?? d.documentType
        parts.push(`--- ${typeLabel} (${formatDate(d.createdAt)}) ---\n${d.finalText || d.generatedText || ''}`)
      }
    }
    if (notesText.trim()) {
      parts.push(`--- הערות / תיאור מהקלינאית ---\n${notesText.trim()}`)
    }
    return parts.join('\n\n')
  }

  function validate() {
    const combined = buildCombinedSourceText()
    if (!combined.trim()) {
      setFormError(
        meta.usesPriorDocs
          ? 'נא לבחור לפחות מסמך קודם אחד או להזין תיאור/הקלטה'
          : 'נא להקליט או להזין את ממצאי האבחון',
      )
      return false
    }
    const privacy = checkForIdentifyingInfo(notesText)
    if (privacy.flagged) {
      setFormError(`⚠ ${privacy.reason}. אנא הסירי כל פרט מזהה לפני המשך.`)
      return false
    }
    const names = findIdentifyingInfo(notesText).filter((i) => i.level === 'warn')
    if (names.length > 0 && nameWarning !== notesText) {
      setNameWarning(notesText)
      setFormError(
        `⚠ נראה שיש כאן שם: "${names[0].match}". אם זה שם — מחקי אותו. אם לא — לחצי שוב כדי להמשיך.`,
      )
      return false
    }
    setFormError(null)
    return true
  }

  async function handleGenerate() {
    if (!validate()) return
    setIsGenerating(true)
    try {
      const result = await generateClinicalDocument({
        documentType: docType,
        sourceText: buildCombinedSourceText(),
        patientContext: patient
          ? { ageRange: patient.ageRange, treatmentArea: patient.treatmentArea }
          : undefined,
      })
      setDraft(result)
      setStep('draft')
    } catch (err) {
      console.error('kai: generateClinicalDocument failed:', err.message, err)
      setFormError(`שגיאה ביצירת הטיוטה: ${err.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSaveAndEdit() {
    if (!draft || !selectedPatientId) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const saved = await createDocument(
        {
          patientId: selectedPatientId,
          documentType: docType,
          sourceDocuments: meta.usesPriorDocs ? selectedDocIds : [],
          sourceText: notesText.trim().slice(0, 2000) || null,
          generatedText: draft.generatedText,
          sections: draft.sections,
          validationResult: draft.validation ?? null,
        },
        clinician.id,
      )
      openDocumentEdit(saved.id)
    } catch (err) {
      console.error('kai: save clinical document failed', err)
      setSaveError(`שמירת המסמך נכשלה (${err?.message ?? 'שגיאה'}). נסי שוב.`)
    } finally {
      setIsSaving(false)
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
        stream.getTracks().forEach((t) => t.stop())
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
      console.error('kai: mic failed', err)
      setRecordError('לא ניתן לגשת למיקרופון. בדקי הרשאות בדפדפן.')
    }
  }

  function handleStopRecording() {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  async function handleUploadAudio(file) {
    if (!file) return
    setRecordError(null)
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!AUDIO_UPLOAD_EXTENSIONS.includes(ext)) {
      setRecordError('סוג הקובץ לא נתמך (mp3, m4a, ogg, wav, webm).')
      return
    }
    if (file.size > AUDIO_UPLOAD_MAX_BYTES) {
      setRecordError('הקובץ גדול מדי (מקסימום 25MB).')
      return
    }
    await transcribeAndAppend(file, file.name)
  }

  async function transcribeAndAppend(audio, filename) {
    setIsTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('file', audio, filename)
      const { transcript } = await apiUpload('/transcribe', formData)
      if (transcript) {
        setNotesText((prev) => (prev ? `${prev}\n\n${transcript}` : transcript))
        setFormError(null)
      }
    } catch (err) {
      console.error('kai: transcribe failed:', err.message, err)
      setRecordError(`התמלול נכשל: ${err.message}. הקלידי ידנית בשדה "${meta.notesLabel}" ולחצי לייצור הטיוטה.`)
    } finally {
      setIsTranscribing(false)
    }
  }

  if (!selectedPatientId) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={backToPatientWorkspace}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          חזרה
        </button>
        <p className="text-sm text-red-600">לא נבחר מטופל.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={backToPatientWorkspace}
        className="flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
        חזרה למסך העבודה של המטופל
      </button>

      {isLoading ? (
        <div className="h-12 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : patient ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-bold text-brand-700">
            {patient.displayCode}
          </span>
          <span className="text-sm text-slate-500">
            {patient.ageRange} · {patient.treatmentArea}
          </span>
        </div>
      ) : null}

      {step === 'input' && (
        <section className="space-y-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">{meta.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{meta.subtitle}</p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-caution-500 bg-caution-50 px-3 py-2.5 text-sm text-caution-700">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="font-medium">
              אין להזין שמות פרטיים, ת.ז, מספרי טלפון או כל פרט מזהה אחר.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_270px] lg:items-start">
            <div className="space-y-4">
              {meta.usesPriorDocs && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-slate-800">
                      מסמכים קודמים שייכללו כבסיס ({selectedDocIds.length}/{priorDocs.length})
                    </h2>
                    {priorDocs.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedDocIds(
                            selectedDocIds.length === priorDocs.length ? [] : priorDocs.map((d) => d.id),
                          )
                        }
                        className="text-xs font-medium text-brand-700 hover:underline"
                      >
                        {selectedDocIds.length === priorDocs.length ? 'בטל בחירה' : 'בחר הכל'}
                      </button>
                    )}
                  </div>
                  {priorDocs.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      אין עדיין מסמכים שמורים למטופל/ת — אפשר להקליט או להקליד ישירות למטה.
                    </p>
                  ) : (
                    <div className="max-h-56 space-y-1.5 overflow-y-auto">
                      {priorDocs.map((d) => {
                        const checked = selectedDocIds.includes(d.id)
                        const label = DOCUMENT_TYPE_CONFIG[d.documentType]?.label ?? d.documentType
                        return (
                          <label
                            key={d.id}
                            className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                              checked
                                ? 'border-brand-300 bg-brand-50/50'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePriorDoc(d.id)}
                                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                              />
                              <FileText className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                              <span className="font-medium text-slate-800">{label}</span>
                              <span className="text-slate-400">{formatDate(d.createdAt)}</span>
                            </span>
                            <StatusBadge status={d.status} />
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-5 text-center">
                <button
                  type="button"
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  disabled={!isRecording && isAudioBusy}
                  className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-md transition-all disabled:opacity-60 ${
                    isRecording
                      ? 'animate-pulse bg-red-600 hover:bg-red-700'
                      : 'bg-brand-600 hover:bg-brand-700'
                  }`}
                >
                  {isRecording ? <Square className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                </button>
                <p className="text-sm font-medium text-slate-700">
                  {isRecording
                    ? 'מקליטה… לחצי שוב לעצירה ותמלול'
                    : isTranscribing
                      ? 'מתמללת את ההקלטה…'
                      : 'לחצי להקלטה חופשית'}
                </p>
                {isTranscribing && (
                  <span className="inline-flex items-center gap-1 text-xs text-brand-700">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    מעבדת שמע…
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => audioFileInputRef.current?.click()}
                  disabled={isAudioBusy}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                >
                  <Upload className="h-3.5 w-3.5" />
                  או העלאת קובץ שמע
                </button>
                <input
                  ref={audioFileInputRef}
                  type="file"
                  accept={AUDIO_UPLOAD_EXTENSIONS.map((ext) => `.${ext}`).join(',')}
                  className="hidden"
                  onChange={(e) => {
                    handleUploadAudio(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
                {recordError && (
                  <p className="flex items-start gap-1 text-xs text-red-600">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {recordError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="docNotes" className="mb-1 block text-sm font-medium text-slate-700">
                  {meta.notesLabel}
                </label>
                <textarea
                  id="docNotes"
                  rows={7}
                  value={notesText}
                  onChange={(e) => {
                    setNotesText(e.target.value)
                    setFormError(null)
                  }}
                  placeholder={meta.notesPlaceholder}
                  className={`w-full resize-y rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    formError
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                      : 'border-slate-300 focus:border-brand-500 focus:ring-brand-500'
                  }`}
                />
                {formError && (
                  <p className="mt-1 flex items-start gap-1 text-xs text-red-600">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {formError}
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating || isAudioBusy}
                  className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  {isGenerating ? 'מייצרת טיוטה…' : 'צור/י טיוטת מסמך'}
                </button>
              </div>
            </div>

            <aside className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
              <h2 className="text-sm font-bold text-brand-800">{meta.checklistTitle}</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                תזכורת נוחה — אפשר לסמן תוך כדי דיבור.
              </p>
              <ul className="mt-3 space-y-2">
                {meta.checklist.map((item) => {
                  const checked = Boolean(checkedPoints[item.key])
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() =>
                          setCheckedPoints((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                        }
                        className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-start text-xs font-medium transition-colors ${
                          checked
                            ? 'border-success-200 bg-success-50 text-success-700 line-through'
                            : 'border-white bg-white text-slate-700 hover:border-brand-200'
                        }`}
                      >
                        {checked ? (
                          <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
                        ) : (
                          <EmptySquare className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                        )}
                        <span>{item.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </aside>
          </div>
        </section>
      )}

      {step === 'draft' && draft && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold text-slate-900">טיוטת {DOCUMENT_TYPE_CONFIG[docType]?.label}</h1>
              <p className="text-xs text-slate-500">
                שמרי את הטיוטה כדי לערוך סעיף-סעיף, לאשר ולייצא ל-Word או PDF.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('input')}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                חזרה לעריכת קלט
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {draft.sections.map((sec) => (
              <div key={sec.key} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <h3 className="mb-1.5 text-sm font-bold text-slate-700">{sec.label}</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{sec.text}</p>
              </div>
            ))}
          </div>

          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {saveError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleSaveAndEdit}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'שומרת…' : 'שמירה ומעבר לעריכה ואישור'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
