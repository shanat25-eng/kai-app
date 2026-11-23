// השוואת מילים פשוטה (LCS) בין הנוסח המקורי של ה-AI לבין הנוסח הנוכחי.
// מחזירה קטעים: { text, source: 'ai' | 'clinician' } — לסימון ויזואלי בלבד.
// מילים שה-AI כתב ונמחקו פשוט לא מוצגות (הן כבר לא בטקסט).

const MAX_CELLS = 400000 // הגנה מטקסטים ארוכים מאוד — מעבר לזה מסמנים את כל הסעיף כ"נערך"

// כל טוקן = מילה + הרווח שאחריה, כדי שרווחים לא "יתאימו" לבד ויפצלו את הסימון
function tokenize(s) {
  const lead = s.match(/^\s+/)?.[0] ?? ''
  const words = s.slice(lead.length).match(/\S+\s*/g) ?? []
  return lead ? [lead, ...words] : words
}

const same = (x, y) => x.trim() === y.trim()

export function diffAuthorship(aiText, text) {
  if (aiText === text) return [{ text, source: 'ai' }]
  if (!aiText) return [{ text, source: 'clinician' }]

  const a = tokenize(aiText)
  const b = tokenize(text)
  if (a.length * b.length > MAX_CELLS) return [{ text, source: 'clinician' }]

  // dp[i][j] = אורך LCS של a[i..] ו-b[j..]
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1))
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = same(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const out = []
  const push = (t, source) => {
    const last = out[out.length - 1]
    if (last && last.source === source) last.text += t
    else out.push({ text: t, source })
  }

  let i = 0
  let j = 0
  while (j < b.length) {
    if (i < a.length && same(a[i], b[j])) {
      push(b[j], 'ai')
      i += 1
      j += 1
    } else if (i < a.length && dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1 // מילה של ה-AI שנמחקה
    } else {
      push(b[j], 'clinician')
      j += 1
    }
  }
  return out
}
