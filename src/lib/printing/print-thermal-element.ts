/**
 * Utilidad de impresión térmica aislada de 80mm / 58mm
 * 
 * Evita que el navegador capture la interfaz completa de la aplicación (POS, barras laterales, cabecera),
 * aislando el DOM del tiquete dentro de un iframe independiente y enviando a imprimir únicamente dicho iframe.
 */

export function printThermalElement(elementId: string, title: string = "Tiquete Térmico") {
  if (typeof window === "undefined") return;

  const element = document.getElementById(elementId);
  if (!element) {
    window.print();
    return;
  }

  const ticketHtml = element.innerHTML;

  // Crear iframe invisible en el documento
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          *, *::before, *::after {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: 80mm;
            max-width: 80mm;
            background: #ffffff;
            color: #000000;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            line-height: 1.25;
          }
          .thermal-ticket-wrapper {
            width: 76mm;
            margin: 0 auto;
            padding: 4mm 2mm;
            background: #ffffff;
            color: #000000;
          }
          /* Clases estándar de tiquete térmico */
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .font-black { font-weight: 900; }
          .font-semibold { font-weight: 600; }
          .font-medium { font-weight: 500; }
          .font-mono { font-family: 'Courier New', Courier, monospace; }
          .uppercase { text-transform: uppercase; }
          .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .flex { display: flex; }
          .inline-flex { display: inline-flex; }
          .flex-col { flex-direction: column; }
          .items-center { align-items: center; }
          .items-start { align-items: flex-start; }
          .justify-between { justify-content: space-between; }
          .justify-center { justify-content: center; }
          .border-t { border-top: 1px solid #000; }
          .border-b { border-bottom: 1px solid #000; }
          .border-2 { border: 2px solid #000; }
          .border-dashed { border-style: dashed !important; }
          .border-black { border-color: #000 !important; }
          .rounded-full { border-radius: 9999px; }
          .rounded-lg { border-radius: 4px; }
          .rounded-xl { border-radius: 6px; }
          .space-y-1 > * + * { margin-top: 4px; }
          .space-y-1\\.5 > * + * { margin-top: 6px; }
          .space-y-2 > * + * { margin-top: 8px; }
          .space-y-2\\.5 > * + * { margin-top: 10px; }
          .space-y-3 > * + * { margin-top: 12px; }
          .space-y-3\\.5 > * + * { margin-top: 14px; }
          .space-y-4 > * + * { margin-top: 16px; }
          .gap-1 { gap: 4px; }
          .gap-1\\.5 { gap: 6px; }
          .gap-2 { gap: 8px; }
          .gap-3 { gap: 12px; }
          .pt-1 { padding-top: 4px; }
          .pt-1\\.5 { padding-top: 6px; }
          .pt-2 { padding-top: 8px; }
          .pt-3 { padding-top: 12px; }
          .pb-1 { padding-bottom: 4px; }
          .pb-2 { padding-bottom: 8px; }
          .pl-9 { padding-left: 24px; }
          .min-w-\\[56px\\] { min-width: 56px; }
          .h-9 { height: 36px; }
          .px-3\\.5 { padding-left: 12px; padding-right: 12px; }
          .text-\\[10px\\] { font-size: 10px; }
          .text-\\[11px\\] { font-size: 11px; }
          .text-xs { font-size: 12px; }
          .text-sm { font-size: 13px; }
          .text-base { font-size: 15px; }
          .text-lg { font-size: 17px; }
          .text-xl { font-size: 19px; }
          .tracking-wide { letter-spacing: 0.05em; }
          .tracking-wider { letter-spacing: 0.1em; }
          .text-red-600 { color: #000 !important; font-weight: bold; }
          .text-slate-400, .text-slate-500, .text-slate-600, .text-slate-700, .text-slate-800, .text-slate-900 { color: #000 !important; }
          .bg-black { background-color: #000 !important; }
          .text-white { color: #fff !important; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <div class="thermal-ticket-wrapper">
          ${ticketHtml}
        </div>
      </body>
    </html>
  `);
  doc.close();

  // Dar tiempo para carga y disparar impresión del iframe
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {}
    }, 2000);
  }, 200);
}
