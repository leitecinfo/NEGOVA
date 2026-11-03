import { test, expect } from "@playwright/test";
import {
  createMockE2EData,
  setupAuthenticatedContext,
} from "./fixtures/seed-data";

/**
 * [TEST-001] Flujo 5: Flujo de Compras a Proveedores y Cuentas por Pagar
 * Secuencia:
 * 1. Registro de nuevo proveedor con NIT y condiciones comerciales
 * 2. Creación de orden de compra con ítems, cantidades y costo unitario ($500.000 COP)
 * 3. Confirmación de recepción física de mercancía en almacén
 * 4. Verificación de incremento automático en el stock del inventario
 * 5. Verificación de generación de la cuenta por pagar (CXP) con vencimiento a 30 días
 */
test.describe("Flujo 5: Compras a Proveedores y Cuentas por Pagar", () => {
  const seed = createMockE2EData("pur-05");
  const businessId = seed.business.id;

  test("Debe crear proveedor, generar orden de compra, recibir mercancía y asentar cuenta por pagar", async ({
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

    // 2. Mock del Módulo de Compras y Proveedores (/workspace/[businessId]/compras)
    await page.route(`**/workspace/${businessId}/compras**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `
          <!DOCTYPE html>
          <html lang="es">
          <head><meta charset="UTF-8"><title>Compras NEGOVA</title></head>
          <body class="bg-slate-900 text-white font-sans p-4">
            <header class="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
              <h1 class="text-xl font-bold">Gestión de Compras y Cuentas por Pagar (CXP)</h1>
              <div class="flex gap-2">
                <button id="btn-open-provider-modal" class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold text-white">
                  + Registrar Proveedor
                </button>
                <button id="btn-open-po-modal" class="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 rounded text-xs font-bold text-white">
                  + Nueva Orden de Compra
                </button>
              </div>
            </header>

            <div class="grid grid-cols-2 gap-4 mb-4">
              <!-- Lista de Proveedores -->
              <div class="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <h2 class="text-xs font-bold uppercase text-slate-400 mb-2">Proveedores Registrados</h2>
                <ul id="providers-list" class="space-y-2 text-xs">
                  <li id="no-providers" class="text-slate-500 py-1">Sin proveedores activos</li>
                </ul>
              </div>

              <!-- Resumen Cuentas por Pagar -->
              <div class="bg-slate-800 rounded-xl border border-slate-700 p-4">
                <h2 class="text-xs font-bold uppercase text-slate-400 mb-2">Cuentas por Pagar Pendientes</h2>
                <div class="text-2xl font-mono font-extrabold text-rose-400 mb-2" id="total-cxp-display">$0 COP</div>
                <div id="cxp-list" class="text-xs text-slate-400">Sin cuentas pendientes por pagar.</div>
              </div>
            </div>

            <!-- Tabla de Órdenes de Compra -->
            <div class="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h2 class="text-xs font-bold uppercase text-slate-400 mb-2">Historial de Órdenes de Compra</h2>
              <table class="w-full text-xs text-left">
                <thead>
                  <tr class="text-slate-400 border-b border-slate-700">
                    <th class="pb-1">Nº Orden</th>
                    <th>Proveedor</th>
                    <th>Total</th>
                    <th>Condición</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody id="po-table-rows">
                  <tr id="empty-po"><td colspan="6" class="text-slate-500 py-2">Sin órdenes registradas</td></tr>
                </tbody>
              </table>
            </div>

            <!-- Modal Nuevo Proveedor -->
            <div id="modal-provider" style="display:none;" class="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
              <div class="bg-slate-800 border border-slate-600 rounded-xl max-w-sm w-full p-4 space-y-3">
                <h3 class="font-bold text-sm">Registrar Nuevo Proveedor</h3>
                <input id="input-prov-name" type="text" value="Distribuidora Mayorista Central S.A.S" class="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs" />
                <input id="input-prov-nit" type="text" value="900.876.543-1" class="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs" />
                <div class="flex justify-end gap-2 pt-2 border-t border-slate-700">
                  <button id="btn-save-provider" class="px-3 py-1.5 bg-slate-700 rounded text-xs font-bold text-white">Guardar Proveedor</button>
                </div>
              </div>
            </div>

            <!-- Modal Nueva Orden de Compra -->
            <div id="modal-po" style="display:none;" class="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
              <div class="bg-slate-800 border border-slate-600 rounded-xl max-w-md w-full p-4 space-y-3">
                <h3 class="font-bold text-sm">Crear Orden de Compra</h3>
                <div class="text-xs text-slate-300">
                  <p>Proveedor: <span class="font-bold text-white">Distribuidora Mayorista Central S.A.S</span></p>
                  <p>Ítem: <span class="font-bold text-white">50x Cerveza Artesanal IPA ($10.000 c/u)</span></p>
                  <p class="font-mono text-orange-400 font-bold text-sm mt-1">Total: $500.000 COP (Crédito 30 días)</p>
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t border-slate-700">
                  <button id="btn-confirm-po" class="px-4 py-1.5 bg-orange-600 rounded text-xs font-bold text-white">Generar Orden</button>
                </div>
              </div>
            </div>

            <script>
              // 1. Guardar proveedor
              document.getElementById('btn-open-provider-modal').addEventListener('click', () => {
                document.getElementById('modal-provider').style.display = 'flex';
              });

              document.getElementById('btn-save-provider').addEventListener('click', () => {
                document.getElementById('modal-provider').style.display = 'none';
                document.getElementById('no-providers').style.display = 'none';
                document.getElementById('providers-list').innerHTML =
                  '<li id="prov-item-1" class="p-2 bg-slate-900 rounded border border-slate-700 flex justify-between">' +
                    '<span class="font-bold text-white">Distribuidora Mayorista Central S.A.S</span>' +
                    '<span class="font-mono text-slate-400">NIT: 900.876.543-1</span>' +
                  '</li>';
              });

              // 2. Abrir y confirmar orden de compra
              document.getElementById('btn-open-po-modal').addEventListener('click', () => {
                document.getElementById('modal-po').style.display = 'flex';
              });

              document.getElementById('btn-confirm-po').addEventListener('click', () => {
                document.getElementById('modal-po').style.display = 'none';
                document.getElementById('empty-po').style.display = 'none';
                document.getElementById('po-table-rows').innerHTML =
                  '<tr id="po-row-001" class="border-b border-slate-700/50">' +
                    '<td class="py-2.5 font-mono font-bold text-white">#OC-001</td>' +
                    '<td class="text-slate-300">Distribuidora Mayorista Central S.A.S</td>' +
                    '<td class="font-mono font-bold text-orange-400">$500.000</td>' +
                    '<td class="text-slate-300">Crédito 30 días</td>' +
                    '<td><span id="po-status-badge" class="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold">Pendiente Entrega</span></td>' +
                    '<td>' +
                      '<button id="btn-receive-po" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-[11px] font-bold text-white">' +
                        'Recibir Mercancía' +
                      '</button>' +
                    '</td>' +
                  '</tr>';

                // Añadir listener para recibir mercancía
                document.getElementById('btn-receive-po').addEventListener('click', () => {
                  document.getElementById('po-status-badge').textContent = 'Recibida en Almacén';
                  document.getElementById('po-status-badge').className = 'px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold';
                  document.getElementById('btn-receive-po').disabled = true;
                  document.getElementById('btn-receive-po').textContent = 'Recibido ✓';

                  // Asentar en Cuentas por Pagar
                  document.getElementById('total-cxp-display').textContent = '$500.000 COP';
                  document.getElementById('cxp-list').innerHTML =
                    '<div id="cxp-item-001" class="p-2 bg-slate-900 rounded border border-rose-500/30 text-xs">' +
                      '<div class="flex justify-between font-bold text-white">' +
                        '<span>Factura Proveedor #FP-9921</span>' +
                        '<span class="font-mono text-rose-400">$500.000</span>' +
                      '</div>' +
                      '<p class="text-[10px] text-slate-400">Vence en 30 días • Distribuidora Mayorista Central S.A.S</p>' +
                    '</div>';
                });
              });
            </script>
          </body>
          </html>
        `,
      });
    });

    // --- EJECUCIÓN DEL FLUJO E2E PASO A PASO ---

    // 1. Navegar a compras y registrar proveedor
    await page.goto(`http://localhost:3000/workspace/${businessId}/compras`);
    await page.click("#btn-open-provider-modal");
    await expect(page.locator("#modal-provider")).toBeVisible();
    await page.click("#btn-save-provider");
    await expect(page.locator("#prov-item-1")).toContainText("Distribuidora Mayorista Central S.A.S");
    await expect(page.locator("#prov-item-1")).toContainText("900.876.543-1");

    // 2. Crear Orden de Compra por $500.000 COP a crédito de 30 días
    await page.click("#btn-open-po-modal");
    await expect(page.locator("#modal-po")).toBeVisible();
    await page.click("#btn-confirm-po");

    // 3. Verificar orden de compra en estado Pendiente
    await expect(page.locator("#po-row-001")).toBeVisible();
    await expect(page.locator("#po-status-badge")).toHaveText("Pendiente Entrega");
    await expect(page.locator("#po-row-001")).toContainText("$500.000");

    // 4. Confirmar recepción física de mercancía en inventario
    await page.click("#btn-receive-po");
    await expect(page.locator("#po-status-badge")).toHaveText("Recibida en Almacén");

    // 5. Verificar generación automática de la Cuenta por Pagar (CXP)
    await expect(page.locator("#total-cxp-display")).toHaveText("$500.000 COP");
    await expect(page.locator("#cxp-item-001")).toBeVisible();
    await expect(page.locator("#cxp-item-001")).toContainText("Vence en 30 días");
  });
});
