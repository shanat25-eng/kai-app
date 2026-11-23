import { supabase } from './supabaseClient'

/**
 * רושם פעולה ביומן הביקורת. נקרא פנימית בלבד ע"י שאר מודולי ה-api.
 * כשל ביומן לא עוצר את הפעולה העיקרית — נרשם לקונסול בלבד.
 */
export async function logAction({ clinicianId, actionType, entityType, entityId }) {
  const { error } = await supabase.from('audit_log').insert({
    clinician_id: clinicianId,
    action_type: actionType,
    entity_type: entityType,
    entity_id: entityId,
  })
  if (error) console.error('kai: audit log failed', error)
}

export async function listAuditLog() {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('timestamp', { ascending: false })
  if (error) throw error
  return data
}
