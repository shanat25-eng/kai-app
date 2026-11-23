import { Clock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

// שלב 6: אזהרה לפני ניתוק אוטומטי (15 דקות ללא פעילות — ראי AuthContext).
export default function IdleWarning() {
  const { idleSecondsLeft, stayActive } = useAuth()
  if (idleSecondsLeft == null) return null
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-slate-900 px-4 py-2 text-sm text-white"
    >
      <Clock className="h-4 w-4" aria-hidden="true" />
      <span>אין פעילות. תנותקי בעוד {idleSecondsLeft} שניות.</span>
      <button
        type="button"
        onClick={stayActive}
        className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-slate-100"
      >
        אני כאן
      </button>
    </div>
  )
}
