import { Users, FileText, Settings } from 'lucide-react'
import { VIEWS, useAppView } from '../../context/AppViewContext'

const NAV_ITEMS = [
  { key: VIEWS.PATIENTS, label: 'מטופלים', icon: Users },
  { key: VIEWS.DOCUMENTS, label: 'מסמכים', icon: FileText },
  { key: VIEWS.SETTINGS, label: 'הגדרות', icon: Settings },
]

export default function NavBar() {
  const { activeView, setActiveView } = useAppView()

  return (
    <nav className="w-full border-b border-slate-200 bg-white px-4">
      <div className="mx-auto flex max-w-6xl gap-1">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const isActive = activeView === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveView(key)}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
