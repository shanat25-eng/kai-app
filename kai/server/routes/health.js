import { Router } from 'express'

const router = Router()

// GET /api/health — בדיקת חיים אמיתית (לא mock). מוכיחה שהשרת חי
// ונגיש, גם ישירות וגם דרך ה-proxy של Vite.
router.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default router
