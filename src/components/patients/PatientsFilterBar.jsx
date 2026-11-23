import { Search } from 'lucide-react'
import { TREATMENT_AREA_OPTIONS } from '../../constants/patientOptions'

// חיפוש חופשי לפי displayCode + סינון לפי treatmentArea.
// state נשמר ב-PatientsScreen (הרכיב הזה "מטומטם" — controlled בלבד) —
// כדי שגם מצב הריק-כתוצאה-מסינון וגם רשימת הכרטיסים ידעו את אותו state.
export default function PatientsFilterBar({
  searchValue,
  onSearchChange,
  treatmentAreaFilter,
  onTreatmentAreaFilterChange,
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="חיפוש לפי קוד מטופל..."
          className="w-full rounded-lg border border-slate-300 bg-white py-2 ps-9 pe-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <select
        value={treatmentAreaFilter}
        onChange={(e) => onTreatmentAreaFilterChange(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-56"
      >
        <option value="">כל תחומי הטיפול</option>
        {TREATMENT_AREA_OPTIONS.map((area) => (
          <option key={area} value={area}>
            {area}
          </option>
        ))}
      </select>
    </div>
  )
}
