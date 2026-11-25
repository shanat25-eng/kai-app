import { createContext, useContext, useState } from 'react'

// שמות הטאבים/מסכים הראשיים באפליקציה.
// בעתיד ניתן להחליף את המימוש הפנימי (useState) בראוטר אמיתי
// (למשל react-router-dom) בלי לגעת ברכיבי המסך עצמם —
// כל מי שצורך VIEWS / useAppView ימשיך לעבוד באותה צורה.
//
// PATIENT_WORKSPACE ו-CREATE_SESSION_SUMMARY הם sub-views (לא טאבים עליונים):
// נכנסים אליהם דרך פונקציות ניווט ייעודיות (openPatientWorkspace / openCreateSessionSummary),
// ויוצאים דרך close*() או לחיצה על אחד מהטאבים העליונים.
// שניהם דורשים selectedPatientId (יופיע להם fallback ידידותי אם אין) — לכן
// setActiveView לא מאפס את selectedPatientId כשעוברים ביניהם.
export const VIEWS = {
  PATIENTS: 'patients',
  PATIENT_WORKSPACE: 'patient_workspace',
  CREATE_SESSION_SUMMARY: 'create_session_summary',
  CREATE_CLINICAL_DOCUMENT: 'create_clinical_document',
  DOCUMENT_EDIT: 'document_edit',
  DOCUMENTS: 'documents',
  SETTINGS: 'settings',
}

// מסכי משנה ששייכים ל"עולם" של מטופל בודד. כשעוברים ביניהם — selectedPatientId
// נשמר. כשעוברים לטאב עליון (מטופלים/מסמכים/הגדרות) — הוא מתאפס.
// לתחזוקה: הוספת מסך משנה חדש בעתיד = שורה אחת כאן.
const PATIENT_SCOPED_VIEWS = new Set([
  VIEWS.PATIENT_WORKSPACE,
  VIEWS.CREATE_SESSION_SUMMARY,
  VIEWS.CREATE_CLINICAL_DOCUMENT,
  VIEWS.DOCUMENT_EDIT,
])

const AppViewContext = createContext(null)

export function AppViewProvider({ children }) {
  const [activeView, setActiveViewInternal] = useState(VIEWS.PATIENTS)
  // ה-ID הפנימי של המטופל הנבחר לצורך מסך העבודה. לעולם לא מוצג
  // כזהות "נראית" של המטופל — displayCode הוא הזהות היחידה שמוצגת.
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  // ה-ID של המסמך שנפתח לעריכה ב-DocumentEditScreen. כמו selectedPatientId —
  // רק מזהה פנימי, לא שדה שמוצג. מתאפס בכל יציאה מ"עולם המטופל".
  const [selectedDocumentId, setSelectedDocumentId] = useState(null)
  const [selectedDocumentType, setSelectedDocumentType] = useState(null)

  // עוטף את setActiveView הפנימי כדי לוודא ש-selectedPatientId מתאפס
  // כשמנווטים למסך עליון (מטופלים/מסמכים/הגדרות) — כדי לא להשאיר state
  // תלוי אחרי שיצאנו מ"עולם המטופל". מסכי משנה של אותו מטופל (workspace,
  // create-session-summary) שומרים את ה-ID כדי לא לאבד הקשר במעבר ביניהם.
  // ה-API הציבורי (setActiveView) זהה לקודם — קומפוננטות שקוראות
  // setActiveView(VIEWS.PATIENTS) לא צריכות להשתנות.
  function setActiveView(view) {
    setActiveViewInternal(view)
    if (!PATIENT_SCOPED_VIEWS.has(view)) {
      setSelectedPatientId(null)
      setSelectedDocumentId(null)
    }
  }

  function openPatientWorkspace(patientId) {
    setSelectedPatientId(patientId)
    setActiveViewInternal(VIEWS.PATIENT_WORKSPACE)
  }

  function closePatientWorkspace() {
    setSelectedPatientId(null)
    setSelectedDocumentId(null)
    setActiveViewInternal(VIEWS.PATIENTS)
  }

  // פותח את מסך יצירת סיכום המפגש. דורש שיהיה כבר selectedPatientId
  // (המשתמשת חייבת להיות בתוך workspace של מטופל כדי להגיע לכפתור).
  // אם משום מה אין — נופל בחזרה למסך המטופלים במקום להראות מסך שבור.
  function openCreateClinicalDocument(documentType) {
    if (!selectedPatientId) {
      setActiveViewInternal(VIEWS.PATIENTS)
      return
    }
    setSelectedDocumentType(documentType)
    setActiveViewInternal(VIEWS.CREATE_CLINICAL_DOCUMENT)
  }

  function openCreateSessionSummary() {
    if (!selectedPatientId) {
      setActiveViewInternal(VIEWS.PATIENTS)
      return
    }
    setActiveViewInternal(VIEWS.CREATE_SESSION_SUMMARY)
  }

  // חזרה למסך העבודה של אותו מטופל (בלי לאבד את ה-ID).
  // נקראת גם אחרי שמירה מוצלחת של טיוטה וגם מלחיצה על "חזרה".
  function backToPatientWorkspace() {
    setSelectedDocumentId(null)
    if (!selectedPatientId) {
      setActiveViewInternal(VIEWS.PATIENTS)
      return
    }
    setActiveViewInternal(VIEWS.PATIENT_WORKSPACE)
  }

  // פותח את מסך עריכת/אישור המסמך (שלב 6). דורש selectedPatientId קיים,
  // בדיוק כמו openCreateSessionSummary — אם משום מה אין, נופל בחזרה
  // למסך המטופלים במקום להראות מסך שבור בלי הקשר מטופל.
  function openDocumentEdit(documentId) {
    if (!selectedPatientId) {
      setActiveViewInternal(VIEWS.PATIENTS)
      return
    }
    setSelectedDocumentId(documentId)
    setActiveViewInternal(VIEWS.DOCUMENT_EDIT)
  }

  function openDocumentByPatient(patientId, documentId) {
    if (!patientId || !documentId) return
    setSelectedPatientId(patientId)
    setSelectedDocumentId(documentId)
    setActiveViewInternal(VIEWS.DOCUMENT_EDIT)
  }

  return (
    <AppViewContext.Provider
      value={{
        activeView,
        setActiveView,
        selectedPatientId,
        openPatientWorkspace,
        closePatientWorkspace,
        openCreateSessionSummary,
        selectedDocumentType,
        openCreateClinicalDocument,
        backToPatientWorkspace,
        selectedDocumentId,
        openDocumentEdit,
        openDocumentByPatient,
      }}
    >
      {children}
    </AppViewContext.Provider>
  )
}

export function useAppView() {
  const ctx = useContext(AppViewContext)
  if (!ctx) {
    throw new Error('useAppView must be used within an AppViewProvider')
  }
  return ctx
}
