import { useState } from 'react'

// אינדיקטור סטטוס מערכת. כרגע ערך קבוע מקומי —
// בעתיד יוחלף בבדיקת health-check אמיתית מול ה-Backend (api/client.js),
// בלי לשנות את ממשק הרכיב כלפי חוץ.
export default function SystemStatusIndicator() {
  const [isOnline] = useState(true)

  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <span
        className={`h-2 w-2 rounded-full ${isOnline ? 'bg-success-500' : 'bg-red-500'}`}
        aria-hidden="true"
      />
      <span>{isOnline ? 'המערכת פעילה' : 'אין חיבור למערכת'}</span>
    </div>
  )
}
