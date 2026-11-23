import { storage } from './storage'

const COLLECTION_KEY = 'auditLog'

/**
 * רושם פעולה ביומן הביקורת. נקרא פנימית ע"י api/patients.js, api/sessions.js
 * ו-api/documents.js בלבד — אין צורך (ואין טעם) לקרוא לזה ישירות ממסכי ה-UI.
 * @param {{clinicianId: string, actionType: import('../types/entities').AuditActionType, entityType: import('../types/entities').AuditEntityType, entityId: string}} entry
 */
export function logAction({ clinicianId, actionType, entityType, entityId }) {
  const entries = storage.readCollection(COLLECTION_KEY)

  const newEntry = {
    id: storage.generateId('audit'),
    clinicianId,
    actionType,
    entityType,
    entityId,
    timestamp: new Date().toISOString(),
  }

  storage.writeCollection(COLLECTION_KEY, [...entries, newEntry])
  return newEntry
}

export function listAuditLog() {
  return storage.readCollection(COLLECTION_KEY)
}
