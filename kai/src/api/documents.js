import { storage } from './storage'
import { logAction } from './auditLog'
import { DOCUMENT_STATUS } from '../constants/documentStatus'

const COLLECTION_KEY = 'documents'

// שירות אחד, גנרי, שמכסה את כל ארבעת סוגי המסמכים (documentType).
// אין ארבעה קבצים נפרדים — כל הסוגים חולקים אותו מבנה, אותו מנגנון
// Traceability (sourceDocuments/sourceSessions), ואותו state-machine
// סטטוסים (generated -> reviewed -> approved).

/** @returns {Promise<import('../types/entities').Document[]>} */
export async function listDocumentsByPatient(patientId) {
  const documents = storage.readCollection(COLLECTION_KEY)
  return documents.filter((d) => d.patientId === patientId)
}

/** @returns {Promise<import('../types/entities').Document[]>} */
export async function listDocumentsByPatientAndType(patientId, documentType) {
  const documents = await listDocumentsByPatient(patientId)
  return documents.filter((d) => d.documentType === documentType)
}

/** @returns {Promise<import('../types/entities').Document|null>} */
export async function getDocument(id) {
  const documents = storage.readCollection(COLLECTION_KEY)
  return documents.find((d) => d.id === id) ?? null
}

/**
 * יצירת מסמך חדש. הסטטוס ההתחלתי הוא תמיד 'generated' —
 * אין דרך ליצור מסמך שכבר "approved" ישירות מה-API הזה,
 * בהתאם לעקרון האישור האנושי (Human Approval) מה-PRD.
 *
 * @param {{
 *   patientId: string,
 *   documentType: import('../types/entities').DocumentType,
 *   sourceText?: string,
 *   sessionId?: string,
 *   sourceDocuments?: string[],
 *   sourceSessions?: string[],
 *   generatedText: string,
 *   validationResult?: import('../types/entities').ValidationResult
 * }} data
 * @param {string} clinicianId
 * @returns {Promise<import('../types/entities').Document>}
 */
export async function createDocument(data, clinicianId) {
  const documents = storage.readCollection(COLLECTION_KEY)
  const now = new Date().toISOString()

  const newDocument = {
    id: storage.generateId('doc'),
    patientId: data.patientId,
    documentType: data.documentType,
    status: DOCUMENT_STATUS.GENERATED,
    sourceText: data.sourceText ?? null,
    sessionId: data.sessionId ?? null,
    sourceDocuments: data.sourceDocuments ?? [],
    sourceSessions: data.sourceSessions ?? [],
    generatedText: data.generatedText,
    finalText: data.generatedText,
    validationResult: data.validationResult ?? null,
    createdAt: now,
    updatedAt: now,
  }

  storage.writeCollection(COLLECTION_KEY, [...documents, newDocument])
  logAction({ clinicianId, actionType: 'created', entityType: 'Document', entityId: newDocument.id })

  return newDocument
}

/**
 * עדכון תוכן המסמך ע"י הקלינאית. אם המסמך היה עדיין 'generated',
 * הוא עובר אוטומטית ל-'reviewed' — עצם הפתיחה+העריכה נחשבת "נבדק".
 * המעבר ל-'approved' קורה אך ורק דרך approveDocument, לעולם לא כאן.
 */
export async function updateDocumentContent(id, finalText, clinicianId) {
  const documents = storage.readCollection(COLLECTION_KEY)
  const index = documents.findIndex((d) => d.id === id)
  if (index === -1) throw new Error(`Document ${id} not found`)

  const current = documents[index]
  const nextStatus =
    current.status === DOCUMENT_STATUS.GENERATED ? DOCUMENT_STATUS.REVIEWED : current.status

  const updated = {
    ...current,
    finalText,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
  }

  const next = [...documents]
  next[index] = updated
  storage.writeCollection(COLLECTION_KEY, next)
  logAction({ clinicianId, actionType: 'edited', entityType: 'Document', entityId: id })

  return updated
}

/**
 * אישור סופי של מסמך. זו הפעולה היחידה שמעבירה מסמך לסטטוס 'approved',
 * ומחייבת קריאה מפורשת ונפרדת — לעולם לא קורה אוטומטית או כתוצאה מעריכה.
 */
export async function approveDocument(id, clinicianId) {
  const documents = storage.readCollection(COLLECTION_KEY)
  const index = documents.findIndex((d) => d.id === id)
  if (index === -1) throw new Error(`Document ${id} not found`)

  const updated = {
    ...documents[index],
    status: DOCUMENT_STATUS.APPROVED,
    updatedAt: new Date().toISOString(),
  }

  const next = [...documents]
  next[index] = updated
  storage.writeCollection(COLLECTION_KEY, next)
  logAction({ clinicianId, actionType: 'approved', entityType: 'Document', entityId: id })

  return updated
}
