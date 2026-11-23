import { LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import SystemStatusIndicator from './SystemStatusIndicator'

export default function Header() {
  const { clinician, logout } = useAuth()

  return (
    <header className="w-full border-b border-slate-200 bg-white px-4 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-extrabold text-brand-700">k.ai</span>
          <span className="text-sm text-slate-500">עוזר תיעוד קליני לקלינאיות תקשורת</span>
        </div>

        <div className="flex items-center gap-4">
          <SystemStatusIndicator />

          {clinician && (
            <div className="flex items-center gap-3 border-r border-slate-200 pr-4">
              <span className="text-sm text-slate-700">
                שלום, <span className="font-medium">{clinician.fullName}</span>
              </span>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                יציאה
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
