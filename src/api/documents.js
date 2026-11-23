import { supabase } from './supabaseClient'
import { logAction } from './auditLog'
import { DOCUMENT_STATUS } from '../constants/documentStatus'

// ---------------------------------------------------------------------------
// Pure helpers — לא נגעו בהן (לוגיקה טהורה, ללא תלות ב-storage)
// ---------------------------------------------------------------------------

const SECTION_UNDERLINE = /^-{3,}$/

export function parseTextToSections(text) {
  const lines = (text ?? '').split('\n')
  const sections = []
  let current = null
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const nextLine = lines[i + 1] ?? ''
    if (line.trim() && SECTION_UNDERLINE.test(nextLine.trim())) {
      current = { label: line.trim(), body: [] }
      sections.push(current)
      i += 1
      continue
    }
    if (!current) {
      current = { label: 'תוכן המסמך', body: [] }
      sections.push(current)
    }
    current.body.push(line)
  }
  return sections.map((s, idx) => {
    const body = s.body.join('\n').trim()
    return { key: `s${idx + 1}`, label: s.label, aiText: body, text: body }
  })
}

export function sectionsToText(sections) {
  return (sections ?? [])
    .map((s) => `${s.label}\n${'-'.repeat(Math.max(s.label.length, 3))}\n${s.text}`)
    .join('\n\n')
}

function withStage6Fields(doc) {
  if (!doc) return doc
  const sections = doc.sections?.length
    ? doc.sections
    : parseTextToSections(doc.finalText ?? doc.generatedText ?? '').map((s, idx) => {
        const original = parseTextToSections(doc.generatedText ?? '')[idx]
        return original ? { ...s, aiText: original.aiText } : s
      })
  return {
    ...doc,
    sections,
    version: doc.version ?? 1,
    versions: doc.versions ?? [],
    locked: doc.locked ?? doc.status === DOCUMENT_STATUS.APPROVED,
  }
}

// ---------------------------------------------------------------------------
// DB mapping
// ---------------------------------------------------------------------------

function toApp(row) {
  if (!row) return null
  return withStage6Fields({
    id: row.id,
    patientId: row.patient_id,
    documentType: row.document_type,
    status: row.status,
    sourceText: row.source_text,
    sessionId: row.session_id,
    sourceDocuments: row.source_documents ?? [],
    sourceSessions: row.source_sessions ?? [],
    generatedText: row.generated_text,
    finalText: row.final_text,
    validationResult: row.validation_result,
    sections: row.sections ?? [],
    versions: row.versions ?? [],
    version: row.version ?? 1,
    locked: row.locked ?? false,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** @returns {Promise<import('../types/entities').Document[]>} */
export async function listDocumentsByPatient(patientId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at')
  if (error) throw error
  return data.map(toApp)
}

/** @returns {Promise<import('../types/entities').Document[]>} */
export async function listDocumentsByPatientAndType(patientId, documentType) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('patient_id', patientId)
    .eq('document_type', documentType)
    .order('created_at')
  if (error) throw error
  return data.map(toApp)
}

/** @returns {Promise<import('../types/entities').Document|null>} */
export async function getDocument(id) {
  const { data, error } = await supabase.from('documents').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return toApp(data)
}

export async function createDocument(data, clinicianId) {
  const sections = data.sections ?? parseTextToSections(data.generatedText)
  const finalText = data.sections ? sectionsToText(data.sections) : data.generatedText

  const { data: row, error } = await supabase
    .from('documents')
    .insert({
      patient_id: data.patientId,
      document_type: data.documentType,
      status: DOCUMENT_STATUS.GENERATED,
      source_text: data.sourceText ?? null,
      session_id: data.sessionId ?? null,
      source_documents: data.sourceDocuments ?? [],
      source_sessions: data.sourceSessions ?? [],
      generated_text: data.generatedText,
      final_text: finalText,
      sections,
      versions: [],
      version: 1,
      locked: false,
      validation_result: data.validationResult ?? null,
    })
    .select()
    .single()
  if (error) throw error
  const doc = toApp(row)
  await logAction({ clinicianId, actionType: 'created', entityType: 'Document', entityId: doc.id })
  return doc
}

/**
 * עדכון תוכן המסמך. אם היה 'generated' — עובר ל-'reviewed' אוטומטית.
 * המעבר ל-'approved' קורה אך ורק דרך approveDocument.
 */
export async function updateDocumentContent(id, finalText, clinicianId) {
  const current = await getDocument(id)
  if (!current) throw new Error(`Document ${id} not found`)
  if (current.locked) throw new Error('Document is locked (approved). Create a new version first.')

  const nextStatus =
    current.status === DOCUMENT_STATUS.GENERATED ? DOCUMENT_STATUS.REVIEWED : current.status

  const { data: row, error } = await supabase
    .from('documents')
    .update({ final_text: finalText, status: nextStatus })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  await logAction({ clinicianId, actionType: 'edited', entityType: 'Document', entityId: id })
  return toApp(row)
}

/**
 * אישור סופי — הפעולה היחידה שמעבירה מסמך ל-'approved'. לעולם לא קורה אוטומטית.
 */
export async function approveDocument(id, clinicianId) {
  const current = await getDocument(id)
  if (!current) throw new Error(`Document ${id} not found`)
  const now = new Date().toISOString()

  const snapshot = {
    version: current.version,
    sections: current.sections,
    finalText: sectionsToText(current.sections),
    approvedAt: now,
    approvedBy: clinicianId,
  }

  const { data: row, error } = await supabase
    .from('documents')
    .update({
      final_text: snapshot.finalText,
      status: DOCUMENT_STATUS.APPROVED,
      locked: true,
      approved_at: now,
      versions: [...(current.versions ?? []).filter((v) => v.version !== current.version), snapshot],
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  await logAction({ clinicianId, actionType: 'approved', entityType: 'Document', entityId: id })
  return toApp(row)
}

/**
 * עדכון סעיף אחד. חסום אם המסמך נעול.
 */
export async function updateDocumentSection(id, sectionKey, text, clinicianId, options = {}) {
  const current = await getDocument(id)
  if (!current) throw new Error(`Document ${id} not found`)
  if (current.locked) throw new Error('Document is locked (approved). Create a new version first.')

  const { aiText } = options
  const sections = current.sections.map((s) =>
    s.key === sectionKey ? { ...s, text, ...(typeof aiText === 'string' ? { aiText } : {}) } : s,
  )
  const finalText = sectionsToText(sections)
  const nextStatus =
    current.status === DOCUMENT_STATUS.GENERATED ? DOCUMENT_STATUS.REVIEWED : current.status

  const { data: row, error } = await supabase
    .from('documents')
    .update({ sections, final_text: finalText, status: nextStatus })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  await logAction({ clinicianId, actionType: 'edited', entityType: 'Document', entityId: id })
  return toApp(row)
}

/** פתיחת גרסה חדשה לעריכה ממסמך מאושר. */
export async function createNewVersion(id, clinicianId) {
  const current = await getDocument(id)
  if (!current) throw new Error(`Document ${id} not found`)
  if (!current.locked) return current

  const { data: row, error } = await supabase
    .from('documents')
    .update({
      version: current.version + 1,
      status: DOCUMENT_STATUS.REVIEWED,
      locked: false,
      approved_at: null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  await logAction({ clinicianId, actionType: 'edited', entityType: 'Document', entityId: id })
  return toApp(row)
}

/** רישום ייצוא — מותר רק אחרי אישור. */
export async function logDocumentExport(id, clinicianId) {
  const current = await getDocument(id)
  if (!current) throw new Error(`Document ${id} not found`)
  if (!current.locked) throw new Error('Export is allowed only after approval')
  await logAction({ clinicianId, actionType: 'exported', entityType: 'Document', entityId: id })
}
