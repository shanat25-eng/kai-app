import { DOCUMENT_TYPE_CONFIG } from '../constants/documentType'
import { formatDate } from './formatDate'

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildPrintableHtml({ doc, patient, clinicianName, licenseNumber, localPatientName, localDetails }) {
  const d = localDetails ?? {}
  const name = localPatientName || d.name || ''
  const title = DOCUMENT_TYPE_CONFIG[doc.documentType]?.label ?? 'מסמך קליני'
  const approvedDate = doc.approvedAt ? formatDate(doc.approvedAt) : formatDate(doc.createdAt)
  const sectionsHtml = (doc.sections ?? [])
    .map(
      (s) => `
      <section class="section">
        <h2>${escapeHtml(s.label)}:</h2>
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
  .top-row {
    display: flex;
    justify-content: space-between;
    font-size: 10.5pt;
    color: #475569;
    margin-bottom: 8px;
  }
  .header {
    border-bottom: 2px solid #4f46e5;
    padding-bottom: 12px;
    margin-bottom: 18px;
  }
  .header h1 {
    margin: 0 0 10px 0;
    font-size: 17pt;
    color: #1e1b4b;
    text-align: center;
  }
  .meta {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5pt;
    color: #334155;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }
  .meta td {
    padding: 5px 10px;
    border: 1px solid #e2e8f0;
    width: 50%;
  }
  .meta strong {
    color: #0f172a;
  }
  .section {
    margin-bottom: 15px;
    page-break-inside: avoid;
  }
  .section h2 {
    margin: 0 0 5px 0;
    font-size: 12.5pt;
    color: #1e1b4b;
    text-decoration: underline;
  }
  .section .body {
    font-size: 11.5pt;
    color: #1e293b;
  }
  .signature {
    margin-top: 28px;
    page-break-inside: avoid;
    font-size: 11.5pt;
    line-height: 1.7;
  }
  .footer-note {
    margin-top: 20px;
    padding-top: 8px;
    border-top: 1px solid #cbd5e1;
    font-size: 9pt;
    color: #64748b;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="top-row">
      <span>בס"ד</span>
      <span>תאריך: ${escapeHtml(approvedDate)}</span>
    </div>
    <div class="header">
      <h1>${escapeHtml(title)}</h1>
      <table class="meta">
        <tr>
          <td><strong>שם המטופל/ת:</strong> ${name ? escapeHtml(name) : '_______________________'}</td>
          <td><strong>ת.ז.:</strong> ${d.idNumber ? escapeHtml(d.idNumber) : '___________________'}</td>
        </tr>
        <tr>
          <td><strong>תאריך לידה:</strong> ${d.birthDate ? escapeHtml(d.birthDate) : '_______________'}</td>
          <td><strong>קופת חולים:</strong> ${d.healthFund ? escapeHtml(d.healthFund) : '_______________'}</td>
        </tr>
        <tr>
          <td><strong>קבוצת גיל:</strong> ${escapeHtml(patient?.ageRange ?? '—')}</td>
          <td><strong>תחום טיפול:</strong> ${escapeHtml(patient?.treatmentArea ?? '—')}</td>
        </tr>
        ${d.parentNames ? `<tr><td colspan="2"><strong>שמות הורים:</strong> ${escapeHtml(d.parentNames)}</td></tr>` : ''}
        ${d.referralSource ? `<tr><td colspan="2"><strong>גורם מפנה:</strong> ${escapeHtml(d.referralSource)}</td></tr>` : ''}
        ${d.address ? `<tr><td colspan="2"><strong>כתובת:</strong> ${escapeHtml(d.address)}</td></tr>` : ''}
        <tr>
          <td><strong>סוג מסגרת:</strong> ${d.frameworkType ? escapeHtml(d.frameworkType) : '_______________'}</td>
          <td><strong>בדיקת שמיעה:</strong> ${d.hearingTestDate || d.hearingTestResult
            ? `${escapeHtml(d.hearingTestDate ?? '')} ${escapeHtml(d.hearingTestResult ?? '')}`.trim()
            : '_______________'}</td>
        </tr>
        ${d.additionalDiagnoses ? `<tr><td colspan="2"><strong>אבחונים נוספים:</strong> ${escapeHtml(d.additionalDiagnoses)}</td></tr>` : ''}
        ${d.frameworkRecommendations ? `<tr><td colspan="2"><strong>המלצות למסגרת:</strong> ${escapeHtml(d.frameworkRecommendations)}</td></tr>` : ''}
      </table>
    </div>
    ${sectionsHtml}
    <div class="signature">
      <div>בברכה,</div>
      <table style="width:100%;margin-top:14px;border-collapse:collapse;">
        <tr>
          <td style="width:50%;padding:4px 8px 4px 0;vertical-align:top;">
            <div style="font-size:10.5pt;color:#475569;margin-bottom:2px;">שם הבודקת:</div>
            <div style="font-weight:bold;">${clinicianName ? escapeHtml(clinicianName) : '_______________________'}</div>
            <div style="font-size:10pt;color:#475569;">קלינאית תקשורת</div>
            <div style="font-size:10pt;color:#475569;">מ.ר. ${licenseNumber ? escapeHtml(licenseNumber) : '____________'}</div>
          </td>
          <td style="width:50%;padding:4px 0 4px 8px;vertical-align:top;border-right:1px solid #e2e8f0;">
            <div style="font-size:10.5pt;color:#475569;margin-bottom:2px;">תאריך:</div>
            <div>${escapeHtml(approvedDate)}</div>
            <div style="margin-top:28px;border-bottom:1px solid #334155;width:140px;">&nbsp;</div>
            <div style="font-size:9pt;color:#64748b;margin-top:3px;">חתימה וחותמת</div>
          </td>
        </tr>
      </table>
    </div>
    <div class="footer-note" style="text-align:center;">
      הופק באמצעות K.ai &nbsp;|&nbsp; &copy; 2026 K.ai &nbsp;|&nbsp; פיילוט — לשימוש בדיקה בלבד
    </div>
  </div>
</body>
</html>`
}

export function downloadDocumentAsWord({ doc, patient, clinicianName, licenseNumber, localPatientName, localDetails }) {
  const html = buildPrintableHtml({ doc, patient, clinicianName, licenseNumber, localPatientName, localDetails })
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

export function printDocumentAsPdf({ doc, patient, clinicianName, licenseNumber, localPatientName, localDetails }) {
  const html = buildPrintableHtml({ doc, patient, clinicianName, licenseNumber, localPatientName, localDetails })
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
