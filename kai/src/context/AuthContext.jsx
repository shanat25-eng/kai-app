import { createContext, useContext, useState } from 'react'

// משתמשת קבועה יחידה ל-MVP (קלינאית אחת בכל חשבון, בהתאם ל-PRD).
// אין ספק אימות חיצוני (כמו Google Login) — בכוונה: כל תלות בדומיין
// חיצוני להתחברות עלולה להיחסם ברשתות מסוננות (נטפרי/רימון וכו'),
// ראי README ופרק "התאמה לאינטרנט מסונן" ב-PRD.
//
// ⚠️ הערה קריטית: זו בדיקת MVP מקומית בלבד, לא מנגנון אבטחה אמיתי.
// הסיסמה מקודדת בקוד (hardcoded) ואינה מוצפנת. זה תקין לשלד פיתוח
// מקומי בלבד — אסור להשתמש בזה מול נתוני מטופלים אמיתיים לפני שיש
// Backend עם אימות אמיתי. כשיגיע אותו Backend, רק login()/logout()
// כאן יוחלפו בקריאות API אמיתיות — useAuth() כלפי חוץ לא ישתנה.

const FIXED_CLINICIAN = {
  id: 'clinician-1',
  fullName: 'תמר',
  role: 'קלינאית תקשורת',
}

const MVP_LOCAL_CREDENTIALS = {
  email: 'tamar@kai.local',
  password: 'kai-demo',
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState(null)

  function login(email, password) {
    const isValid =
      email.trim().toLowerCase() === MVP_LOCAL_CREDENTIALS.email &&
      password === MVP_LOCAL_CREDENTIALS.password

    if (!isValid) {
      setError('אימייל או סיסמה שגויים')
      return false
    }

    setError(null)
    setIsAuthenticated(true)
    return true
  }

  function logout() {
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        clinician: isAuthenticated ? FIXED_CLINICIAN : null,
        login,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
