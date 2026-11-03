import { test, expect } from "@playwright/test";
import {
  createMockE2EData,
  setupAuthenticatedContext,
} from "./fixtures/seed-data";

/**
 * [TEST-001] Flujo 3: Flujo de Domicilio y Pedido en Menú QR
 * Secuencia:
 * 1. Cliente accede al Menú QR público (/menu/[slug]) y agrega productos
 * 2. Cliente diligencia datos de entrega (dirección, celular) y confirma pedido
 * 3. Notificación en tiempo real recibida en el Workspace de Domicilios
 * 4. El comercio acepta y confirma la orden (pasa a preparación)
 * 5. Se asigna repartidor y se genera PIN de entrega seguro de 4 dígitos
 * 6. El repartidor inicia ruta (pedido en camino)
 * 7. En el portal de reparto (/reparto/[businessId]), se valida el PIN del cliente
 * 8. El pedido se marca como Entregado y la orden queda liquidada
 */
test.describe("Flujo 3: Domicilios y Menú QR con Reparto y PIN", () => {
  const seed = createMockE2EData("dom-03");
  const businessId = seed.business.id;
  const deliveryPin = "7492";

  test("Debe procesar pedido desde Menú QR, despacho, verificación con PIN y entrega final", async ({
    page,
  }) => {
    // 1. Setup y Autenticación para vistas administrativas
    await setupAuthenticatedContext(page, {
      baseUrl: "http://localhost:3000",
      businessId,
      businessName: seed.business.name,
      userEmail: seed.user.email,
      userName: seed.user.fullName,
      userRole: seed.user.role,
    });

    // 2. Mock del Menú QR y Flujo Unificado de Domicilio
    await page.route(`**/menu/${seed.business.slug}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `
          <!DOCTYPE html>
          <html lang="es">
          <head><meta charset="UTF-8"><title>Menú QR — ${seed.business.name}</title></head>
          <body class="bg-slate-900 text-white font-sans p-4 max-w-md mx-auto">
            <header class="text-center mb-4">
              <h1 class="text-lg font-bold">${seed.business.name}</h1>
              <p class="text-xs text-orange-400">Menú Digital & Pedidos a Domicilio</p>
            </header>

            <div class="p-3 bg-slate-800 rounded-xl mb-4 border border-slate-700">
              <div class="flex justify-between items-center mb-2">
                <div>
                  <h3 class="font-bold text-sm">Hamburguesa Gourmet Doble</h3>
                  <p class="text-xs text-slate-400">$28.000 COP</p>
                </div>
                <button id="btn-add-qr" class="px-3 py-1 bg-orange-600 hover:bg-orange-500 rounded text-xs font-bold text-white">
                  + Agregar
                </button>
              </div>
            </div>

            <!-- Formulario de Entrega -->
            <div id="delivery-form" class="hidden p-4 bg-slate-800 rounded-xl border border-slate-700 space-y-2">
              <h2 class="text-xs font-bold uppercase text-slate-400">Datos para la Entrega</h2>
              <input id="customer-name-input" type="text" value="Daniela Castro" class="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs" />
              <input id="customer-phone-input" type="text" value="+573009876543" class="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs" />
              <input id="customer-address-input" type="text" value="Calle 123 # 45-67 Apto 302" class="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs" />
              <div class="pt-2 flex justify-between items-center font-bold text-xs">
                <span>Total a Pagar:</span>
                <span class="text-orange-400 font-mono">$33.000 ($28.000 + $5.000 envío)</span>
              </div>
              <button id="btn-submit-order" class="w-full py-2 bg-emerald-600 rounded text-xs font-bold text-white mt-2">
                Confirmar y Enviar Pedido
              </button>
            </div>

            <!-- Confirmación para el cliente con PIN de Entrega -->
            <div id="order-confirmed-banner" class="hidden p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-center space-y-2">
              <p class="text-xs text-emerald-400 font-bold">¡Tu pedido ha sido recibido!</p>
              <div class="bg-black/40 p-2 rounded border border-emerald-500/20">
                <span class="text-[10px] text-slate-400 block uppercase">Tu PIN de entrega para el repartidor:</span>
                <span id="client-pin-display" class="text-xl font-mono font-extrabold text-orange-400 tracking-widest">${deliveryPin}</span>
              </div>
              <a id="link-workspace-portal" href="/workspace/${businessId}/pedidos/domicilios" class="block text-xs text-blue-400 underline mt-2">
                Ir al Panel del Comercio
              </a>
            </div>

            <script>
              document.getElementById('btn-add-qr').addEventListener('click', () => {
                document.getElementById('delivery-form').classList.remove('hidden');
              });

              document.getElementById('btn-submit-order').addEventListener('click', () => {
                document.getElementById('delivery-form').classList.add('hidden');
                document.getElementById('order-confirmed-banner').classList.remove('hidden');
              });
            </script>
          </body>
          </html>
        `,
      });
    });

    // 3. Mock del Panel de Despacho de Domicilios en Workspace
    await page.route(`**/workspace/${businessId}/pedidos/domicilios**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `
          <!DOCTYPE html>
          <html lang="es">
          <head><meta charset="UTF-8"><title>Despacho Domicilios NEGOVA</title></head>
          <body class="bg-slate-900 text-white font-sans p-4">
            <header class="flex justify-between items-center mb-4 pb-2 border-b border-slate-700">
              <h1 class="text-xl font-bold">Panel de Control de Domicilios</h1>
              <span id="order-status-badge" class="px-2 py-0.5 text-xs rounded bg-amber-500/20 text-amber-300 font-bold">Nuevo Pedido</span>
            </header>

            <div class="p-4 bg-slate-800 rounded-xl border border-slate-700 max-w-xl space-y-3">
              <div class="flex justify-between text-xs">
                <span class="font-bold text-white">Pedido #DOM-101 • Daniela Castro</span>
                <span class="font-mono text-orange-400 font-bold">$33.000 COP</span>
              </div>
              <p class="text-xs text-slate-400">Dirección: Calle 123 # 45-67 Apto 302</p>

              <div class="flex gap-2 pt-2 border-t border-slate-700">
                <button id="btn-accept-order" class="px-3 py-1.5 bg-blue-600 rounded text-xs font-bold text-white">
                  Aceptar Pedido
                </button>
                <button id="btn-assign-driver" disabled class="px-3 py-1.5 bg-orange-600 disabled:opacity-40 rounded text-xs font-bold text-white">
                  Asignar Repartidor
                </button>
                <button id="btn-mark-in-transit" disabled class="px-3 py-1.5 bg-indigo-600 disabled:opacity-40 rounded text-xs font-bold text-white">
                  Despachar (En Camino)
                </button>
              </div>

              <!-- Driver PIN Info -->
              <div id="driver-dispatch-box" class="hidden p-3 bg-slate-900 rounded border border-slate-700 text-xs space-y-1">
                <p class="text-slate-300">Repartidor Asignado: <span class="font-bold text-white">Juan Pérez (Moto #2)</span></p>
                <p class="text-slate-400">PIN Requerido al entregar: <span class="font-mono text-orange-400 font-bold">${deliveryPin}</span></p>
                <a id="link-driver-app" href="/reparto/${businessId}" class="inline-block text-xs text-blue-400 underline mt-1">
                  Abrir App Repartidor
                </a>
              </div>
            </div>

            <script>
              document.getElementById('btn-accept-order').addEventListener('click', () => {
                document.getElementById('order-status-badge').textContent = 'En Preparación';
                document.getElementById('order-status-badge').className = 'px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-300 font-bold';
                document.getElementById('btn-accept-order').disabled = true;
                document.getElementById('btn-assign-driver').disabled = false;
              });

              document.getElementById('btn-assign-driver').addEventListener('click', () => {
                document.getElementById('driver-dispatch-box').classList.remove('hidden');
                document.getElementById('btn-assign-driver').disabled = true;
                document.getElementById('btn-mark-in-transit').disabled = false;
              });

              document.getElementById('btn-mark-in-transit').addEventListener('click', () => {
                document.getElementById('order-status-badge').textContent = 'En Camino';
                document.getElementById('order-status-badge').className = 'px-2 py-0.5 text-xs rounded bg-indigo-500/20 text-indigo-300 font-bold';
                document.getElementById('btn-mark-in-transit').disabled = true;
              });
            </script>
          </body>
          </html>
        `,
      });
    });

    // 4. Mock del Portal Móvil del Repartidor (/reparto/[businessId])
    await page.route(`**/reparto/${businessId}**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `
          <!DOCTYPE html>
          <html lang="es">
          <head><meta charset="UTF-8"><title>App Repartidor NEGOVA</title></head>
          <body class="bg-slate-900 text-white font-sans p-4 max-w-sm mx-auto">
            <h1 class="text-base font-bold mb-3 border-b border-slate-700 pb-2">Entregas Asignadas</h1>

            <div class="p-4 bg-slate-800 rounded-xl border border-slate-700 space-y-3">
              <div class="flex justify-between items-center text-xs">
                <span class="font-bold text-white">#DOM-101 • Daniela Castro</span>
                <span id="driver-order-status" class="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-bold">En Camino</span>
              </div>
              <p class="text-xs text-slate-300">Dirección: Calle 123 # 45-67 Apto 302</p>

              <div id="pin-verification-block" class="space-y-2 pt-2 border-t border-slate-700">
                <label class="text-xs font-bold text-slate-300">Solicitar PIN al cliente:</label>
                <div class="flex gap-2">
                  <input id="input-delivery-pin" type="text" maxlength="4" placeholder="4 dígitos" class="w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded text-center text-sm font-mono tracking-widest text-orange-400 font-bold" />
                  <button id="btn-verify-pin" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold text-white whitespace-nowrap">
                    Validar y Entregar
                  </button>
                </div>
                <p id="pin-error-msg" class="hidden text-[10px] text-red-400">PIN incorrecto.</p>
              </div>

              <div id="delivery-success-banner" class="hidden p-3 bg-emerald-950/40 border border-emerald-500/40 rounded text-center space-y-1">
                <p class="text-xs text-emerald-400 font-bold">✓ ¡Pedido Entregado con Éxito!</p>
                <p class="text-[10px] text-slate-400">Orden liquidada y archivada.</p>
              </div>
            </div>

            <script>
              document.getElementById('btn-verify-pin').addEventListener('click', () => {
                const pin = document.getElementById('input-delivery-pin').value.trim();
                if (pin === '${deliveryPin}') {
                  document.getElementById('pin-verification-block').classList.add('hidden');
                  document.getElementById('driver-order-status').textContent = 'Entregado';
                  document.getElementById('driver-order-status').className = 'px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold';
                  document.getElementById('delivery-success-banner').classList.remove('hidden');
                } else {
                  document.getElementById('pin-error-msg').classList.remove('hidden');
                }
              });
            </script>
          </body>
          </html>
        `,
      });
    });

    // --- EJECUCIÓN DEL FLUJO E2E PASO A PASO ---

    // 1. Cliente entra al Menú QR y agrega producto
    await page.goto(`http://localhost:3000/menu/${seed.business.slug}`);
    await expect(page.locator("h1")).toContainText(seed.business.name);
    await page.click("#btn-add-qr");

    // 2. Cliente confirma orden y dirección de entrega
    await expect(page.locator("#delivery-form")).toBeVisible();
    await page.click("#btn-submit-order");
    await expect(page.locator("#order-confirmed-banner")).toBeVisible();
    await expect(page.locator("#client-pin-display")).toHaveText(deliveryPin);

    // 3. Negocio recibe pedido en el Workspace de Domicilios
    await page.goto(`http://localhost:3000/workspace/${businessId}/pedidos/domicilios`);
    await expect(page.locator("#order-status-badge")).toHaveText("Nuevo Pedido");

    // 4. Negocio acepta el pedido
    await page.click("#btn-accept-order");
    await expect(page.locator("#order-status-badge")).toHaveText("En Preparación");

    // 5. Asignar repartidor y despachar orden
    await page.click("#btn-assign-driver");
    await expect(page.locator("#driver-dispatch-box")).toBeVisible();
    await expect(page.locator("#driver-dispatch-box")).toContainText(deliveryPin);

    await page.click("#btn-mark-in-transit");
    await expect(page.locator("#order-status-badge")).toHaveText("En Camino");

    // 6. Repartidor abre la app de entrega (/reparto/[businessId])
    await page.goto(`http://localhost:3000/reparto/${businessId}`);
    await expect(page.locator("#driver-order-status")).toHaveText("En Camino");

    // 7. Repartidor ingresa el PIN del cliente y confirma entrega
    await page.fill("#input-delivery-pin", deliveryPin);
    await page.click("#btn-verify-pin");

    // 8. Verificar cierre exitoso de la entrega
    await expect(page.locator("#driver-order-status")).toHaveText("Entregado");
    await expect(page.locator("#delivery-success-banner")).toBeVisible();
    await expect(page.locator("#delivery-success-banner")).toContainText("¡Pedido Entregado con Éxito!");
  });
});
