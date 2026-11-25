// All fields stored locally only — never sent to Supabase.
// Keyed by patient displayCode: kai:localdetails:<displayCode>
// Backward-compatible: old kai:localname: entries are migrated on first read.

const PREFIX = 'kai:localdetails:'
const LEGACY_PREFIX = 'kai:localname:'

export const FRAMEWORK_OPTIONS = ['', 'רגיל', 'שילוב', 'חינוך מיוחד']

export function getLocalPatientDetails(displayCode) {
  if (!displayCode) return _empty()
  try {
    const raw = localStorage.getItem(PREFIX + displayCode)
    if (raw) return { ..._empty(), ...JSON.parse(raw) }
    // migrate legacy name-only entry
    const legacy = localStorage.getItem(LEGACY_PREFIX + displayCode)
    return { ..._empty(), name: legacy ?? '' }
  } catch {
    return _empty()
  }
}

export function setLocalPatientDetails(displayCode, details) {
  if (!displayCode) return
  try {
    localStorage.setItem(PREFIX + displayCode, JSON.stringify(details))
  } catch {
    // localStorage not available — fail silently
  }
}

// Kept for backward compatibility with DocumentEditScreen export calls
export function getLocalPatientName(displayCode) {
  return getLocalPatientDetails(displayCode).name
}

function _empty() {
  return {
    name: '',
    hearingTestDate: '',
    hearingTestResult: '',
    additionalDiagnoses: '',
    frameworkType: '',
    frameworkRecommendations: '',
  }
}
