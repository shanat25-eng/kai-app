import { DOCUMENT_TYPE_CONFIG } from '../constants/documentType'
import { formatDate } from './formatDate'

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildPrintableHtml({ doc, patient, clinicianName }) {
  const title = DOCUMENT_TYPE_CONFIG[doc.documentType]?.label ?? 'מסמך קליני'
  const approvedDate = doc.approvedAt ? formatDate(doc.approvedAt) : formatDate(doc.createdAt)
  const sectionsHtml = (doc.sections ?? [])
    .map(
      (s) => `
      <section class="section">
        <h2>${escapeHtml(s.label)}</h2>
        <div class="body">${escapeHtml(s.text || '').replace(/\n/g, '<br/>')}</div>
      </section>`,
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} — ${escapeHtml(patient?.displayCode ?? '')}</title>
<style>
  @page { size: A4; margin: 18mm 18mm 20mm 18mm; }
  body {
    font-family: 'David', 'Arial', 'Segoe UI', Tahoma, sans-serif;
    direction: rtl;
    text-align: right;
    color: #1e293b;
    line-height: 1.65;
    font-size: 12pt;
    margin: 0;
    padding: 0;
    background: #ffffff;
  }
  .page {
    max-width: 720px;
    margin: 0 auto;
    padding: 16px 8px;
  }
  .bsd {
    text-align: right;
    font-size: 10pt;
    color: #64748b;
    margin-bottom: 6px;
  }
  .header {
    border-bottom: 2px solid #4f46e5;
    padding-bottom: 12px;
    margin-bottom: 18px;
  }
  .header h1 {
    margin: 0 0 8px 0;
    font-size: 18pt;
    color: #1e1b4b;
  }
  .meta {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5pt;
    color: #475569;
  }
  .meta td {
    padding: 3px 0 3px 16px;
  }
  .meta strong {
    color: #0f172a;
  }
  .section {
    margin-bottom: 16px;
    page-break-inside: avoid;
  }
  .section h2 {
    margin: 0 0 6px 0;
    font-size: 12.5pt;
    color: #3730a3;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 3px;
  }
  .section .body {
    font-size: 11.5pt;
    color: #1e293b;
    white-space: normal;
  }
  .footer {
    margin-top: 28px;
    padding-top: 10px;
    border-top: 1px solid #cbd5e1;
    font-size: 9.5pt;
    color: #64748b;
    display: flex;
    justify-content: space-between;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="bsd">בס"ד</div>
    <div class="header">
      <h1>${escapeHtml(title)}</h1>
      <table class="meta">
        <tr>
          <td><strong>קוד מטופל/ת:</strong> ${escapeHtml(patient?.displayCode ?? '—')}</td>
          <td><strong>קבוצת גיל:</strong> ${escapeHtml(patient?.ageRange ?? '—')}</td>
        </tr>
        <tr>
          <td><strong>תחום טיפול:</strong> ${escapeHtml(patient?.treatmentArea ?? '—')}</td>
          <td><strong>תאריך אישור:</strong> ${escapeHtml(approvedDate)} · גרסה ${escapeHtml(doc.version)}</td>
        </tr>
      </table>
    </div>
    ${sectionsHtml}
    <div class="footer">
      <span>${clinicianName ? `קלינאית: ${escapeHtml(clinicianName)}` : 'תיעוד קליני — K.ai'}</span>
      <span>אושר על ידי הקלינאית · ${escapeHtml(approvedDate)}</span>
    </div>
  </div>
</body>
</html>`
}

export function downloadDocumentAsWord({ doc, patient, clinicianName }) {
  const html = buildPrintableHtml({ doc, patient, clinicianName })
  const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl" lang="he">${html.slice(html.indexOf('<head>'))}`
  const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = window.document.createElement('a')
  const safeCode = (patient?.displayCode ?? 'doc').replace(/[^\w\u0590-\u05ff-]+/g, '_')
  const typeTag = doc.documentType ?? 'doc'
  a.href = url
  a.download = `kai-${typeTag}-${safeCode}-v${doc.version}.doc`
  a.click()
  URL.revokeObjectURL(url)
}

export function printDocumentAsPdf({ doc, patient, clinicianName }) {
  const html = buildPrintableHtml({ doc, patient, clinicianName })
  const win = window.open('', '_blank', 'width=820,height=950')
  if (!win) {
    throw new Error('הדפדפן חסם חלון קופץ — אפשרי חלונות קופצים או הורידי ל-Word')
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
  }, 300)
}
