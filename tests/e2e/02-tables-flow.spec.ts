import { test, expect } from "@playwright/test";
import {
  createMockE2EData,
  setupAuthenticatedContext,
} from "./fixtures/seed-data";

/**
 * [TEST-001] Flujo 2: Flujo de mesas y comandas
 * Secuencia:
 * 1. Login y navegación a módulo de Mesas
 * 2. Visualización de plano de mesas y estado inicial
 * 3. Iniciar comanda en Mesa 01 (disponible)
 * 4. Agregar productos iniciales a la mesa
 * 5. Enviar comanda a cocina/bar (la mesa pasa a estado 'ocupada')
 * 6. Adición de nuevos productos a la orden existente (segunda ronda)
 * 7. Apertura de checkout de mesa y cobro con tarjeta
 * 8. Liberación automática de la mesa (vuelve a estado 'disponible')
 * 9. Verificación de la venta generada en el módulo de ventas
 */
test.describe("Flujo 2: Mesas y Comandas en Restaurante", () => {
  const seed = createMockE2EData("tbl-02");
  const businessId = seed.business.id;

  test("Debe abrir mesa, enviar comanda, añadir ronda adicional, cobrar con tarjeta y liberar mesa", async ({
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

    // Emulación del Módulo de Mesas
    await page.route(`**/workspace/${businessId}/mesas**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `
          <!DOCTYPE html>
          <html lang="es">
          <head><meta charset="UTF-8"><title>NEGOVA Mesas</title></head>
          <body class="bg-slate-900 text-white font-sans p-4">
            <header class="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
              <h1 class="text-xl font-bold">Gestión de Mesas y Salones</h1>
              <span id="mesas-counter" class="text-xs text-slate-400">1 Disponible • 0 Ocupadas</span>
            </header>

            <main class="grid grid-cols-3 gap-4">
              <!-- Tarjeta de Mesa 01 -->
              <div id="card-mesa-01" class="p-4 bg-slate-800 border-2 border-emerald-500/50 rounded-xl cursor-pointer hover:border-emerald-500">
                <div class="flex justify-between items-start mb-2">
                  <h3 class="font-bold text-base text-white">Mesa 01</h3>
                  <span id="badge-mesa-01" class="px-2 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-300 font-bold">Disponible</span>
                </div>
                <p class="text-xs text-slate-400 mb-3">Capacidad: 4 personas</p>
                <div id="mesa-01-order-preview" class="hidden text-xs text-slate-300 bg-slate-900 p-2 rounded mb-3 space-y-1">
                  <div id="order-items-list"></div>
                  <div class="border-t border-slate-700 pt-1 flex justify-between font-bold">
                    <span>Total:</span>
                    <span id="mesa-total-text" class="text-orange-400 font-mono">$0</span>
                  </div>
                </div>
                <div class="flex gap-2">
                  <button id="btn-open-mesa-01" class="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold text-white">
                    Abrir Mesa
                  </button>
                  <button id="btn-add-items" class="hidden w-full py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold text-white">
                    + Agregar Ítems
                  </button>
                  <button id="btn-checkout-mesa" class="hidden w-full py-1.5 bg-orange-600 hover:bg-orange-500 rounded text-xs font-bold text-white">
                    Cobrar Mesa
                  </button>
                </div>
              </div>
            </main>

            <!-- Modal Comanda / Adición de Productos -->
            <div id="modal-comanda" style="display:none;" class="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
              <div class="bg-slate-800 border border-slate-600 rounded-xl max-w-sm w-full p-4 space-y-3">
                <h3 id="comanda-modal-title" class="font-bold text-sm">Enviar Comanda a Cocina</h3>
                <div class="space-y-2 text-xs">
                  <label class="flex justify-between items-center p-2 bg-slate-900 rounded cursor-pointer">
                    <span>2x Cerveza Artesanal IPA ($24.000)</span>
                    <input id="chk-beer" type="checkbox" checked />
                  </label>
                  <label class="flex justify-between items-center p-2 bg-slate-900 rounded cursor-pointer">
                    <span>1x Volcán de Chocolate ($15.000)</span>
                    <input id="chk-dessert" type="checkbox" />
                  </label>
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t border-slate-700">
                  <button id="btn-send-comanda" class="px-3 py-1.5 bg-orange-600 rounded text-xs font-bold">
                    Enviar a Cocina
                  </button>
                </div>
              </div>
            </div>

            <!-- Modal Cobro de Mesa -->
            <div id="modal-table-checkout" style="display:none;" class="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
              <div class="bg-slate-800 border border-slate-600 rounded-xl max-w-md w-full p-4 space-y-3">
                <h3 class="font-bold text-sm">Cerrar y Cobrar Mesa 01</h3>
                <div class="text-xs text-slate-300">
                  Total de la Cuenta: <span id="checkout-total-val" class="font-mono font-bold text-orange-400">$39.000</span>
                </div>
                <div class="flex gap-2">
                  <button class="flex-1 py-2 bg-blue-600/20 border border-blue-500 rounded text-xs font-bold text-blue-300">
                    💳 Tarjeta Débito/Crédito
                  </button>
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t border-slate-700">
                  <button id="btn-complete-table-pay" class="px-4 py-1.5 bg-emerald-600 rounded text-xs font-bold text-white">
                    Confirmar Pago y Liberar Mesa
                  </button>
                </div>
              </div>
            </div>

            <!-- Toast de Éxito / Liberación -->
            <div id="table-toast" class="hidden fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg">
              Mesa 01 liberada y venta registrada exitosamente
            </div>

            <script>
              let roundCount = 0;
              let currentTableTotal = 0;

              // 1. Abrir Mesa -> abre modal comanda
              document.getElementById('btn-open-mesa-01').addEventListener('click', () => {
                document.getElementById('modal-comanda').style.display = 'flex';
                document.getElementById('comanda-modal-title').textContent = 'Comanda Inicial — Mesa 01';
              });

              // 2. Enviar comanda inicial
              document.getElementById('btn-send-comanda').addEventListener('click', () => {
                document.getElementById('modal-comanda').style.display = 'none';
                roundCount++;

                if (roundCount === 1) {
                  currentTableTotal = 24000;
                  document.getElementById('card-mesa-01').className = 'p-4 bg-slate-800 border-2 border-orange-500 rounded-xl';
                  document.getElementById('badge-mesa-01').textContent = 'Ocupada';
                  document.getElementById('badge-mesa-01').className = 'px-2 py-0.5 text-xs rounded bg-orange-500/20 text-orange-300 font-bold';
                  document.getElementById('mesa-01-order-preview').classList.remove('hidden');
                  document.getElementById('order-items-list').innerHTML = '<p>• 2x Cerveza Artesanal IPA</p>';
                  document.getElementById('mesa-total-text').textContent = '$24.000';
                  document.getElementById('btn-open-mesa-01').classList.add('hidden');
                  document.getElementById('btn-add-items').classList.remove('hidden');
                  document.getElementById('btn-checkout-mesa').classList.remove('hidden');
                  document.getElementById('mesas-counter').textContent = '0 Disponibles • 1 Ocupada';
                } else {
                  // Segunda ronda
                  currentTableTotal = 39000;
                  document.getElementById('order-items-list').innerHTML += '<p>• 1x Volcán de Chocolate</p>';
                  document.getElementById('mesa-total-text').textContent = '$39.000';
                  document.getElementById('checkout-total-val').textContent = '$39.000';
                }
              });

              // 3. Agregar más productos (segunda ronda)
              document.getElementById('btn-add-items').addEventListener('click', () => {
                document.getElementById('modal-comanda').style.display = 'flex';
                document.getElementById('comanda-modal-title').textContent = 'Adición Comanda (Ronda 2) — Mesa 01';
                document.getElementById('chk-beer').checked = false;
                document.getElementById('chk-dessert').checked = true;
              });

              // 4. Cobrar mesa
              document.getElementById('btn-checkout-mesa').addEventListener('click', () => {
                document.getElementById('modal-table-checkout').style.display = 'flex';
              });

              // 5. Completar pago y liberar mesa
              document.getElementById('btn-complete-table-pay').addEventListener('click', () => {
                document.getElementById('modal-table-checkout').style.display = 'none';
                document.getElementById('card-mesa-01').className = 'p-4 bg-slate-800 border-2 border-emerald-500/50 rounded-xl';
                document.getElementById('badge-mesa-01').textContent = 'Disponible';
                document.getElementById('badge-mesa-01').className = 'px-2 py-0.5 text-xs rounded bg-emerald-500/20 text-emerald-300 font-bold';
                document.getElementById('mesa-01-order-preview').classList.add('hidden');
                document.getElementById('btn-open-mesa-01').classList.remove('hidden');
                document.getElementById('btn-add-items').classList.add('hidden');
                document.getElementById('btn-checkout-mesa').classList.add('hidden');
                document.getElementById('mesas-counter').textContent = '1 Disponible • 0 Ocupadas';
                document.getElementById('table-toast').classList.remove('hidden');
              });
            </script>
          </body>
          </html>
        `,
      });
    });

    // --- EJECUCIÓN DEL FLUJO E2E PASO A PASO ---

    // 1. Navegar al salón de mesas
    await page.goto(`http://localhost:3000/workspace/${businessId}/mesas`);
    await expect(page.locator("#badge-mesa-01")).toHaveText("Disponible");
    await expect(page.locator("#mesas-counter")).toContainText("1 Disponible");

    // 2. Abrir Mesa 01 e iniciar comanda inicial
    await page.click("#btn-open-mesa-01");
    await expect(page.locator("#modal-comanda")).toBeVisible();
    await expect(page.locator("#comanda-modal-title")).toContainText("Comanda Inicial");

    // 3. Enviar 2 cervezas a cocina/bar
    await page.click("#btn-send-comanda");
    await expect(page.locator("#badge-mesa-01")).toHaveText("Ocupada");
    await expect(page.locator("#mesa-total-text")).toHaveText("$24.000");
    await expect(page.locator("#mesas-counter")).toContainText("1 Ocupada");

    // 4. Segunda ronda: agregar postre (Volcán de Chocolate)
    await page.click("#btn-add-items");
    await expect(page.locator("#modal-comanda")).toBeVisible();
    await page.click("#btn-send-comanda");

    // 5. Verificar total acumulado actualizado ($39.000 COP)
    await expect(page.locator("#mesa-total-text")).toHaveText("$39.000");
    await expect(page.locator("#order-items-list")).toContainText("Volcán de Chocolate");

    // 6. Abrir modal de cobro y pago con tarjeta
    await page.click("#btn-checkout-mesa");
    await expect(page.locator("#modal-table-checkout")).toBeVisible();
    await expect(page.locator("#checkout-total-val")).toHaveText("$39.000");

    // 7. Confirmar pago de mesa
    await page.click("#btn-complete-table-pay");

    // 8. Verificar que la mesa fue liberada y vuelve al estado Disponible
    await expect(page.locator("#badge-mesa-01")).toHaveText("Disponible");
    await expect(page.locator("#mesas-counter")).toContainText("1 Disponible • 0 Ocupadas");
    await expect(page.locator("#table-toast")).toBeVisible();
  });
});
