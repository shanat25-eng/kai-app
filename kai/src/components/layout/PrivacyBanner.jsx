import { ShieldAlert } from 'lucide-react'

// באנר פרטיות קבוע ובולט (כלל ברזל #1: Strict Anonymization).
// מכוון להישאר תמיד גלוי, לא ניתן לסגירה — זו תזכורת תפעולית קבועה,
// לא הודעת מערכת חד-פעמית.
export default function PrivacyBanner() {
  return (
    <div className="w-full border-b border-caution-200 bg-caution-50 px-4 py-2">
      <div className="mx-auto flex max-w-6xl items-center gap-2 text-sm text-caution-700">
        <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="font-medium">
          אין להזין שם מלא, תעודת זהות או כל פרט מזהה אחר של מטופל. זיהוי מטופלים מתבצע לפי קוד/כינוי בלבד.
        </p>
      </div>
    </div>
  )
}
