// קובץ תיעוד טיפוסים (JSDoc), לא TypeScript בפועל — כדי לא להוסיף כלי-בנייה
// נוסף לפרויקט בשלב הזה, אבל עדיין לתת לעורך (VS Code וכו') Autocomplete
// ובדיקת טיפוסים בסיסית. אם בעתיד יוחלט לעבור ל-TypeScript, הטיפוסים האלה
// מתורגמים כמעט 1:1 ל-interface.
//
// ⚠️ שימו לב: Patient לעולם לא כולל שם מלא / ת.ז / פרטי קשר — ראי displayCode.

/**
 * @typedef {Object} Patient
 * @property {string} id
 * @property {string} displayCode   // קוד/כינוי בלבד — לעולם לא שם אמיתי
 * @property {string} ageRange
 * @property {string} treatmentArea
 * @property {string} [notes]       // ⚠️ שדה חופשי — אין להזין בו מידע מזהה
 * @property {string} createdAt
 */

/** @typedef {'recording'|'typed'} InputMethod */

/**
 * @typedef {Object} Session
 * @property {string} id
 * @property {string} patientId
 * @property {string} sessionDate
 * @property {InputMethod} inputMethod
 * @property {string} sourceText
 * @property {string} createdAt
 */

/** @typedef {'initial_assessment'|'session_summary'|'series_summary'|'continuation_request'} DocumentType */
/** @typedef {'generated'|'reviewed'|'approved'} DocumentStatus */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} passed
 * @property {string[]} issues     // תיאור קצר לכל בעיה שנמצאה (ריק אם passed=true)
 * @property {string} [checkedAt]
 */

/**
 * @typedef {Object} Document
 * @property {string} id
 * @property {string} patientId
 * @property {DocumentType} documentType
 * @property {DocumentStatus} status
 * @property {string|null} [sourceText]        // רלוונטי ל-initial_assessment / session_summary
 * @property {string|null} [sessionId]         // רלוונטי ל-session_summary בלבד
 * @property {string[]} sourceDocuments        // Traceability — ל-series_summary / continuation_request
 * @property {string[]} sourceSessions         // Traceability
 * @property {string} generatedText
 * @property {string} finalText
 * @property {ValidationResult|null} validationResult
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/** @typedef {'created'|'edited'|'approved'|'exported'|'deleted'} AuditActionType */
/** @typedef {'Patient'|'Session'|'Document'} AuditEntityType */

/**
 * @typedef {Object} AuditLogEntry
 * @property {string} id
 * @property {string} clinicianId
 * @property {AuditActionType} actionType
 * @property {AuditEntityType} entityType
 * @property {string} entityId
 * @property {string} timestamp
 */

export {}
