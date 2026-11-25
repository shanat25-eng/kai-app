import { requireAuthenticatedUser } from './_auth.js'
export const config = {
  api: {
    bodyParser: false,
  },
}

const MOCK_TRANSCRIPT = '[MOCK] זהו תמלול לדוגמה — לא תוצאה אמיתית של תמלול'

async function readRawBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authUser = await requireAuthenticatedUser(req, res)
  if (!authUser) return

  let file
  try {
    const rawBuf = await readRawBody(req)
    const contentType = req.headers['content-type'] || ''
    const form = await new Response(rawBuf, {
      headers: { 'content-type': contentType },
    }).formData()
    file = form.get('file')
  } catch (err) {
    console.error('kai-api: multipart parse failed', err)
    return res.status(400).json({ error: 'Failed to parse multipart form-data' })
  }

  if (!file || typeof file === 'string') {
    return res.status(400).json({ error: 'file is required (multipart/form-data, field name "file")' })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(200).json({ _mock: true, transcript: MOCK_TRANSCRIPT })
  }

  try {
    const audioBytes = await file.arrayBuffer()
    const filename = file.name || 'recording.webm'
    const mimeType = file.type || 'audio/webm'

    const outForm = new FormData()
    outForm.append('file', new Blob([audioBytes], { type: mimeType }), filename)
    outForm.append('model', 'whisper-1')
    outForm.append('language', 'he')
    outForm.append('prompt', 'היום, אחרי הצהריים, ישבנו יחד ודיברנו על כמה דברים.')

    const aiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: outForm,
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => '')
      console.error('kai-api: Whisper error', aiRes.status, errText.slice(0, 300))
      return res.status(502).json({ error: 'Transcription failed', detail: `OpenAI HTTP ${aiRes.status}` })
    }

    const data = await aiRes.json()
    return res.status(200).json({ _mock: false, transcript: data.text ?? '' })
  } catch (err) {
    console.error('kai-api: Whisper transcription failed', err)
    return res.status(502).json({ error: 'Transcription failed', detail: err.message })
  }
}
