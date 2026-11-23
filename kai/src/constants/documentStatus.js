// מקור אמת יחיד לסטטוסי מסמך (כלל ברזל #2: Clinical Safety & Audit Trail).
// כל רכיב שצריך להציג/לבדוק סטטוס מסמך מייבא מכאן — אסור לשכפל את המחרוזות
// או את מיפוי הצבעים בקומפוננטות בודדות.

export const DOCUMENT_STATUS = {
  GENERATED: 'generated',
  REVIEWED: 'reviewed',
  APPROVED: 'approved',
}

export const DOCUMENT_STATUS_CONFIG = {
  [DOCUMENT_STATUS.GENERATED]: {
    label: 'נוצר',
    description: 'נוצר על ידי K.ai, טרם נבדק על ידי הקלינאית',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    dotClass: 'bg-slate-400',
  },
  [DOCUMENT_STATUS.REVIEWED]: {
    label: 'נבדק',
    description: 'הקלינאית צפתה ו/או ערכה את המסמך, טרם אישרה סופית',
    badgeClass: 'bg-brand-50 text-brand-700 border-brand-200',
    dotClass: 'bg-brand-500',
  },
  [DOCUMENT_STATUS.APPROVED]: {
    label: 'מאושר',
    description: 'אושר סופית על ידי הקלינאית — המצב היחיד שנחשב מסמך תקף',
    badgeClass: 'bg-success-50 text-success-700 border-success-200',
    dotClass: 'bg-success-600',
  },
}
