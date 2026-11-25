import { VIEWS, useAppView } from '../../context/AppViewContext'
import PatientsScreen from '../../screens/PatientsScreen'
import PatientWorkspaceScreen from '../../screens/PatientWorkspaceScreen'
import CreateSessionSummaryScreen from '../../screens/CreateSessionSummaryScreen'
import CreateClinicalDocumentScreen from '../../screens/CreateClinicalDocumentScreen'
import DocumentEditScreen from '../../screens/DocumentEditScreen'
import DocumentsScreen from '../../screens/DocumentsScreen'
import SettingsScreen from '../../screens/SettingsScreen'

// מיפוי בין שם View לרכיב המסך שמציג אותו.
// הוספת מסך חדש בעתיד = שורה אחת כאן, בלי לגעת ב-NavBar או ב-App.
const SCREENS = {
  [VIEWS.PATIENTS]: PatientsScreen,
  [VIEWS.PATIENT_WORKSPACE]: PatientWorkspaceScreen,
  [VIEWS.CREATE_SESSION_SUMMARY]: CreateSessionSummaryScreen,
  [VIEWS.CREATE_CLINICAL_DOCUMENT]: CreateClinicalDocumentScreen,
  [VIEWS.DOCUMENT_EDIT]: DocumentEditScreen,
  [VIEWS.DOCUMENTS]: DocumentsScreen,
  [VIEWS.SETTINGS]: SettingsScreen,
}

export default function ContentArea() {
  const { activeView } = useAppView()
  const ActiveScreen = SCREENS[activeView] ?? PatientsScreen

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <ActiveScreen />
    </main>
  )
}
