import { DOCUMENT_STATUS_CONFIG } from '../../constants/documentStatus'

// תג סטטוס גנרי — משמש בכל מקום שמציג מסמך (רשימות, כרטיסים, מסכי עריכה).
// לעולם לא ממפה צבע/טקסט בעצמו — שואב הכל מ-constants/documentStatus.js.
export default function StatusBadge({ status }) {
  const config = DOCUMENT_STATUS_CONFIG[status]

  if (!config) return null

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.badgeClass}`}
      title={config.description}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} aria-hidden="true" />
      {config.label}
    </span>
  )
}
