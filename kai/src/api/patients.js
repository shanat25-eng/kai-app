import { storage } from './storage'
import { logAction } from './auditLog'

const COLLECTION_KEY = 'patients'

// כל הפונקציות כאן מחזירות Promise בכוונה, גם שהיישום הנוכחי סינכרוני —
// כך שכשיוחלפו בקריאות fetch אמיתיות מול Backend, אף מסך שכבר עושה
// await listPatients() וכו' לא יצטרך להשתנות.

/** @returns {Promise<import('../types/entities').Patient[]>} */
export async function listPatients() {
  return storage.readCollection(COLLECTION_KEY)
}

/** @returns {Promise<import('../types/entities').Patient|null>} */
export async function getPatient(id) {
  const patients = storage.readCollection(COLLECTION_KEY)
  return patients.find((p) => p.id === id) ?? null
}

/**
 * @param {{displayCode: string, ageRange: string, treatmentArea: string, notes?: string}} data
 * @param {string} clinicianId
 * @returns {Promise<import('../types/entities').Patient>}
 */
export async function createPatient(data, clinicianId) {
  const patients = storage.readCollection(COLLECTION_KEY)

  const newPatient = {
    id: storage.generateId('patient'),
    displayCode: data.displayCode,
    ageRange: data.ageRange,
    treatmentArea: data.treatmentArea,
    notes: data.notes ?? '',
    createdAt: new Date().toISOString(),
  }

  storage.writeCollection(COLLECTION_KEY, [...patients, newPatient])
  logAction({ clinicianId, actionType: 'created', entityType: 'Patient', entityId: newPatient.id })

  return newPatient
}

/** @returns {Promise<import('../types/entities').Patient>} */
export async function updatePatient(id, updates, clinicianId) {
  const patients = storage.readCollection(COLLECTION_KEY)
  const index = patients.findIndex((p) => p.id === id)
  if (index === -1) throw new Error(`Patient ${id} not found`)

  const updated = { ...patients[index], ...updates }
  const next = [...patients]
  next[index] = updated

  storage.writeCollection(COLLECTION_KEY, next)
  logAction({ clinicianId, actionType: 'edited', entityType: 'Patient', entityId: id })

  return updated
}

export async function deletePatient(id, clinicianId) {
  const patients = storage.readCollection(COLLECTION_KEY)
  storage.writeCollection(
    COLLECTION_KEY,
    patients.filter((p) => p.id !== id),
  )
  logAction({ clinicianId, actionType: 'deleted', entityType: 'Patient', entityId: id })
}
