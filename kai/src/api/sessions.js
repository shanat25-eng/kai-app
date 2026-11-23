import { storage } from './storage'
import { logAction } from './auditLog'

const COLLECTION_KEY = 'sessions'

/** @returns {Promise<import('../types/entities').Session[]>} */
export async function listSessionsByPatient(patientId) {
  const sessions = storage.readCollection(COLLECTION_KEY)
  return sessions.filter((s) => s.patientId === patientId)
}

/** @returns {Promise<import('../types/entities').Session|null>} */
export async function getSession(id) {
  const sessions = storage.readCollection(COLLECTION_KEY)
  return sessions.find((s) => s.id === id) ?? null
}

/**
 * @param {{patientId: string, sessionDate: string, inputMethod: import('../types/entities').InputMethod, sourceText: string}} data
 * @param {string} clinicianId
 * @returns {Promise<import('../types/entities').Session>}
 */
export async function createSession(data, clinicianId) {
  const sessions = storage.readCollection(COLLECTION_KEY)

  const newSession = {
    id: storage.generateId('session'),
    patientId: data.patientId,
    sessionDate: data.sessionDate,
    inputMethod: data.inputMethod,
    sourceText: data.sourceText,
    createdAt: new Date().toISOString(),
  }

  storage.writeCollection(COLLECTION_KEY, [...sessions, newSession])
  logAction({ clinicianId, actionType: 'created', entityType: 'Session', entityId: newSession.id })

  return newSession
}
