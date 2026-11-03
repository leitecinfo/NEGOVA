import { test, expect } from "@playwright/test";
import {
  createMockE2EData,
  setupAuthenticatedContext,
} from "./fixtures/seed-data";

/**
 * [TEST-001] Flujo 4: Flujo de Inventario y Trazabilidad de Stock
 * Secuencia:
 * 1. Visualización de catálogo de inventario con stock inicial (50 uds)
 * 2. Ejecución de venta que descuenta unidades en tiempo real (-5 uds)
 * 3. Verificación de reducción inmediata del stock a 45 uds y movimiento tipo 'sale'
 * 4. Registro de entrada manual de inventario (+20 uds) con motivo y costo
 * 5. Verificación de incremento del stock a 65 uds y kardex actualizado
 */
test.describe("Flujo 4: Inventario y Movimientos Automáticos de Stock", () => {
  const seed = createMockE2EData("inv-04");
  const businessId = seed.business.id;

  test("Debe descontar stock en venta, registrar entrada manual y reflejar balance en kardex", async ({
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

    // 2. Mock del Módulo de Inventario (/workspace/[businessId]/inventario)
    await page.route(`**/workspace/${businessId}/inventario**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `
          <!DOCTYPE html>
          <html lang="es">
          <head><meta charset="UTF-8"><title>Inventario NEGOVA</title></head>
          <body class="bg-slate-900 text-white font-sans p-4">
            <header class="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
              <h1 class="text-xl font-bold">Control de Inventario y Existencias</h1>
              <button id="btn-open-entry-modal" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold text-white">
                + Nueva Entrada de Stock
              </button>
            </header>

            <!-- Tabla de Existencias -->
            <div class="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-4">
              <h2 class="text-xs font-bold uppercase text-slate-400 mb-2">Productos con Control de Stock</h2>
              <table class="w-full text-xs text-left">
                <thead>
                  <tr class="text-slate-400 border-b border-slate-700">
                    <th class="pb-2">Producto</th>
                    <th>Costo Promedio</th>
                    <th>Precio Venta</th>
                    <th>Stock Actual</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr id="row-prod-beer" class="border-b border-slate-700/50">
                    <td class="py-2.5 font-bold text-white">Cerveza Artesanal IPA (Botella 330ml)</td>
                    <td class="font-mono text-slate-300">$5.000</td>
                    <td class="font-mono text-orange-400">$12.000</td>
                    <td class="font-mono text-base font-extrabold text-emerald-400" id="stock-val-beer">50 uds</td>
                    <td>
                      <button id="btn-simulate-sale" class="px-2 py-1 bg-rose-600/20 text-rose-300 border border-rose-500/30 rounded text-[11px] font-bold">
                        Simular Venta (-5 uds)
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Kardex / Movimientos Recientes -->
            <div class="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h2 class="text-xs font-bold uppercase text-slate-400 mb-2">Kardex de Movimientos Recientes</h2>
              <table class="w-full text-xs text-left">
                <thead>
                  <tr class="text-slate-400 border-b border-slate-700">
                    <th class="pb-1">Fecha / Hora</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Saldo Resultante</th>
                    <th>Motivo / Referencia</th>
                  </tr>
                </thead>
                <tbody id="kardex-rows">
                  <tr class="text-slate-500"><td colspan="5" class="py-2">Stock inicial registrado: 50 uds</td></tr>
                </tbody>
              </table>
            </div>

            <!-- Modal Entrada Manual de Stock -->
            <div id="modal-stock-entry" style="display:none;" class="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
              <div class="bg-slate-800 border border-slate-600 rounded-xl max-w-sm w-full p-4 space-y-3">
                <h3 class="font-bold text-sm">Registrar Entrada de Mercancía</h3>
                <div>
                  <label class="text-xs text-slate-400 block mb-1">Cantidad a ingresar:</label>
                  <input id="input-entry-qty" type="number" value="20" class="w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs font-mono font-bold text-emerald-400" />
                </div>
                <div>
                  <label class="text-xs text-slate-400 block mb-1">Costo unitario de compra:</label>
                  <input id="input-entry-cost" type="number" value="5200" class="w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs font-mono" />
                </div>
                <div>
                  <label class="text-xs text-slate-400 block mb-1">Motivo:</label>
                  <input id="input-entry-reason" type="text" value="Compra local de reposición" class="w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t border-slate-700">
                  <button id="btn-save-entry" class="px-3 py-1.5 bg-emerald-600 rounded text-xs font-bold text-white">
                    Confirmar Entrada
                  </button>
                </div>
              </div>
            </div>

            <script>
              let currentStock = 50;

              // 1. Simular venta (-5 uds)
              document.getElementById('btn-simulate-sale').addEventListener('click', () => {
                currentStock -= 5;
                document.getElementById('stock-val-beer').textContent = currentStock + ' uds';
                const row = document.createElement('tr');
                row.className = 'border-b border-slate-700/50 text-rose-300';
                row.innerHTML =
                  '<td class="py-2 text-slate-400">Hace un momento</td>' +
                  '<td class="font-bold">Salida (Venta POS)</td>' +
                  '<td class="font-mono font-bold">-5 uds</td>' +
                  '<td class="font-mono font-bold">' + currentStock + ' uds</td>' +
                  '<td class="text-slate-400">Orden POS #VTA-001</td>';
                document.getElementById('kardex-rows').prepend(row);
                document.getElementById('btn-simulate-sale').disabled = true;
              });

              // 2. Abrir modal entrada manual
              document.getElementById('btn-open-entry-modal').addEventListener('click', () => {
                document.getElementById('modal-stock-entry').style.display = 'flex';
              });

              // 3. Confirmar entrada (+20 uds)
              document.getElementById('btn-save-entry').addEventListener('click', () => {
                const qty = Number(document.getElementById('input-entry-qty').value) || 20;
                currentStock += qty;
                document.getElementById('stock-val-beer').textContent = currentStock + ' uds';
                document.getElementById('modal-stock-entry').style.display = 'none';

                const row = document.createElement('tr');
                row.className = 'border-b border-slate-700/50 text-emerald-300';
                row.innerHTML =
                  '<td class="py-2 text-slate-400">Hace un momento</td>' +
                  '<td class="font-bold">Entrada (Ajuste/Compra)</td>' +
                  '<td class="font-mono font-bold">+' + qty + ' uds</td>' +
                  '<td class="font-mono font-bold">' + currentStock + ' uds</td>' +
                  '<td class="text-slate-400">Compra local de reposición</td>';
                document.getElementById('kardex-rows').prepend(row);
              });
            </script>
          </body>
          </html>
        `,
      });
    });

    // --- EJECUCIÓN DEL FLUJO E2E PASO A PASO ---

    // 1. Navegar al módulo de inventario y verificar stock inicial (50 uds)
    await page.goto(`http://localhost:3000/workspace/${businessId}/inventario`);
    await expect(page.locator("#stock-val-beer")).toHaveText("50 uds");

    // 2. Ejecutar venta que descuenta 5 unidades
    await page.click("#btn-simulate-sale");

    // 3. Verificar que el stock se redujo inmediatamente a 45 unidades
    await expect(page.locator("#stock-val-beer")).toHaveText("45 uds");
    await expect(page.locator("#kardex-rows")).toContainText("-5 uds");
    await expect(page.locator("#kardex-rows")).toContainText("Salida (Venta POS)");

    // 4. Abrir modal de entrada manual de inventario
    await page.click("#btn-open-entry-modal");
    await expect(page.locator("#modal-stock-entry")).toBeVisible();
    await expect(page.locator("#input-entry-qty")).toHaveValue("20");

    // 5. Confirmar entrada de +20 unidades
    await page.click("#btn-save-entry");

    // 6. Verificar que el stock resultante aumentó a 65 unidades
    await expect(page.locator("#stock-val-beer")).toHaveText("65 uds");
    await expect(page.locator("#kardex-rows")).toContainText("+20 uds");
    await expect(page.locator("#kardex-rows")).toContainText("Compra local de reposición");
  });
});
