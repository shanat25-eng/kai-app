import { useAuth } from '../../context/AuthContext'
import LoginScreen from '../../screens/LoginScreen'

// עוטף כל תוכן שדורש משתמשת מחוברת. אם אין חיבור — מוצג מסך הכניסה
// במקום children, כך שה-Layout הראשי (Banner/Header/Nav/Content) ונתוני
// המטופלים לעולם לא נטענים/מוצגים למי שלא התחבר.
export default function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return children
}
