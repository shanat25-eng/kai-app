import { supabase } from './supabaseClient'
import { logAction } from './auditLog'

function toApp(row) {
  if (!row) return null
  return {
    id: row.id,
    displayCode: row.display_code,
    ageRange: row.age_range,
    treatmentArea: row.treatment_area,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

/** @returns {Promise<import('../types/entities').Patient[]>} */
export async function listPatients() {
  const { data, error } = await supabase.from('patients').select('*').order('created_at')
  if (error) throw error
  return data.map(toApp)
}

/** @returns {Promise<import('../types/entities').Patient|null>} */
export async function getPatient(id) {
  const { data, error } = await supabase.from('patients').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return toApp(data)
}

/**
 * @param {{displayCode: string, ageRange: string, treatmentArea: string, notes?: string}} data
 * @param {string} clinicianId
 */
export async function createPatient(data, clinicianId) {
  const { data: row, error } = await supabase
    .from('patients')
    .insert({
      display_code: data.displayCode,
      age_range: data.ageRange,
      treatment_area: data.treatmentArea,
      notes: data.notes ?? '',
    })
    .select()
    .single()
  if (error) throw error
  const patient = toApp(row)
  await logAction({ clinicianId, actionType: 'created', entityType: 'Patient', entityId: patient.id })
  return patient
}

/** @returns {Promise<import('../types/entities').Patient>} */
export async function updatePatient(id, updates, clinicianId) {
  const dbUpdates = {}
  if (updates.displayCode !== undefined) dbUpdates.display_code = updates.displayCode
  if (updates.ageRange !== undefined) dbUpdates.age_range = updates.ageRange
  if (updates.treatmentArea !== undefined) dbUpdates.treatment_area = updates.treatmentArea
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes

  const { data: row, error } = await supabase
    .from('patients')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  const patient = toApp(row)
  await logAction({ clinicianId, actionType: 'edited', entityType: 'Patient', entityId: id })
  return patient
}

export async function deletePatient(id, clinicianId) {
  const { error } = await supabase.from('patients').delete().eq('id', id)
  if (error) throw error
  await logAction({ clinicianId, actionType: 'deleted', entityType: 'Patient', entityId: id })
}
