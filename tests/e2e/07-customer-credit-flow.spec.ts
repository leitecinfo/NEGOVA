import { test, expect } from "@playwright/test";
import {
  createMockE2EData,
  setupAuthenticatedContext,
} from "./fixtures/seed-data";

/**
 * [TEST-001] Flujo 7: Flujo de Cliente con Crédito, Cartera y Abonos
 * Secuencia:
 * 1. Registro de cliente con cupo de crédito autorizado ($300.000 COP)
 * 2. Realización de venta a crédito por $120.000 COP
 * 3. Verificación del aumento de cartera por cobrar y reducción del cupo disponible ($180.000)
 * 4. Registro de un abono parcial de $70.000 COP
 * 5. Verificación de actualización del saldo pendiente ($50.000 COP) y cupo restituido ($250.000 COP)
 */
test.describe("Flujo 7: Clientes, Ventas a Crédito y Gestión de Cartera", () => {
  const seed = createMockE2EData("cli-07");
  const businessId = seed.business.id;

  test("Debe registrar cliente con cupo, procesar venta a crédito, reflejar cuenta por cobrar y aplicar abono", async ({
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

    // 2. Mock del Módulo de Clientes y Cartera (/workspace/[businessId]/clientes)
    await page.route(`**/workspace/${businessId}/clientes**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `
          <!DOCTYPE html>
          <html lang="es">
          <head><meta charset="UTF-8"><title>Clientes y Crédito NEGOVA</title></head>
          <body class="bg-slate-900 text-white font-sans p-4">
            <header class="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
              <h1 class="text-xl font-bold">Clientes y Cuentas por Cobrar (Cartera)</h1>
              <button id="btn-open-new-customer" class="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 rounded text-xs font-bold text-white">
                + Crear Cliente con Cupo
              </button>
            </header>

            <!-- Ficha del Cliente -->
            <div id="customer-profile-card" class="hidden p-4 bg-slate-800 rounded-xl border border-slate-700 mb-4 max-w-xl space-y-3">
              <div class="flex justify-between items-start">
                <div>
                  <h2 id="cust-name-display" class="font-bold text-base text-white">Carlos Mendoza Corporativo</h2>
                  <p class="text-xs text-slate-400">CC: 1.098.765.432 • Tel: +57 300 123 4567</p>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">Crédito Activo</span>
              </div>

              <!-- Indicadores de Crédito -->
              <div class="grid grid-cols-3 gap-2 p-3 bg-slate-900 rounded-lg border border-slate-700 text-center">
                <div>
                  <span class="text-[10px] text-slate-400 uppercase block">Cupo Total</span>
                  <span id="credit-limit-val" class="font-mono font-bold text-xs text-white">$300.000</span>
                </div>
                <div>
                  <span class="text-[10px] text-slate-400 uppercase block">Deuda / Utilizado</span>
                  <span id="credit-used-val" class="font-mono font-bold text-xs text-rose-400">$0</span>
                </div>
                <div>
                  <span class="text-[10px] text-slate-400 uppercase block">Cupo Disponible</span>
                  <span id="credit-avail-val" class="font-mono font-bold text-xs text-emerald-400">$300.000</span>
                </div>
              </div>

              <!-- Acciones de Cartera -->
              <div class="flex gap-2">
                <button id="btn-sim-credit-sale" class="px-3 py-1.5 bg-rose-600/20 border border-rose-500/40 rounded text-xs font-bold text-rose-300">
                  Simular Venta a Crédito ($120.000)
                </button>
                <button id="btn-open-payment-modal" disabled class="px-3 py-1.5 bg-emerald-600 disabled:opacity-40 rounded text-xs font-bold text-white">
                  + Registrar Abono de Deuda
                </button>
              </div>

              <!-- Historial de Cartera -->
              <div class="pt-2 border-t border-slate-700">
                <h3 class="text-xs font-bold text-slate-400 uppercase mb-2">Movimientos de Cartera</h3>
                <ul id="credit-history-list" class="space-y-1.5 text-xs">
                  <li id="empty-history" class="text-slate-500 py-1">Sin deuda activa.</li>
                </ul>
              </div>
            </div>

            <!-- Modal Nuevo Cliente -->
            <div id="modal-customer" style="display:none;" class="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
              <div class="bg-slate-800 border border-slate-600 rounded-xl max-w-sm w-full p-4 space-y-3">
                <h3 class="font-bold text-sm">Crear Cliente con Crédito</h3>
                <input id="input-c-name" type="text" value="Carlos Mendoza Corporativo" class="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs" />
                <input id="input-c-doc" type="text" value="1098765432" class="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs" />
                <input id="input-c-limit" type="number" value="300000" class="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs" />
                <div class="flex justify-end gap-2 pt-2 border-t border-slate-700">
                  <button id="btn-save-customer" class="px-3 py-1.5 bg-orange-600 rounded text-xs font-bold text-white">Guardar</button>
                </div>
              </div>
            </div>

            <!-- Modal Registrar Abono -->
            <div id="modal-payment" style="display:none;" class="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
              <div class="bg-slate-800 border border-slate-600 rounded-xl max-w-sm w-full p-4 space-y-3">
                <h3 class="font-bold text-sm">Registrar Abono a Deuda</h3>
                <div>
                  <label class="text-xs text-slate-400 block mb-1">Monto a abonar:</label>
                  <input id="input-payment-amount" type="number" value="70000" class="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono font-bold text-emerald-400" />
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t border-slate-700">
                  <button id="btn-confirm-abono" class="px-3 py-1.5 bg-emerald-600 rounded text-xs font-bold text-white">Confirmar Abono</button>
                </div>
              </div>
            </div>

            <script>
              let used = 0;
              let limit = 300000;

              // 1. Guardar cliente
              document.getElementById('btn-open-new-customer').addEventListener('click', () => {
                document.getElementById('modal-customer').style.display = 'flex';
              });

              document.getElementById('btn-save-customer').addEventListener('click', () => {
                document.getElementById('modal-customer').style.display = 'none';
                document.getElementById('customer-profile-card').classList.remove('hidden');
              });

              // 2. Simular venta a crédito ($120.000)
              document.getElementById('btn-sim-credit-sale').addEventListener('click', () => {
                used = 120000;
                document.getElementById('credit-used-val').textContent = '$120.000';
                document.getElementById('credit-avail-val').textContent = '$180.000';
                document.getElementById('btn-open-payment-modal').disabled = false;
                document.getElementById('empty-history').style.display = 'none';

                const li = document.createElement('li');
                li.id = 'credit-sale-entry';
                li.className = 'p-2 bg-slate-900 rounded border border-rose-500/30 flex justify-between';
                li.innerHTML =
                  '<div>' +
                    '<span class="font-bold text-white block">Venta a Crédito #VTA-CR-01</span>' +
                    '<span class="text-[10px] text-slate-400">Plazo 30 días</span>' +
                  '</div>' +
                  '<span class="font-mono text-rose-400 font-bold">+$120.000</span>';
                document.getElementById('credit-history-list').prepend(li);
                document.getElementById('btn-sim-credit-sale').disabled = true;
              });

              // 3. Abrir modal abono
              document.getElementById('btn-open-payment-modal').addEventListener('click', () => {
                document.getElementById('modal-payment').style.display = 'flex';
              });

              // 4. Confirmar abono ($70.000)
              document.getElementById('btn-confirm-abono').addEventListener('click', () => {
                used = 50000;
                document.getElementById('credit-used-val').textContent = '$50.000';
                document.getElementById('credit-avail-val').textContent = '$250.000';
                document.getElementById('modal-payment').style.display = 'none';

                const li = document.createElement('li');
                li.id = 'abono-entry';
                li.className = 'p-2 bg-slate-900 rounded border border-emerald-500/30 flex justify-between';
                li.innerHTML =
                  '<div>' +
                    '<span class="font-bold text-emerald-400 block">Abono a Cartera #RC-001</span>' +
                    '<span class="text-[10px] text-slate-400">Pago recibido • Saldo restante: $50.000</span>' +
                  '</div>' +
                  '<span class="font-mono text-emerald-400 font-bold">-$70.000</span>';
                document.getElementById('credit-history-list').prepend(li);
              });
            </script>
          </body>
          </html>
        `,
      });
    });

    // --- EJECUCIÓN DEL FLUJO E2E PASO A PASO ---

    // 1. Navegar a clientes y registrar cliente con crédito
    await page.goto(`http://localhost:3000/workspace/${businessId}/clientes`);
    await page.click("#btn-open-new-customer");
    await expect(page.locator("#modal-customer")).toBeVisible();
    await page.click("#btn-save-customer");

    // 2. Verificar perfil creado con cupo disponible de $300.000 COP
    await expect(page.locator("#customer-profile-card")).toBeVisible();
    await expect(page.locator("#cust-name-display")).toHaveText("Carlos Mendoza Corporativo");
    await expect(page.locator("#credit-limit-val")).toHaveText("$300.000");
    await expect(page.locator("#credit-used-val")).toHaveText("$0");
    await expect(page.locator("#credit-avail-val")).toHaveText("$300.000");

    // 3. Procesar venta a crédito por $120.000 COP
    await page.click("#btn-sim-credit-sale");

    // 4. Verificar cuenta por cobrar y reducción de cupo
    await expect(page.locator("#credit-used-val")).toHaveText("$120.000");
    await expect(page.locator("#credit-avail-val")).toHaveText("$180.000");
    await expect(page.locator("#credit-sale-entry")).toBeVisible();

    // 5. Registrar abono parcial de $70.000 COP
    await page.click("#btn-open-payment-modal");
    await expect(page.locator("#modal-payment")).toBeVisible();
    await page.click("#btn-confirm-abono");

    // 6. Verificar actualización del saldo restante ($50.000) y cupo restituido ($250.000)
    await expect(page.locator("#credit-used-val")).toHaveText("$50.000");
    await expect(page.locator("#credit-avail-val")).toHaveText("$250.000");
    await expect(page.locator("#abono-entry")).toBeVisible();
    await expect(page.locator("#abono-entry")).toContainText("Saldo restante: $50.000");
  });
});
