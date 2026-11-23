// מסך שלד בלבד — ראי הערה ב-PatientsScreen.jsx.
export default function DocumentsScreen() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900">מסמכים</h1>
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        כאן תוצג היסטוריית המסמכים (אבחון ראשוני / סיכום מפגש / סיכום סדרה / בקשה להמשך) לאחר חיבור ה-Backend.
      </div>
    </div>
  )
}
