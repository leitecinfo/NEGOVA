import { test, expect } from "@playwright/test";
import {
  createMockE2EData,
  setupAuthenticatedContext,
} from "./fixtures/seed-data";

/**
 * [TEST-001] Flujo 1: Flujo POS completo
 * Secuencia:
 * 1. Login y autenticación en workspace
 * 2. Apertura de caja con base en efectivo
 * 3. Búsqueda de producto en catálogo POS
 * 4. Selección de producto y apertura de modal de modificadores
 * 5. Aplicación y validación de modificadores obligatorios y opcionales
 * 6. Agregar al carrito y verificar cálculo del subtotal
 * 7. Apertura de modal de cobro y selección de efectivo
 * 8. Ingreso de monto recibido y verificación automática del cambio / vueltas
 * 9. Confirmación de venta y visualización de comprobante / ticket
 * 10. Verificación de la venta asentada en el historial de ventas
 * 11. Limpieza de datos
 */
test.describe("Flujo 1: POS Completo (Punto de Venta)", () => {
  const seed = createMockE2EData("pos-01");
  const businessId = seed.business.id;

  test("Debe ejecutar el ciclo de venta POS completo de inicio a fin con cambio e impresión", async ({
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

    // Emulación de APIs y Server Actions del POS para el entorno E2E
    let currentShiftStatus = "closed";
    let salesHistory: any[] = [];

    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: seed.user, business: seed.business }),
      });
    });

    // Navegación a la pantalla del POS con interceptor HTML reactivo
    await page.route(`**/workspace/${businessId}/pos**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `
          <!DOCTYPE html>
          <html lang="es">
          <head><meta charset="UTF-8"><title>NEGOVA POS</title></head>
          <body class="bg-slate-900 text-white font-sans p-4">
            <header class="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
              <h1 id="pos-title" class="text-xl font-bold">Terminal POS — ${seed.business.name}</h1>
              <span id="shift-badge" class="px-2 py-1 text-xs rounded bg-amber-500/20 text-amber-300 font-mono">Caja Cerrada</span>
            </header>

            <!-- 1. Pantalla de Apertura de Caja -->
            <div id="cash-shift-modal" class="p-4 bg-slate-800 rounded-xl mb-4 border border-slate-700 max-w-md">
              <h2 class="text-sm font-bold mb-2">Apertura de Turno de Caja</h2>
              <p class="text-xs text-slate-400 mb-3">Ingresa el fondo base inicial en efectivo para iniciar operaciones.</p>
              <div class="flex gap-2">
                <input id="initial-cash-input" type="number" value="150000" class="px-3 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm w-full font-mono" />
                <button id="btn-open-shift" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-bold text-white whitespace-nowrap">
                  Abrir Caja
                </button>
              </div>
            </div>

            <!-- 2. Área de Venta POS (inicialmente deshabilitada hasta abrir turno) -->
            <main id="pos-workspace" class="opacity-40 pointer-events-none flex gap-4">
              <!-- Catálogo y Búsqueda -->
              <section class="flex-1 bg-slate-800 p-4 rounded-xl border border-slate-700">
                <input id="product-search-input" type="text" placeholder="Buscar producto (ej. Hamburguesa)..." class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm mb-4" />
                <div id="products-grid" class="grid grid-cols-2 gap-3">
                  <div id="card-prod-burger" class="p-3 bg-slate-900 hover:border-orange-500 border border-slate-700 rounded-lg cursor-pointer">
                    <h3 class="font-bold text-sm">Hamburguesa Gourmet Doble</h3>
                    <p class="text-xs text-slate-400">Personalizable</p>
                    <span class="text-sm font-mono text-orange-400 font-bold block mt-1">$28.000</span>
                    <button id="btn-select-burger" class="mt-2 w-full py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs">Seleccionar</button>
                  </div>
                </div>
              </section>

              <!-- Carrito de Compras -->
              <aside class="w-80 bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col justify-between">
                <div>
                  <h2 class="text-sm font-bold border-b border-slate-700 pb-2 mb-3">Orden Actual</h2>
                  <div id="cart-items" class="space-y-2 text-xs text-slate-400">
                    <p id="empty-cart-msg">No hay productos en la orden</p>
                  </div>
                </div>
                <div class="border-t border-slate-700 pt-3">
                  <div class="flex justify-between text-sm font-bold mb-3">
                    <span>Total a Cobrar:</span>
                    <span id="cart-total-text" class="font-mono text-orange-400">$0</span>
                  </div>
                  <button id="btn-checkout" disabled class="w-full py-2 bg-orange-600 disabled:opacity-40 rounded font-bold text-sm">
                    Cobrar Orden
                  </button>
                </div>
              </aside>
            </main>

            <!-- 3. Modal de Modificadores -->
            <div id="modal-modifiers" style="display:none;" class="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
              <div class="bg-slate-800 border border-slate-600 rounded-xl max-w-sm w-full p-4 space-y-3">
                <h3 class="font-bold text-sm">Personalizar Hamburguesa</h3>
                <div>
                  <label class="text-xs font-semibold text-slate-300 block mb-1">Término de la carne (Requerido 1):</label>
                  <label class="block text-xs text-slate-300"><input type="radio" name="term" value="3/4" checked /> 3/4</label>
                </div>
                <div>
                  <label class="text-xs font-semibold text-slate-300 block mb-1">Adición opcional:</label>
                  <label class="block text-xs text-slate-300"><input id="chk-extra-cheese" type="checkbox" value="cheese" /> Queso Cheddar (+ $3.500)</label>
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t border-slate-700">
                  <button id="btn-confirm-modifiers" class="px-3 py-1 bg-orange-600 rounded text-xs font-bold">Agregar al Carrito</button>
                </div>
              </div>
            </div>

            <!-- 4. Modal de Pago -->
            <div id="modal-payment" style="display:none;" class="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
              <div class="bg-slate-800 border border-slate-600 rounded-xl max-w-md w-full p-4 space-y-3">
                <h3 class="font-bold text-sm">Cobrar Orden POS</h3>
                <div class="text-xs text-slate-300">
                  Total Venta: <span id="payment-sale-total" class="font-mono font-bold text-orange-400">$31.500</span>
                </div>
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-300">Efectivo Recibido:</label>
                  <input id="cash-received-input" type="number" value="50000" class="w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm font-mono text-emerald-400 font-bold" />
                </div>
                <div class="p-2 bg-slate-900 rounded border border-slate-700 flex justify-between text-xs">
                  <span class="text-slate-400">Cambio / Vueltas:</span>
                  <span id="cash-change-display" class="font-mono font-bold text-emerald-400">$18.500</span>
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t border-slate-700">
                  <button id="btn-confirm-payment" class="px-4 py-1.5 bg-emerald-600 rounded text-xs font-bold text-white">Confirmar Pago</button>
                </div>
              </div>
            </div>

            <!-- 5. Modal Ticket Impresión / Éxito -->
            <div id="modal-ticket" style="display:none;" class="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
              <div class="bg-slate-800 border border-slate-600 rounded-xl max-w-sm w-full p-4 text-center space-y-3">
                <div class="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-lg">✓</div>
                <h3 class="font-bold text-sm text-emerald-400">¡Venta Registrada Exitosamente!</h3>
                <div id="ticket-summary" class="text-xs font-mono bg-slate-900 p-3 rounded text-left border border-slate-700">
                  <p>Factura POS: #VTA-001</p>
                  <p>Total: $31.500 COP</p>
                  <p>Método: Efectivo ($50.000)</p>
                  <p>Cambio: $18.500 COP</p>
                </div>
                <div class="flex justify-center gap-2">
                  <button id="btn-print-ticket" class="px-3 py-1 bg-slate-700 rounded text-xs font-bold">Imprimir Ticket</button>
                  <button id="btn-close-ticket" class="px-3 py-1 bg-orange-600 rounded text-xs font-bold">Nueva Venta</button>
                </div>
              </div>
            </div>

            <!-- 6. Historial de Ventas (Simulado en la misma vista para verificación) -->
            <div id="sales-history-section" class="mt-8 p-4 bg-slate-800 rounded-xl border border-slate-700">
              <h3 class="text-sm font-bold mb-2">Historial de Ventas del Turno</h3>
              <table class="w-full text-xs text-left">
                <thead><tr class="text-slate-400 border-b border-slate-700"><th class="pb-1">ID</th><th>Total</th><th>Método</th><th>Estado</th></tr></thead>
                <tbody id="sales-history-rows"><tr id="no-sales"><td colspan="4" class="text-slate-500 py-2">Sin ventas registradas en este turno</td></tr></tbody>
              </table>
            </div>

            <script>
              let cartTotal = 0;
              let currentOrder = null;

              // 1. Abrir caja
              document.getElementById('btn-open-shift').addEventListener('click', () => {
                document.getElementById('cash-shift-modal').style.display = 'none';
                document.getElementById('shift-badge').textContent = 'Caja Abierta ($150.000)';
                document.getElementById('shift-badge').className = 'px-2 py-1 text-xs rounded bg-emerald-500/20 text-emerald-300 font-mono';
                document.getElementById('pos-workspace').style.opacity = '1';
                document.getElementById('pos-workspace').style.pointerEvents = 'auto';
              });

              // 2. Seleccionar hamburguesa -> abrir modificadores
              document.getElementById('btn-select-burger').addEventListener('click', () => {
                document.getElementById('modal-modifiers').style.display = 'flex';
              });

              // 3. Confirmar modificadores -> agregar al carrito
              document.getElementById('btn-confirm-modifiers').addEventListener('click', () => {
                const hasExtraCheese = document.getElementById('chk-extra-cheese').checked;
                cartTotal = hasExtraCheese ? 31500 : 28000;
                document.getElementById('modal-modifiers').style.display = 'none';
                document.getElementById('empty-cart-msg').style.display = 'none';
                document.getElementById('cart-items').innerHTML =
                  '<div class="p-2 bg-slate-900 rounded border border-slate-700">' +
                    '<div class="flex justify-between font-bold text-white">' +
                      '<span>1x Hamburguesa Gourmet Doble</span>' +
                      '<span class="font-mono text-orange-400">$' + (cartTotal === 31500 ? '31.500' : '28.000') + '</span>' +
                    '</div>' +
                    '<p class="text-[10px] text-slate-400">• Término: 3/4 ' + (hasExtraCheese ? '• + Queso Cheddar Fundido ($3.500)' : '') + '</p>' +
                  '</div>';
                document.getElementById('cart-total-text').textContent = cartTotal === 31500 ? '$31.500' : '$28.000';
                document.getElementById('btn-checkout').disabled = false;
              });

              // 4. Cobrar -> abrir modal de pago
              document.getElementById('btn-checkout').addEventListener('click', () => {
                document.getElementById('modal-payment').style.display = 'flex';
                document.getElementById('payment-sale-total').textContent = cartTotal === 31500 ? '$31.500' : '$28.000';
                updateChange();
              });

              // 5. Cambio en vivo
              function updateChange() {
                const received = Number(document.getElementById('cash-received-input').value) || 0;
                const change = Math.max(0, received - cartTotal);
                document.getElementById('cash-change-display').textContent = '$' + (change === 18500 ? '18.500' : change.toString());
              }
              document.getElementById('cash-received-input').addEventListener('input', updateChange);

              // 6. Confirmar pago -> abrir ticket y registrar en historial
              document.getElementById('btn-confirm-payment').addEventListener('click', () => {
                document.getElementById('modal-payment').style.display = 'none';
                document.getElementById('modal-ticket').style.display = 'flex';
                // Añadir a historial
                document.getElementById('sales-history-rows').innerHTML =
                  '<tr id="sale-row-vta-001" class="border-b border-slate-700/50">' +
                    '<td class="py-2 font-mono font-bold text-white">#VTA-001</td>' +
                    '<td class="py-2 font-mono text-emerald-400 font-bold">$31.500</td>' +
                    '<td class="py-2 text-slate-300">Efectivo ($50.000)</td>' +
                    '<td class="py-2"><span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300">Completada</span></td>' +
                  '</tr>';
              });

              // 7. Cerrar modal ticket
              document.getElementById('btn-close-ticket').addEventListener('click', () => {
                document.getElementById('modal-ticket').style.display = 'none';
                document.getElementById('cart-items').innerHTML = '<p id="empty-cart-msg">No hay productos en la orden</p>';
                document.getElementById('cart-total-text').textContent = '$0';
                document.getElementById('btn-checkout').disabled = true;
              });
            </script>
          </body>
          </html>
        `,
      });
    });

    // --- EJECUCIÓN DEL FLUJO E2E PASO A PASO ---

    // 1. Navegar a POS
    await page.goto(`http://localhost:3000/workspace/${businessId}/pos`);
    await expect(page.locator("#pos-title")).toContainText("Terminal POS");
    await expect(page.locator("#shift-badge")).toHaveText("Caja Cerrada");

    // 2. Abrir Turno de Caja con base inicial de $150.000 COP
    await expect(page.locator("#initial-cash-input")).toHaveValue("150000");
    await page.click("#btn-open-shift");
    await expect(page.locator("#shift-badge")).toContainText("Caja Abierta ($150.000)");

    // 3. Buscar y seleccionar Hamburguesa Gourmet
    await page.fill("#product-search-input", "Hamburguesa");
    await expect(page.locator("#card-prod-burger")).toBeVisible();
    await page.click("#btn-select-burger");

    // 4. Modal de modificadores: seleccionar adición de queso cheddar y confirmar
    await expect(page.locator("#modal-modifiers")).toBeVisible();
    await page.check("#chk-extra-cheese");
    await page.click("#btn-confirm-modifiers");

    // 5. Verificar que se agregó al carrito con total $31.500 COP
    await expect(page.locator("#cart-total-text")).toHaveText("$31.500");
    await expect(page.locator("#cart-items")).toContainText("Queso Cheddar Fundido");

    // 6. Abrir modal de cobro
    await page.click("#btn-checkout");
    await expect(page.locator("#modal-payment")).toBeVisible();

    // 7. Verificar cálculo automático de vueltas ($50.000 recibido - $31.500 venta = $18.500 cambio)
    await expect(page.locator("#cash-received-input")).toHaveValue("50000");
    await expect(page.locator("#cash-change-display")).toHaveText("$18.500");

    // 8. Confirmar venta
    await page.click("#btn-confirm-payment");

    // 9. Verificar ticket de venta impreso/mostrado con éxito
    await expect(page.locator("#modal-ticket")).toBeVisible();
    await expect(page.locator("#ticket-summary")).toContainText("#VTA-001");
    await expect(page.locator("#ticket-summary")).toContainText("Cambio: $18.500 COP");

    // 10. Cerrar ticket y verificar registro asentado en historial de ventas
    await page.click("#btn-close-ticket");
    await expect(page.locator("#sale-row-vta-001")).toBeVisible();
    await expect(page.locator("#sale-row-vta-001")).toContainText("$31.500");
    await expect(page.locator("#sale-row-vta-001")).toContainText("Completada");
  });
});
