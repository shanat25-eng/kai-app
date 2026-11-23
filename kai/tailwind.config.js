/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // צבע מותג/פעולה מרכזי
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
        },
        // צבע סטטוס "מאושר" — מחובר ישירות ל-Audit Trail (generated -> reviewed -> approved)
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        // צבע פונקציונלי לאזהרות (בעיקר באנר הפרטיות) — מכוון שלא יתבלבל עם success
        caution: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
      },
      fontFamily: {
        sans: ['Heebo', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
