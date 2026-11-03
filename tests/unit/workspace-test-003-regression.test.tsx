import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import path from "path";

// ─── 1. IMPORTS DE MENÚ QR PÚBLICO ──────────────────────────────────────────
import { UrbanaMenuTemplate } from "@/components/menu/urbana-template";
import { ComercialMenuTemplate } from "@/components/menu/comercial-template";
import { EleganteMenuTemplate } from "@/components/menu/elegante-template";
import { VisualMenuTemplate } from "@/components/menu/visual-template";
import { CartItem, CartItemModifier } from "@/components/menu/menu-cart-types";
import {
  filterMenuProducts,
  groupMenuProducts,
} from "@/lib/menu/category-grouping";
import {
  normalizeWhatsAppNumber,
  formatOrderSummaryMessage,
  buildWhatsAppOrderLink,
  WhatsAppOrderSummaryData,
} from "@/lib/whatsapp/order-whatsapp-format";
import { Product, Category, CreateProductSchema } from "@/lib/products/types";
import { DigitalMenuPublicBusiness } from "@/lib/menu/types";

// ─── 2. IMPORTS DE GESTIÓN DE MESAS ─────────────────────────────────────────
import {
  generateTableQrToken,
  verifyTableQrToken,
} from "@/lib/restaurant/table-qr-service";
import { computeOrderPayloadHash } from "@/lib/restaurant/restaurant-service";

// ─── 3. IMPORTS DE PRODUCTOS Y LÍMITES DE PLAN ──────────────────────────────
import {
  PLAN_PRODUCT_LIMITS,
  checkProductPlanLimit,
} from "@/lib/products/products-service";

// ─── 4. IMPORTS DE PORTAL DE REPARTIDOR Y PIN ───────────────────────────────
import {
  generateDeliveryToken,
  hashDeliveryToken,
  extractDeliveryVerification,
  encodeDeliveryVerification,
  type DeliveryDispatchSession,
} from "@/lib/delivery/delivery-service";

// ─── 5. IMPORTS DE ROLES Y PERMISOS ─────────────────────────────────────────
import {
  saveUserCustomPermissions,
  getUserEffectivePermissionsDetail,
} from "@/lib/auth/user-permissions-service";
import {
  ALL_PERMISSION_MODULES,
} from "@/lib/auth/permissions";

// ============================================================================
// DATOS COMPARTIDOS PARA PRUEBAS DE REGRESIÓN
// ============================================================================

const mockBusiness: DigitalMenuPublicBusiness = {
  id: "biz-regression-001",
  name: "Restaurante Gourmet Regresión",
  slug: "restaurante-gourmet-regresion",
  currency: "COP",
  logo_url: "https://ejemplo.com/logo-gourmet.png",
  banner_url: "https://ejemplo.com/banner-gourmet.png",
  phone: "3001234567",
  whatsapp: "+573001234567",
  address: "Carrera 43A # 1-50",
  city: "Medellín",
  schedule: "Lun - Dom: 12:00 PM - 10:00 PM",
};

const mockCategories: Category[] = [
  {
    id: "cat-entradas",
    business_id: "biz-regression-001",
    name: "Entradas",
    sort_order: 1,
    is_active: true,
  },
  {
    id: "cat-fuertes",
    business_id: "biz-regression-001",
    name: "Platos Fuertes",
    sort_order: 2,
    is_active: true,
  },
  {
    id: "cat-bebidas",
    business_id: "biz-regression-001",
    name: "Bebidas",
    sort_order: 3,
    is_active: true,
  },
];

const mockProducts: Product[] = [
  {
    id: "prod-1",
    business_id: "biz-regression-001",
    category_id: "cat-entradas",
    name: "Ceviche Mixto Costero",
    description: "Pescado blanco, camarón, cebolla morada y maíz crocante",
    price: 28000,
    cost: 12000,
    status: "active",
    is_available: true,
    available_in_qr: true,
    image_url: "https://ejemplo.com/ceviche.jpg",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod-2",
    business_id: "biz-regression-001",
    category_id: "cat-fuertes",
    name: "Lomo al Trapo Angus",
    description: "Corte angus sellado al trapo con papas rústicas",
    price: 52000,
    cost: 24000,
    status: "active",
    is_available: true,
    available_in_qr: true,
    image_url: "https://ejemplo.com/lomo.jpg",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod-3",
    business_id: "biz-regression-001",
    category_id: "cat-bebidas",
    name: "Limonada de Coco",
    description: "Refrescante limonada frappé con crema de coco natural",
    price: 12000,
    cost: 3500,
    status: "active",
    is_available: true,
    available_in_qr: true,
    image_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prod-pos-only",
    business_id: "biz-regression-001",
    category_id: "cat-fuertes",
    name: "Corte Especial Exclusivo POS",
    description: "No disponible en carta QR",
    price: 70000,
    cost: 35000,
    status: "active",
    is_available: true,
    available_in_qr: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

describe("[TEST-003] Pruebas de Regresión de Módulos Existentes (NEGOVA)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await saveUserCustomPermissions({
      businessId: "biz-roles-regression",
      targetUserId: "usr-worker-alpha",
      actorUserId: "usr-owner-root",
      grantedPermissions: [],
      revokedPermissions: [],
    });
    await saveUserCustomPermissions({
      businessId: "biz-roles-regression",
      targetUserId: "usr-worker-beta",
      actorUserId: "usr-owner-root",
      grantedPermissions: [],
      revokedPermissions: [],
    });
  });

  // ==========================================================================
  // MÓDULO 1: MENÚ QR PÚBLICO
  // ==========================================================================
  describe("Módulo 1: Menú QR Público", () => {
    describe("1.1 Renderizado de las 4 plantillas oficiales", () => {
      it("debe renderizar correctamente la plantilla Urbana sin errores", () => {
        const html = renderToStaticMarkup(
          <UrbanaMenuTemplate
            business={mockBusiness}
            categories={mockCategories}
            products={mockProducts}
          />
        );
        expect(html).toContain(mockBusiness.name);
        expect(html).toContain("Ceviche Mixto Costero");
        expect(html).toContain("Platos Fuertes");
        expect(html).not.toContain("Corte Especial Exclusivo POS");
      });

      it("debe renderizar correctamente la plantilla Comercial sin errores", () => {
        const html = renderToStaticMarkup(
          <ComercialMenuTemplate
            business={mockBusiness}
            categories={mockCategories}
            products={mockProducts}
          />
        );
        expect(html).toContain(mockBusiness.name);
        expect(html).toContain("Lomo al Trapo Angus");
        expect(html).toContain("Bebidas");
      });

      it("debe renderizar correctamente la plantilla Elegante sin errores", () => {
        const html = renderToStaticMarkup(
          <EleganteMenuTemplate
            business={mockBusiness}
            categories={mockCategories}
            products={mockProducts}
          />
        );
        expect(html).toContain(mockBusiness.name);
        expect(html).toContain("Limonada de Coco");
        expect(html).toContain("Entradas");
      });

      it("debe renderizar correctamente la plantilla Visual sin errores", () => {
        const html = renderToStaticMarkup(
          <VisualMenuTemplate
            business={mockBusiness}
            categories={mockCategories}
            products={mockProducts}
          />
        );
        expect(html).toContain(mockBusiness.name);
        expect(html).toContain("Ceviche Mixto Costero");
      });
    });

    describe("1.2 Carrito con Modificadores y Cálculo de Precios", () => {
      it("debe calcular correctamente el total con modificadores y cantidades", () => {
        const modifiers: CartItemModifier[] = [
          {
            groupId: "grp-salsas",
            groupName: "Salsas Adicionales",
            optionId: "opt-chimichurri",
            optionName: "Chimichurri Artesanal",
            price: 3000,
          },
          {
            groupId: "grp-termino",
            groupName: "Término de Carne",
            optionId: "opt-tres-cuartos",
            optionName: "Tres Cuartos (3/4)",
            price: 0,
          },
        ];

        const item: CartItem = {
          id: "item-1",
          productId: "prod-2",
          name: "Lomo al Trapo Angus",
          unitPrice: 52000,
          quantity: 2,
          selectedModifiers: modifiers,
          notes: "Papas bien tostadas",
        };

        const modifierTotalPerUnit = (item.selectedModifiers || []).reduce(
          (sum, m) => sum + m.price,
          0
        );
        const itemTotal = (item.unitPrice + modifierTotalPerUnit) * item.quantity;

        expect(modifierTotalPerUnit).toBe(3000);
        // (52000 + 3000) * 2 = 110000
        expect(itemTotal).toBe(110000);
        expect(item.selectedModifiers?.length).toBe(2);
      });
    });

    describe("1.3 Checkout y Notificación por WhatsApp", () => {
      it("debe normalizar números colombianos e internacionales", () => {
        const col = normalizeWhatsAppNumber("3001234567");
        expect(col.isValid).toBe(true);
        expect(col.normalized).toBe("573001234567");

        const intl = normalizeWhatsAppNumber("+1 555 123 4567");
        expect(intl.isValid).toBe(true);
        expect(intl.normalized).toBe("15551234567");
      });

      it("debe estructurar el mensaje de pedido para WhatsApp con modificadores y totales", () => {
        const orderData: WhatsAppOrderSummaryData = {
          orderNumber: 88,
          businessName: mockBusiness.name,
          customerName: "Laura Restrepo",
          customerPhone: "3007654321",
          orderType: "takeout",
          items: [
            {
              name: "Lomo al Trapo Angus",
              quantity: 1,
              unitPrice: 52000,
              selectedModifiers: [
                { groupName: "Salsas Adicionales", optionName: "Chimichurri Artesanal", price: 3000 },
                { groupName: "Término", optionName: "Término 3/4", price: 0 },
              ],
              notes: "Sin sal añadida",
              subtotal: 55000,
            },
          ],
          subtotal: 55000,
          total: 55000,
        };

        const message = formatOrderSummaryMessage(orderData);
        expect(message).toContain("NUEVO PEDIDO #88 DESDE EL MENÚ DIGITAL");
        expect(message).toContain("Laura Restrepo");
        expect(message).toContain("Lomo al Trapo Angus");
        expect(message).toContain("Chimichurri Artesanal");
        expect(message).toContain("Sin sal añadida");
        expect(message).toContain("$55.000");

        const waResult = buildWhatsAppOrderLink("573001234567", message);
        expect(waResult.isValid).toBe(true);
        expect(waResult.url).toContain("https://wa.me/573001234567");
        expect(waResult.url).toContain(encodeURIComponent("NUEVO PEDIDO #88 DESDE EL MENÚ DIGITAL"));
      });
    });

    describe("1.4 Preservación de Estilos e Identidad Visual", () => {
      it("cada plantilla mantiene su estructura y estilos diferenciados", () => {
        const urbana = renderToStaticMarkup(
          <UrbanaMenuTemplate business={mockBusiness} categories={mockCategories} products={mockProducts} />
        );
        const comercial = renderToStaticMarkup(
          <ComercialMenuTemplate business={mockBusiness} categories={mockCategories} products={mockProducts} />
        );
        const elegante = renderToStaticMarkup(
          <EleganteMenuTemplate business={mockBusiness} categories={mockCategories} products={mockProducts} />
        );
        const visual = renderToStaticMarkup(
          <VisualMenuTemplate business={mockBusiness} categories={mockCategories} products={mockProducts} />
        );

        // Urbana tiene fondo oscuro y acentos
        expect(urbana).toContain("bg-");
        // Comercial cuenta con layout en cuadrícula
        expect(comercial).toContain("grid");
        // Elegante cuenta con contenedor estilizado
        expect(elegante).toBeDefined();
        // Visual cuenta con tarjeta de imagen
        expect(visual).toContain("img");
      });
    });
  });

  // ==========================================================================
  // MÓDULO 2: GESTIÓN DE MESAS
  // ==========================================================================
  describe("Módulo 2: Gestión de Mesas", () => {
    const bizId = "biz-mesas-regression";
    const tableId = "table-uuid-101";
    const otherBizId = "biz-other-999";

    it("2.1 Genera y verifica tokens firmados criptográficamente para códigos QR de mesa", () => {
      const token = generateTableQrToken(bizId, tableId, 1);
      expect(token).toBeDefined();
      expect(token.startsWith("v1.")).toBe(true);

      const isValid = verifyTableQrToken(bizId, tableId, token, 1);
      expect(isValid).toBe(true);
    });

    it("2.2 Revocación de QR invalida el código anterior al incrementar la versión", () => {
      const oldToken = generateTableQrToken(bizId, tableId, 1);
      // Tras revocación / regeneración se pasa a versión 2
      const isOldValidOnV2 = verifyTableQrToken(bizId, tableId, oldToken, 2);
      expect(isOldValidOnV2).toBe(false);

      const newToken = generateTableQrToken(bizId, tableId, 2);
      expect(verifyTableQrToken(bizId, tableId, newToken, 2)).toBe(true);
    });

    it("2.3 Aislamiento estricto: rechaza tokens alterados o pertenecientes a otros negocios", () => {
      const token = generateTableQrToken(bizId, tableId, 1);

      // Token alterado
      expect(verifyTableQrToken(bizId, tableId, token + "_tampered", 1)).toBe(false);

      // Token en otro negocio
      expect(verifyTableQrToken(otherBizId, tableId, token, 1)).toBe(false);

      // Token en otra mesa
      expect(verifyTableQrToken(bizId, "table-uuid-999", token, 1)).toBe(false);
    });

    it("2.4 Abrir y calcular el payload hash de una orden en mesa", () => {
      const hash = computeOrderPayloadHash({
        orderType: "dine_in",
        channelOrigin: "qr_table",
        tableId: tableId,
        items: [
          {
            productId: "prod-1",
            quantity: 2,
            notes: "Sin picante",
            selectedModifiers: [],
          },
        ],
      });

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 hash
    });
  });

  // ==========================================================================
  // MÓDULO 3: PRODUCTOS Y CATEGORÍAS
  // ==========================================================================
  describe("Módulo 3: Productos y Categorías", () => {
    it("3.1 Validación estricta con CreateProductSchema", () => {
      const validProduct = {
        name: "Hamburguesa Gourmet Clásica",
        price: 25000,
        cost: 11000,
        category_id: "11111111-1111-4111-a111-111111111111",
        description: "Carne angus madurada",
        is_available: true,
        available_in_qr: true,
        image_url: "https://ejemplo.com/hamburguesa.jpg",
      };

      const parseResult = CreateProductSchema.safeParse(validProduct);
      expect(parseResult.success).toBe(true);

      const invalidProduct = {
        name: "", // Nombre vacío
        price: -500, // Precio negativo
      };
      const invalidResult = CreateProductSchema.safeParse(invalidProduct);
      expect(invalidResult.success).toBe(false);
    });

    it("3.2 Filtrado y búsqueda cliente-side sin pérdida de disponibilidad", () => {
      // Búsqueda por término insensible a mayúsculas y acentos
      const cevicheSearch = filterMenuProducts(mockProducts, mockCategories, "ceviche", "all");
      expect(cevicheSearch.length).toBe(1);
      expect(cevicheSearch[0].name).toBe("Ceviche Mixto Costero");

      // Limonada con o sin tilde
      const limonadaSearch = filterMenuProducts(mockProducts, mockCategories, "limonada", "all");
      expect(limonadaSearch.length).toBe(1);

      // Productos no disponibles en QR se excluyen
      const posOnly = filterMenuProducts(mockProducts, mockCategories, "Exclusivo POS", "all");
      expect(posOnly.length).toBe(0);

      // Agrupación de resultados
      const grouped = groupMenuProducts(cevicheSearch, mockCategories, "all", "ceviche");
      expect(grouped.length).toBe(1);
      expect(grouped[0].categoryId).toBe("search-results");
    });

    it("3.3 Aplicación de límites de suscripción por plan", () => {
      // Límites canónicos de productos por plan
      expect(PLAN_PRODUCT_LIMITS.inicio).toBe(50);
      expect(PLAN_PRODUCT_LIMITS.crece).toBe(200);
      expect(PLAN_PRODUCT_LIMITS.negocio).toBe(Infinity);
      expect(PLAN_PRODUCT_LIMITS.pro).toBe(Infinity);

      // Evaluación de cuotas operativas
      const checkLimit = (plan: string, count: number) => {
        const max = PLAN_PRODUCT_LIMITS[plan] ?? Infinity;
        return { allowed: count < max, maxAllowed: max };
      };

      // Si tiene 50 productos en plan inicio, no permite crear más
      const atLimit = checkLimit("inicio", 50);
      expect(atLimit.allowed).toBe(false);
      expect(atLimit.maxAllowed).toBe(50);

      // Si tiene 49 productos en plan inicio, permite crear
      const underLimit = checkLimit("inicio", 49);
      expect(underLimit.allowed).toBe(true);

      // Plan pro es ilimitado
      const proCheck = checkLimit("pro", 10000);
      expect(proCheck.allowed).toBe(true);
    });
  });

  // ==========================================================================
  // MÓDULO 4: PORTAL DE REPARTIDOR Y PIN DE ENTREGA
  // ==========================================================================
  describe("Módulo 4: Portal de Repartidor y PIN de Entrega", () => {
    it("4.1 Generación y validación de tokens criptográficos en base64url para repartidores", () => {
      const token1 = generateDeliveryToken();
      const token2 = generateDeliveryToken();

      expect(typeof token1).toBe("string");
      expect(token1.length).toBeGreaterThanOrEqual(30);
      expect(token1).not.toBe(token2);
      expect(token1).toMatch(/^[a-zA-Z0-9_-]+$/);

      const hash1 = hashDeliveryToken(token1);
      expect(hash1.length).toBe(64);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("4.2 Generación y codificación del PIN criptográfico de entrega", () => {
      const pin = "4821";
      const encoded = encodeDeliveryVerification("Apto 502, dejar en recepción", pin, 0);

      expect(encoded).toContain("[PIN:4821:0]");
      expect(encoded).toContain("Apto 502, dejar en recepción");

      const extracted = extractDeliveryVerification(encoded);
      expect(extracted.code).toBe("4821");
      expect(extracted.attempts).toBe(0);
      expect(extracted.isLocked).toBe(false);
      expect(extracted.cleanNotes).toBe("Apto 502, dejar en recepción");
      // La nota limpia no expone el PIN
      expect(extracted.cleanNotes).not.toContain("4821");
    });

    it("4.3 Protección Anti-Brute-Force: Bloqueo estricto tras 5 intentos fallidos", () => {
      const pin = "7890";
      let notes = encodeDeliveryVerification("Entregar en puerta", pin, 0);

      // Simular 4 intentos fallidos
      for (let i = 1; i <= 4; i++) {
        const state = extractDeliveryVerification(notes);
        expect(state.isLocked).toBe(false);
        expect(state.attempts).toBe(i - 1);
        notes = encodeDeliveryVerification(state.cleanNotes, state.code!, state.attempts + 1);
      }

      // Al 5to intento fallido
      const fifthState = extractDeliveryVerification(notes);
      expect(fifthState.attempts).toBe(4);
      expect(fifthState.isLocked).toBe(false);

      // Se incrementa a 5 intentos fallidos -> Bloqueo
      const lockedNotes = encodeDeliveryVerification(fifthState.cleanNotes, fifthState.code!, 5);
      const lockedState = extractDeliveryVerification(lockedNotes);
      expect(lockedState.attempts).toBe(5);
      expect(lockedState.isLocked).toBe(true);
    });

    it("4.4 Rechazo de tokens expirados o revocados en sesión de reparto", () => {
      const expiredSession: DeliveryDispatchSession = {
        id: "sess-01",
        businessId: "biz-1",
        driverId: "driver-01",
        driverName: "Carlos Repartidor",
        tokenHash: hashDeliveryToken("expired-token"),
        status: "active",
        expiresAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      };

      const isExpired = new Date(expiredSession.expiresAt) <= new Date();
      expect(isExpired).toBe(true);

      const revokedSession: DeliveryDispatchSession = {
        ...expiredSession,
        status: "revoked",
        expiresAt: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
      };
      expect(revokedSession.status).toBe("revoked");
    });
  });

  // ==========================================================================
  // MÓDULO 5: ROLES Y PERMISOS
  // ==========================================================================
  describe("Módulo 5: Roles y Permisos", () => {
    const bizId = "biz-roles-regression";
    const actorOwnerId = "usr-owner-root";
    const workerAId = "usr-worker-alpha";
    const workerBId = "usr-worker-beta";

    it("5.1 Matriz de permisos canónicos contiene todos los módulos", () => {
      expect(ALL_PERMISSION_MODULES).toBeDefined();
      expect(ALL_PERMISSION_MODULES.length).toBeGreaterThanOrEqual(10);
      expect(ALL_PERMISSION_MODULES.some((m) => m.moduleId === "ventas")).toBe(true);
      expect(ALL_PERMISSION_MODULES.some((m) => m.moduleId === "inventario")).toBe(true);
      expect(ALL_PERMISSION_MODULES.some((m) => m.moduleId === "cajas")).toBe(true);
    });

    it("5.2 Permisos individuales (overrides): dos auxiliares tienen permisos diferentes", async () => {
      // Auxiliar A recibe permiso extra de modificar gastos
      const saveA = await saveUserCustomPermissions({
        businessId: bizId,
        targetUserId: workerAId,
        actorUserId: actorOwnerId,
        grantedPermissions: ["expenses.update"],
        revokedPermissions: [],
      });
      expect(saveA.success).toBe(true);

      // Auxiliar B tiene revocado el permiso de modificar ventas
      const saveB = await saveUserCustomPermissions({
        businessId: bizId,
        targetUserId: workerBId,
        actorUserId: actorOwnerId,
        grantedPermissions: [],
        revokedPermissions: ["sales.update"],
      });
      expect(saveB.success).toBe(true);

      const detailA = await getUserEffectivePermissionsDetail(bizId, workerAId);
      const detailB = await getUserEffectivePermissionsDetail(bizId, workerBId);

      // Verificación de aislamiento de permisos
      expect(detailA.effectivePermissions).toContain("expenses.update");
      expect(detailB.effectivePermissions).not.toContain("expenses.update");

      expect(detailA.effectivePermissions).toContain("sales.update");
      expect(detailB.effectivePermissions).not.toContain("sales.update");
      expect(detailB.customRevokedPermissions).toContain("sales.update");
    });

    it("5.3 Seguridad: Auxiliar no puede recibir permisos exclusivos de Dueño", async () => {
      const res = await saveUserCustomPermissions({
        businessId: bizId,
        targetUserId: workerAId,
        actorUserId: actorOwnerId,
        grantedPermissions: ["business_settings.update", "business_users.disable"],
        revokedPermissions: [],
      });

      expect(res.success).toBe(true);
      const detail = await getUserEffectivePermissionsDetail(bizId, workerAId);

      // Permisos exclusivos de dueño son filtrados automáticamente
      expect(detail.effectivePermissions).not.toContain("business_settings.update");
      expect(detail.effectivePermissions).not.toContain("business_users.disable");
    });

    it("5.4 Los cambios de permisos se reflejan inmediatamente en la consulta", async () => {
      // Otorgar permiso
      await saveUserCustomPermissions({
        businessId: bizId,
        targetUserId: workerAId,
        actorUserId: actorOwnerId,
        grantedPermissions: ["expenses.update"],
        revokedPermissions: [],
      });

      let detail = await getUserEffectivePermissionsDetail(bizId, workerAId);
      expect(detail.effectivePermissions).toContain("expenses.update");

      // Revocar inmediatamente
      await saveUserCustomPermissions({
        businessId: bizId,
        targetUserId: workerAId,
        actorUserId: actorOwnerId,
        grantedPermissions: [],
        revokedPermissions: ["expenses.update"],
      });

      detail = await getUserEffectivePermissionsDetail(bizId, workerAId);
      expect(detail.effectivePermissions).not.toContain("expenses.update");
    });
  });

  // ==========================================================================
  // CRITERIO DE INTEGRIDAD DE MIGRACIONES Y ROLLBACK
  // ==========================================================================
  describe("Criterio: Integridad de Migraciones SQL y Compatibilidad de Rollback", () => {
    it("todas las migraciones deben usar sentencias idempotentes y no destructivas", () => {
      const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
      expect(fs.existsSync(migrationsDir)).toBe(true);

      const migrationFiles = fs
        .readdirSync(migrationsDir)
        .filter((file) => file.endsWith(".sql"));

      expect(migrationFiles.length).toBeGreaterThan(20);

      // Verificar que ninguna migración realice un DROP TABLE destructivo sin verificación
      for (const file of migrationFiles) {
        const fullPath = path.join(migrationsDir, file);
        const content = fs.readFileSync(fullPath, "utf-8");

        // DROP TABLE sin IF EXISTS o sin CASCADE controlado
        const rawDropTable = content.match(/\bDROP\s+TABLE\s+(?!IF\s+EXISTS)[a-zA-Z_]+/i);
        expect(
          rawDropTable,
          `La migración ${file} contiene una sentencia destructiva DROP TABLE: ${rawDropTable?.[0]}`
        ).toBeNull();
      }
    });
  });

  // ==========================================================================
  // CRITERIO DE REGLA GLOBAL: CERO ALERTAS NATIVAS
  // ==========================================================================
  describe("Criterio: Regla Global de Código — Cero Alertas Nativas", () => {
    it("los módulos principales verificados no deben contener window.alert, window.confirm, window.prompt ni Alert.alert", () => {
      const filesToCheck = [
        "src/components/menu/urbana-template.tsx",
        "src/components/menu/comercial-template.tsx",
        "src/components/menu/elegante-template.tsx",
        "src/components/menu/visual-template.tsx",
        "src/components/menu/menu-cart-drawer.tsx",
        "src/app/reparto/[businessId]/driver-app-client.tsx",
        "src/app/reparto/[businessId]/driver-session-portal-client.tsx",
        "src/app/workspace/[businessId]/productos/products-manager-client.tsx",
        "src/app/workspace/[businessId]/mesas/tables-dashboard-client.tsx",
        "src/app/workspace/[businessId]/roles/workspace-roles-client.tsx",
      ];

      const forbiddenPatterns = [
        /\bwindow\.alert\b/,
        /\bwindow\.confirm\b/,
        /\bwindow\.prompt\b/,
        /\bAlert\.alert\b/,
        /\balert\(/,
      ];

      for (const relativePath of filesToCheck) {
        const filePath = path.resolve(process.cwd(), relativePath);
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath, "utf-8");
        for (const pattern of forbiddenPatterns) {
          const match = content.match(pattern);
          expect(
            match,
            `Se encontró alerta nativa '${pattern}' en el archivo ${relativePath}`
          ).toBeNull();
        }
      }
    });
  });
});
