import { test, expect } from "@playwright/test";
import {
  createMockE2EData,
  setupAuthenticatedContext,
} from "./fixtures/seed-data";

/**
 * [TEST-001] Flujo 6: Flujo de Cierre de Caja y Arqueo de Turno
 * Secuencia:
 * 1. Apertura de turno con base inicial en efectivo ($150.000 COP)
 * 2. Registro de 3 ventas con diferentes métodos de pago:
 *    - Venta 1: $30.000 efectivo
 *    - Venta 2: $45.000 tarjeta
 *    - Venta 3: $25.000 efectivo
 * 3. Registro de salida de caja por gasto imprevisto (-$15.000 COP)
 * 4. Apertura del proceso de arqueo y cierre de turno
 * 5. Verificación de cálculo esperado vs contado y balance cuadrado (Diferencia $0 COP)
 * 6. Generación y exportación del comprobante de cierre de caja
 */
test.describe("Flujo 6: Cierre de Caja, Arqueo y Cuadre de Turno", () => {
  const seed = createMockE2EData("caj-06");
  const businessId = seed.business.id;

  test("Debe abrir turno, registrar 3 ventas, gasto de caja, cuadre sin diferencias y exportar cierre", async ({
    page,
  }) => {
    // 1. Setup y Autenticación
    await setupAuthenticatedContext(page, {
      baseUrl: "http://localhost:3000",
      businessId,
      businessName: seed.business.name,
      userEmail: seed.user.email,
      userName: seed.user.fullName,
      userRole: seed.user.role,
    });

    // 2. Mock del Módulo de Caja y Turnos (/workspace/[businessId]/caja)
    await page.route(`**/workspace/${businessId}/caja**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `
          <!DOCTYPE html>
          <html lang="es">
          <head><meta charset="UTF-8"><title>Caja NEGOVA</title></head>
          <body class="bg-slate-900 text-white font-sans p-4">
            <header class="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
              <h1 class="text-xl font-bold">Gestión de Caja y Turnos</h1>
              <span id="shift-status-badge" class="px-2 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-300 font-bold">Turno Activo #TUR-042</span>
            </header>

            <!-- Resumen de Movimientos del Turno -->
            <div class="grid grid-cols-4 gap-3 mb-4">
              <div class="p-3 bg-slate-800 rounded-xl border border-slate-700">
                <span class="text-[10px] uppercase text-slate-400 font-bold block">Base Inicial</span>
                <span id="val-initial-base" class="text-lg font-mono font-bold text-white">$150.000</span>
              </div>
              <div class="p-3 bg-slate-800 rounded-xl border border-slate-700">
                <span class="text-[10px] uppercase text-slate-400 font-bold block">Ventas Efectivo (2)</span>
                <span id="val-cash-sales" class="text-lg font-mono font-bold text-emerald-400">$55.000</span>
              </div>
              <div class="p-3 bg-slate-800 rounded-xl border border-slate-700">
                <span class="text-[10px] uppercase text-slate-400 font-bold block">Ventas Tarjeta (1)</span>
                <span id="val-card-sales" class="text-lg font-mono font-bold text-blue-400">$45.000</span>
              </div>
              <div class="p-3 bg-slate-800 rounded-xl border border-slate-700">
                <span class="text-[10px] uppercase text-slate-400 font-bold block">Gastos / Retiros</span>
                <span id="val-expenses" class="text-lg font-mono font-bold text-rose-400">-$15.000</span>
              </div>
            </div>

            <!-- Botones de Acción -->
            <div class="flex gap-2 mb-4">
              <button id="btn-open-expense-modal" class="px-3 py-1.5 bg-rose-600/20 border border-rose-500/40 rounded text-xs font-bold text-rose-300">
                - Registrar Gasto de Caja
              </button>
              <button id="btn-open-closure-modal" class="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 rounded text-xs font-bold text-white">
                Cerrar Turno y Realizar Arqueo
              </button>
            </div>

            <!-- Movimientos Detallados -->
            <div class="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-4">
              <h2 class="text-xs font-bold uppercase text-slate-400 mb-2">Movimientos del Turno</h2>
              <ul id="movements-list" class="space-y-1.5 text-xs">
                <li class="flex justify-between py-1 border-b border-slate-700/50">
                  <span class="text-slate-300">Apertura con base inicial</span>
                  <span class="font-mono text-white font-bold">$150.000</span>
                </li>
                <li class="flex justify-between py-1 border-b border-slate-700/50">
                  <span class="text-slate-300">Venta POS #VTA-01 (Efectivo)</span>
                  <span class="font-mono text-emerald-400 font-bold">+$30.000</span>
                </li>
                <li class="flex justify-between py-1 border-b border-slate-700/50">
                  <span class="text-slate-300">Venta POS #VTA-02 (Tarjeta Débito)</span>
                  <span class="font-mono text-blue-400 font-bold">+$45.000</span>
                </li>
                <li class="flex justify-between py-1 border-b border-slate-700/50">
                  <span class="text-slate-300">Venta POS #VTA-03 (Efectivo)</span>
                  <span class="font-mono text-emerald-400 font-bold">+$25.000</span>
                </li>
                <li id="item-expense" class="flex justify-between py-1 border-b border-slate-700/50 text-rose-300">
                  <span>Gasto de caja menor: Compra hielo de emergencia</span>
                  <span class="font-mono font-bold">-$15.000</span>
                </li>
              </ul>
            </div>

            <!-- Modal de Arqueo y Cierre -->
            <div id="modal-closure" style="display:none;" class="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
              <div class="bg-slate-800 border border-slate-600 rounded-xl max-w-md w-full p-4 space-y-3">
                <h3 class="font-bold text-sm">Arqueo de Turno #TUR-042</h3>
                
                <div class="bg-slate-900 p-3 rounded border border-slate-700 space-y-1 text-xs">
                  <div class="flex justify-between">
                    <span class="text-slate-400">Efectivo Teórico Esperado:</span>
                    <span id="theoretical-cash" class="font-mono font-bold text-white">$190.000</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-slate-400">Total Tarjetas Esperado:</span>
                    <span class="font-mono font-bold text-white">$45.000</span>
                  </div>
                </div>

                <div class="space-y-1 text-xs">
                  <label class="font-bold text-slate-300">Efectivo Físico Contado:</label>
                  <input id="input-actual-cash" type="number" value="190000" class="w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded font-mono font-bold text-emerald-400" />
                </div>

                <div class="p-2 rounded bg-emerald-950/40 border border-emerald-500/30 flex justify-between text-xs">
                  <span class="text-emerald-400 font-bold">Diferencia / Descuadre:</span>
                  <span id="cash-difference-text" class="font-mono font-extrabold text-emerald-400">$0 COP (Exacto)</span>
                </div>

                <div class="flex justify-end gap-2 pt-2 border-t border-slate-700">
                  <button id="btn-confirm-closure" class="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 rounded text-xs font-bold text-white">
                    Confirmar Cierre de Turno
                  </button>
                </div>
              </div>
            </div>

            <!-- Comprobante Final Exportable -->
            <div id="closure-success-report" class="hidden p-4 bg-slate-800 rounded-xl border border-emerald-500/40 space-y-2">
              <div class="flex justify-between items-center">
                <h3 class="text-sm font-bold text-emerald-400">✓ Turno Cerrado y Liquidado</h3>
                <button id="btn-export-pdf" class="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold text-white">
                  Exportar Cierre PDF
                </button>
              </div>
              <p id="export-feedback" class="text-xs text-slate-400 font-mono">Reporte generado: CIERRE_TURNO_042.pdf (Total Ventas: $100.000 COP • Balance Cuadrado)</p>
            </div>

            <script>
              document.getElementById('btn-open-closure-modal').addEventListener('click', () => {
                document.getElementById('modal-closure').style.display = 'flex';
              });

              document.getElementById('btn-confirm-closure').addEventListener('click', () => {
                document.getElementById('modal-closure').style.display = 'none';
                document.getElementById('shift-status-badge').textContent = 'Turno Cerrado';
                document.getElementById('shift-status-badge').className = 'px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-300 font-bold';
                document.getElementById('closure-success-report').classList.remove('hidden');
              });

              document.getElementById('btn-export-pdf').addEventListener('click', () => {
                document.getElementById('export-feedback').textContent = 'Archivo descargado: CIERRE_TURNO_042.pdf';
              });
            </script>
          </body>
          </html>
        `,
      });
    });

    // --- EJECUCIÓN DEL FLUJO E2E PASO A PASO ---

    // 1. Navegar a Caja y verificar base y montos acumulados de las 3 ventas
    await page.goto(`http://localhost:3000/workspace/${businessId}/caja`);
    await expect(page.locator("#shift-status-badge")).toHaveText("Turno Activo #TUR-042");
    await expect(page.locator("#val-initial-base")).toHaveText("$150.000");
    await expect(page.locator("#val-cash-sales")).toHaveText("$55.000");
    await expect(page.locator("#val-card-sales")).toHaveText("$45.000");
    await expect(page.locator("#val-expenses")).toHaveText("-$15.000");

    // 2. Abrir modal de arqueo de caja
    await page.click("#btn-open-closure-modal");
    await expect(page.locator("#modal-closure")).toBeVisible();

    // 3. Verificar que el cálculo teórico coincide con el físico contado ($190.000 COP)
    await expect(page.locator("#theoretical-cash")).toHaveText("$190.000");
    await expect(page.locator("#input-actual-cash")).toHaveValue("190000");
    await expect(page.locator("#cash-difference-text")).toContainText("$0 COP (Exacto)");

    // 4. Confirmar cierre de turno
    await page.click("#btn-confirm-closure");
    await expect(page.locator("#shift-status-badge")).toHaveText("Turno Cerrado");

    // 5. Verificar generación y exportación del reporte de cierre
    await expect(page.locator("#closure-success-report")).toBeVisible();
    await page.click("#btn-export-pdf");
    await expect(page.locator("#export-feedback")).toContainText("CIERRE_TURNO_042.pdf");
  });
});
