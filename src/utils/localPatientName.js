const PREFIX = 'kai:localname:'

export function getLocalPatientName(displayCode) {
  if (!displayCode) return ''
  try {
    return localStorage.getItem(PREFIX + displayCode) ?? ''
  } catch {
    return ''
  }
}

export function setLocalPatientName(displayCode, name) {
  if (!displayCode) return
  try {
    const trimmed = (name ?? '').trim()
    if (trimmed) {
      localStorage.setItem(PREFIX + displayCode, trimmed)
    } else {
      localStorage.removeItem(PREFIX + displayCode)
    }
  } catch {
    // localStorage not available — fail silently
  }
}
