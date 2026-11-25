// Health endpoint for Vercel deployment checks
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  res.status(200).json({
    status: 'ok',
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    v: 2,
    timestamp: new Date().toISOString(),
  })
}
