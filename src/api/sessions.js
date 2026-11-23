import { supabase } from './supabaseClient'
import { logAction } from './auditLog'

function toApp(row) {
  if (!row) return null
  return {
    id: row.id,
    patientId: row.patient_id,
    sessionDate: row.session_date,
    inputMethod: row.input_method,
    sourceText: row.source_text,
    createdAt: row.created_at,
  }
}

/** @returns {Promise<import('../types/entities').Session[]>} */
export async function listSessionsByPatient(patientId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at')
  if (error) throw error
  return data.map(toApp)
}

/** @returns {Promise<import('../types/entities').Session|null>} */
export async function getSession(id) {
  const { data, error } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return toApp(data)
}

/**
 * @param {{patientId: string, sessionDate: string, inputMethod: import('../types/entities').InputMethod, sourceText: string}} data
 * @param {string} clinicianId
 */
export async function createSession(data, clinicianId) {
  const { data: row, error } = await supabase
    .from('sessions')
    .insert({
      patient_id: data.patientId,
      session_date: data.sessionDate,
      input_method: data.inputMethod,
      source_text: data.sourceText,
    })
    .select()
    .single()
  if (error) throw error
  const session = toApp(row)
  await logAction({ clinicianId, actionType: 'created', entityType: 'Session', entityId: session.id })
  return session
}
