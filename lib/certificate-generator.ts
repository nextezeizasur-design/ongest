// lib/certificate-generator.ts
// Genera el certificado PDF usando una ventana de impresión del browser.
// No requiere ninguna librería externa — funciona en Vercel sin configuración.

export interface CertificateData {
  studentName: string
  evalTitle:   string
  score:       number
  passed?:     boolean   // opcional — default true para retrocompatibilidad
  cefrLevel:   string | null
  issuedBy:    string
  orgName:     string
  verifyHash:  string
  issuedAt:    string
}

export async function generateCertificate(data: CertificateData): Promise<void> {
  const {
    studentName,
    evalTitle,
    score,
    passed = true,
    cefrLevel,
    issuedBy,
    orgName,
    verifyHash,
    issuedAt,
  } = data

  const dateStr = new Date(issuedAt).toLocaleDateString('es-AR', {
    day:   '2-digit',
    month: 'long',
    year:  'numeric',
  })

  const verifyUrl = `${window.location.origin}/verify/${verifyHash}`

  // Textos y colores según aprobado/desaprobado
  const headerTitle    = passed ? 'Certificado de Logro'      : 'Constancia de Evaluación'
  const headerGradient = passed
    ? 'linear-gradient(135deg, #642f8d 0%, #4e2470 100%)'
    : 'linear-gradient(135deg, #4b5563 0%, #374151 100%)'
  const accentColor    = passed ? '#642f8d' : '#6b7280'
  const accentLight    = passed ? '#f9f5ff' : '#f9fafb'
  const accentBorder   = passed ? '#e9d5ff' : '#e5e7eb'
  const descText       = passed
    ? `completó exitosamente la evaluación <strong style="color:${accentColor}">${evalTitle}</strong> demostrando el nivel de conocimiento requerido.`
    : `participó en la evaluación <strong style="color:${accentColor}">${evalTitle}</strong>. El puntaje obtenido no alcanzó el mínimo de aprobación.`
  const statusValue    = passed ? '✓' : '✗'
  const statusLabel    = passed ? 'Aprobado' : 'Desaprobado'
  const statusColor    = passed ? '#16a34a' : '#dc2626'
  const sealEmoji      = passed ? '🏅' : '📄'
  const sealText       = passed ? 'Certificado<br>Verificado' : 'Constancia<br>Emitida'

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${passed ? 'Certificado' : 'Constancia'} — ${evalTitle}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', sans-serif;
      background: #f3f4f6;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      min-height: 100vh;
      padding: 20px 20px 100px;
      gap: 20px;
    }

    .cert {
      width: 842px;
      min-height: 595px;
      background: #fff;
      border: 2px solid ${accentColor};
      border-radius: 12px;
      overflow: hidden;
      position: relative;
      box-shadow: 0 4px 40px rgba(100,47,141,0.15);
    }

    .cert::before {
      content: '';
      position: absolute;
      inset: 8px;
      border: 1px solid #d4b96640;
      border-radius: 8px;
      pointer-events: none;
      z-index: 0;
    }

    .cert-header {
      background: ${headerGradient};
      padding: 32px 48px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      z-index: 1;
    }

    .cert-header-left h1 {
      font-family: 'Playfair Display', serif;
      font-size: 13px;
      font-weight: 400;
      color: #d4b966;
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .cert-header-left h2 {
      font-family: 'Playfair Display', serif;
      font-size: 26px;
      font-weight: 700;
      color: #fff;
    }

    .cert-logo {
      width: 56px;
      height: 56px;
      background: rgba(255,255,255,0.15);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
    }

    .cert-body {
      padding: 40px 48px 32px;
      position: relative;
      z-index: 1;
    }

    .cert-label {
      font-size: 11px;
      font-weight: 600;
      color: #9ca3af;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .cert-student {
      font-family: 'Playfair Display', serif;
      font-size: 36px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 6px;
      line-height: 1.2;
    }

    .cert-desc {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 28px;
      line-height: 1.5;
    }

    .cert-metrics {
      display: flex;
      gap: 20px;
      margin-bottom: 32px;
    }

    .cert-metric {
      background: ${accentLight};
      border: 1px solid ${accentBorder};
      border-radius: 10px;
      padding: 14px 20px;
      text-align: center;
      min-width: 110px;
    }

    .cert-metric-value {
      font-size: 24px;
      font-weight: 700;
      color: ${accentColor};
      line-height: 1;
      margin-bottom: 4px;
    }

    .cert-metric-label {
      font-size: 10px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .cert-divider {
      height: 1px;
      background: linear-gradient(to right, ${accentColor}20, #d4b96640, ${accentColor}20);
      margin-bottom: 24px;
    }

    .cert-footer {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 20px;
    }

    .cert-sign { flex: 1; }
    .cert-sign-line { width: 140px; height: 1px; background: #d1d5db; margin-bottom: 6px; }
    .cert-sign-name { font-weight: 600; font-size: 13px; color: #1f2937; }
    .cert-sign-role { font-size: 11px; color: #9ca3af; margin-top: 2px; }
    .cert-date { font-size: 12px; color: #6b7280; margin-top: 4px; }

    .cert-verify { text-align: right; flex: 1; }
    .cert-verify-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .cert-verify-hash { font-family: monospace; font-size: 10px; color: ${accentColor}; word-break: break-all; }
    .cert-verify-url { font-size: 10px; color: #9ca3af; margin-top: 2px; }

    .cert-seal {
      width: 80px; height: 80px;
      border: 3px solid ${accentColor};
      border-radius: 50%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      flex-shrink: 0;
      background: ${accentLight};
    }
    .cert-seal-emoji { font-size: 24px; line-height: 1; }
    .cert-seal-text { font-size: 7px; font-weight: 700; color: ${accentColor}; letter-spacing: 1px; text-transform: uppercase; text-align: center; margin-top: 3px; }

    .corner { position: absolute; width: 40px; height: 40px; z-index: 2; opacity: 0.3; }
    .corner-tl { top: 16px; left: 16px; border-top: 2px solid #d4b966; border-left: 2px solid #d4b966; }
    .corner-tr { top: 16px; right: 16px; border-top: 2px solid #d4b966; border-right: 2px solid #d4b966; }
    .corner-bl { bottom: 16px; left: 16px; border-bottom: 2px solid #d4b966; border-left: 2px solid #d4b966; }
    .corner-br { bottom: 16px; right: 16px; border-bottom: 2px solid #d4b966; border-right: 2px solid #d4b966; }

    /* ── Barra de acciones (NO se imprime) ── */
    .action-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #1f2937;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
      z-index: 100;
    }

    .action-bar p {
      font-size: 13px;
      color: #9ca3af;
      margin-right: 8px;
    }

    .btn-print {
      background: ${accentColor};
      color: #fff;
      border: none;
      padding: 10px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: opacity 0.2s;
    }
    .btn-print:hover { opacity: 0.85; }

    .btn-close {
      background: transparent;
      color: #9ca3af;
      border: 1px solid #374151;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      transition: color 0.2s, border-color 0.2s;
    }
    .btn-close:hover { color: #fff; border-color: #6b7280; }

    @media print {
      body {
        padding: 0;
        background: #fff;
        min-height: auto;
      }
      .cert {
        box-shadow: none;
        width: 100%;
        min-height: auto;
      }
      /* La barra de acciones nunca aparece en el PDF */
      .action-bar { display: none !important; }
      @page { size: A4 landscape; margin: 10mm; }
    }
  </style>
</head>
<body>

  <div class="cert">
    <div class="corner corner-tl"></div>
    <div class="corner corner-tr"></div>
    <div class="corner corner-bl"></div>
    <div class="corner corner-br"></div>

    <div class="cert-header">
      <div class="cert-header-left">
        <h1>${headerTitle}</h1>
        <h2>${orgName}</h2>
      </div>
      <div class="cert-logo">${passed ? '🎓' : '📋'}</div>
    </div>

    <div class="cert-body">
      <p class="cert-label">Se certifica que</p>
      <p class="cert-student">${studentName}</p>
      <p class="cert-desc">${descText}</p>

      <div class="cert-metrics">
        <div class="cert-metric">
          <div class="cert-metric-value">${Math.round(score)}%</div>
          <div class="cert-metric-label">Score</div>
        </div>
        ${cefrLevel ? `
        <div class="cert-metric">
          <div class="cert-metric-value">${cefrLevel}</div>
          <div class="cert-metric-label">Nivel CEFR</div>
        </div>` : ''}
        <div class="cert-metric">
          <div class="cert-metric-value" style="color:${statusColor}">${statusValue}</div>
          <div class="cert-metric-label" style="color:${statusColor}">${statusLabel}</div>
        </div>
      </div>

      <div class="cert-divider"></div>

      <div class="cert-footer">
        <div class="cert-sign">
          <div class="cert-sign-line"></div>
          <div class="cert-sign-name">${issuedBy}</div>
          <div class="cert-sign-role">Director Académico — ${orgName}</div>
          <div class="cert-date">Emitido el ${dateStr}</div>
        </div>

        <div class="cert-seal">
          <div class="cert-seal-emoji">${sealEmoji}</div>
          <div class="cert-seal-text">${sealText}</div>
        </div>

        <div class="cert-verify">
          <div class="cert-verify-label">Verificación digital</div>
          <div class="cert-verify-hash">${verifyHash}</div>
          <div class="cert-verify-url">${verifyUrl}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Barra fija inferior — solo visible en pantalla, nunca en el PDF impreso -->
  <div class="action-bar">
    <p>¿Todo se ve bien?</p>
    <button class="btn-print" onclick="window.print()">
      🖨️ Imprimir / Guardar PDF
    </button>
    <button class="btn-close" onclick="window.close()">
      Cerrar ventana
    </button>
  </div>

  <script>
    // Abre el diálogo de impresión automáticamente al cargar.
    // La ventana NO se cierra sola: el alumno puede reimprimir
    // o guardar como PDF cuando quiera usando la barra inferior.
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print()
        // ← Sin afterprint ni setTimeout de cierre automático
      }, 500)
    })
  </script>

</body>
</html>`

  const win = window.open('', '_blank', 'width=920,height=700')
  if (!win) {
    // Fallback: descarga directa del HTML si el browser bloqueó el popup
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `certificado-${studentName.replace(/\s+/g, '-').toLowerCase()}.html`
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  win.document.write(html)
  win.document.close()
}
