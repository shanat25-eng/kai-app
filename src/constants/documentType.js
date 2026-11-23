// מקור אמת יחיד לארבעת סוגי המסמכים במוצר.
// כל רכיב/מסך שצריך להציג או לבדוק סוג מסמך מייבא מכאן.
export const DOCUMENT_TYPE = {
  INITIAL_ASSESSMENT: 'initial_assessment',
  SESSION_SUMMARY: 'session_summary',
  SERIES_SUMMARY: 'series_summary',
  CONTINUATION_REQUEST: 'continuation_request',
}

export const DOCUMENT_TYPE_CONFIG = {
  [DOCUMENT_TYPE.INITIAL_ASSESSMENT]: { label: 'אבחון ראשוני' },
  [DOCUMENT_TYPE.SESSION_SUMMARY]: { label: 'סיכום מפגש' },
  [DOCUMENT_TYPE.SERIES_SUMMARY]: { label: 'סיכום סדרת טיפולים' },
  [DOCUMENT_TYPE.CONTINUATION_REQUEST]: { label: 'בקשה להמשך טיפול' },
}
