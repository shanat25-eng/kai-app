import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // מפנה כל קריאת /api/* מה-Vite dev server (5173) ל-Backend (server/,
  // שלב 7). משמש רק בפיתוח מקומי — לא נוגע ב-UI.
  // ⚠️ 3002 ולא 3001: תואם ל-PORT שהוגדר בפועל ב-server/.env. אם ה-PORT
  // שם ישתנה, צריך לעדכן גם כאן (אין קישור אוטומטי בין שני הקבצים).
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
})
