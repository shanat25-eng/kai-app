import React from 'react'
import ReactDOM from 'react-dom/client'
// טעינת הפונט מקומית דרך npm — לא מ-CDN חיצוני (Google Fonts וכו').
// זו דרישה מכוונת של תאימות-סינון (ראי README ופרק ה-PRD "התאמה לאינטרנט מסונן"):
// דפדפן הקלינאית לא אמור לפנות לשום דומיין חיצוני מעבר לדומיין של K.ai עצמו.
import '@fontsource/heebo/400.css'
import '@fontsource/heebo/500.css'
import '@fontsource/heebo/700.css'
import '@fontsource/heebo/800.css'
import './index.css'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
