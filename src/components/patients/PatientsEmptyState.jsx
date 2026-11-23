import { UserRoundPlus } from 'lucide-react'

// מצב ריק שמזמין פעולה, לא רק מודיע "אין נתונים" (בהתאם לעקרון
// "מסך ריק הוא הזמנה לפעולה" — ראי frontend-design skill).
// מוצג רק כש-listPatients() מחזיר מערך ריק אמיתי, לא כתוצאה מסינון/חיפוש
// (למקרה הזה יש הודעה נפרדת וקצרה בתוך PatientsScreen).
export default function PatientsEmptyState({ onAddPatient }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
        <UserRoundPlus className="h-7 w-7 text-brand-600" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <h2 className="text-base font-bold text-slate-900">עדיין אין מטופלים במערכת</h2>
        <p className="max-w-sm text-sm text-slate-500">
          הוסיפי מטופל ראשון כדי להתחיל לתעד מפגשים וליצור מסמכים. כל מטופל מזוהה בקוד בלבד — לעולם לא בשם.
        </p>
      </div>

      <button
        type="button"
        onClick={onAddPatient}
        className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        הוספת מטופל ראשון
      </button>
    </div>
  )
}
