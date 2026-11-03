import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isProductAvailableInPos,
  isProductAvailableInQr,
  isProductAvailableOnline,
  resolveProductChannels,
  Product,
} from "@/lib/products/types";
import {
  getProducts,
  updateProductChannelAvailability,
} from "@/lib/products/products-service";
import {
  filterMenuProducts,
  getMenuCategoryPills,
} from "@/lib/menu/category-grouping";
import {
  broadcastProductUpdate,
  broadcastProductDelete,
  subscribeToCatalogUpdates,
} from "@/lib/products/channel-sync";

// Mock @supabase/supabase-js used by getAdminClient() in products-service.ts
const mockFrom = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

const BIZ_ID = "22222222-2222-4222-8222-222222222222";
const CAT_ID = "33333333-3333-4333-8333-333333333333";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: overrides.id ?? "11111111-1111-4111-8111-111111111111",
    business_id: overrides.business_id ?? BIZ_ID,
    category_id: overrides.category_id ?? CAT_ID,
    name: overrides.name ?? "Hamburguesa Artesanal",
    description: overrides.description ?? "Con queso cheddar y tocineta",
    price: overrides.price ?? 28000,
    cost_price: overrides.cost_price ?? 12000,
    tax_percentage: overrides.tax_percentage ?? 8,
    tax_included_in_price: overrides.tax_included_in_price ?? true,
    is_available: "is_available" in overrides ? overrides.is_available! : true,
    available_in_pos: "available_in_pos" in overrides ? overrides.available_in_pos : true,
    available_in_qr: "available_in_qr" in overrides ? overrides.available_in_qr : true,
    available_online: "available_online" in overrides ? overrides.available_online : true,
    image_url: overrides.image_url ?? null,
    sort_order: overrides.sort_order ?? 0,
    status: overrides.status ?? "active",
    metadata: overrides.metadata ?? {},
    created_at: overrides.created_at ?? "2026-10-29T12:00:00Z",
    updated_at: overrides.updated_at ?? "2026-10-29T12:00:00Z",
  };
}

describe("CAT-005: Control de canales de venta por producto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Helpers de disponibilidad por canal (POS, QR, Online)", () => {
    it("retorna true por defecto para los 3 canales cuando no se especifican", () => {
      const p = { id: "p1", name: "Café" };
      expect(isProductAvailableInPos(p)).toBe(true);
      expect(isProductAvailableInQr(p)).toBe(true);
      expect(isProductAvailableOnline(p)).toBe(true);
      expect(resolveProductChannels(p)).toEqual({
        available_in_pos: true,
        available_in_qr: true,
        available_online: true,
      });
    });

    it("respeta las banderas de nivel superior (available_in_pos, available_in_qr, available_online)", () => {
      const p = makeProduct({
        available_in_pos: false,
        available_in_qr: true,
        available_online: false,
      });
      expect(isProductAvailableInPos(p)).toBe(false);
      expect(isProductAvailableInQr(p)).toBe(true);
      expect(isProductAvailableOnline(p)).toBe(false);
    });

    it("usa fallback en metadata y show_in_qr_menu heredado para available_in_qr", () => {
      const legacyHiddenQr = {
        id: "p2",
        metadata: {
          show_in_qr_menu: false,
          available_in_pos: true,
          available_online: false,
        },
      };
      expect(isProductAvailableInQr(legacyHiddenQr)).toBe(false);
      expect(isProductAvailableInPos(legacyHiddenQr)).toBe(true);
      expect(isProductAvailableOnline(legacyHiddenQr)).toBe(false);
    });
  });

  describe("2. Filtrado en Menú QR y Categorías Públicas", () => {
    const categories = [
      {
        id: CAT_ID,
        business_id: BIZ_ID,
        parent_category_id: null,
        name: "Fuertes",
        description: null,
        sort_order: 0,
        status: "active" as const,
      },
    ];

    it("un producto desactivado para QR (available_in_qr = false) NO aparece en el menú público", () => {
      const products = [
        makeProduct({ id: "p-visible", name: "Plato QR", available_in_qr: true }),
        makeProduct({ id: "p-hidden-qr", name: "Combo Exclusivo POS", available_in_qr: false }),
        makeProduct({
          id: "p-hidden-meta",
          name: "Insumo Interno",
          available_in_qr: undefined,
          metadata: { available_in_qr: false },
        }),
      ];

      const filtered = filterMenuProducts(products, categories, "", "all");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("p-visible");
    });

    it("las píldoras de categorías del menú QR solo cuentan productos con available_in_qr = true", () => {
      const products = [
        makeProduct({ id: "p1", category_id: CAT_ID, available_in_qr: true }),
        makeProduct({ id: "p2", category_id: CAT_ID, available_in_qr: false }),
      ];

      const pills = getMenuCategoryPills(categories, products, true);
      expect(pills).toHaveLength(1);
      expect(pills[0].count).toBe(1);
    });
  });

  describe("3. Filtrado en POS y Servicio de Productos (products-service)", () => {
    it("getProducts con channel: 'pos' excluye productos con available_in_pos = false", async () => {
      const dbRows = [
        makeProduct({ id: "pos-1", name: "Gaseosa", available_in_pos: true, available_in_qr: true }),
        makeProduct({ id: "pos-2", name: "Solo Web", available_in_pos: false, available_online: true }),
      ];

      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockImplementation(() => builder),
        then: (resolve: any) => resolve({ data: dbRows, error: null }),
      };
      mockFrom.mockReturnValue(builder);

      const posProducts = await getProducts(BIZ_ID, { status: "active", channel: "pos" });
      expect(posProducts).toHaveLength(1);
      expect(posProducts[0].id).toBe("pos-1");
    });

    it("getProducts con channel: 'qr' excluye productos con available_in_qr = false", async () => {
      const dbRows = [
        makeProduct({ id: "qr-1", name: "Pizza", available_in_qr: true }),
        makeProduct({ id: "qr-2", name: "Empaque Caja", available_in_qr: false }),
      ];

      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockImplementation(() => builder),
        then: (resolve: any) => resolve({ data: dbRows, error: null }),
      };
      mockFrom.mockReturnValue(builder);

      const qrProducts = await getProducts(BIZ_ID, { status: "active", channel: "qr" });
      expect(qrProducts).toHaveLength(1);
      expect(qrProducts[0].id).toBe("qr-1");
    });

    it("updateProductChannelAvailability actualiza y sincroniza el canal en columna y metadata", async () => {
      const prodId = "44444444-4444-4444-8444-444444444444";
      const existing = makeProduct({
        id: prodId,
        available_in_pos: true,
        available_in_qr: true,
        available_online: true,
        metadata: { sku: "SKU-10" },
      });

      let capturedUpdatePayload: any = null;

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: existing, error: null }),
            }),
          }),
        }),
        update: vi.fn().mockImplementation((payload: any) => {
          capturedUpdatePayload = payload;
          return {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { ...existing, ...payload },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }),
      }));

      const updated = await updateProductChannelAvailability(BIZ_ID, prodId, {
        available_in_qr: false,
      });

      expect(capturedUpdatePayload.available_in_qr).toBe(false);
      expect(capturedUpdatePayload.metadata.available_in_qr).toBe(false);
      expect(capturedUpdatePayload.metadata.show_in_qr_menu).toBe(false);
      expect(updated.available_in_qr).toBe(false);
      expect(updated.available_in_pos).toBe(true);
    });
  });

  describe("4. Sincronización en tiempo real sin recargar página", () => {
    it("propaga cambios de disponibilidad de canal instantáneamente a suscriptores de POS y QR", () => {
      const initialProduct = makeProduct({
        id: "55555555-5555-4555-8555-555555555555",
        business_id: BIZ_ID,
        available_in_pos: true,
        available_in_qr: true,
      });

      let posVisibleProducts = [initialProduct];
      let qrVisibleProducts = [initialProduct];

      const unsubPos = subscribeToCatalogUpdates(BIZ_ID, {
        onProductUpsert: (updated) => {
          posVisibleProducts = posVisibleProducts
            .map((p) => (p.id === updated.id ? updated : p))
            .filter((p) => isProductAvailableInPos(p));
        },
        onProductDelete: (id) => {
          posVisibleProducts = posVisibleProducts.filter((p) => p.id !== id);
        },
      });

      const unsubQr = subscribeToCatalogUpdates(BIZ_ID, {
        onProductUpsert: (updated) => {
          qrVisibleProducts = qrVisibleProducts
            .map((p) => (p.id === updated.id ? updated : p))
            .filter((p) => isProductAvailableInQr(p));
        },
        onProductDelete: (id) => {
          qrVisibleProducts = qrVisibleProducts.filter((p) => p.id !== id);
        },
      });

      // Desactivar para QR en tiempo real
      const disabledForQr = makeProduct({
        ...initialProduct,
        available_in_qr: false,
        metadata: { available_in_qr: false, show_in_qr_menu: false },
      });

      broadcastProductUpdate(BIZ_ID, disabledForQr);

      expect(qrVisibleProducts).toHaveLength(0);
      expect(posVisibleProducts).toHaveLength(1);

      // Ahora desactivar para POS en tiempo real
      const disabledForBoth = makeProduct({
        ...disabledForQr,
        available_in_pos: false,
        metadata: { available_in_pos: false, available_in_qr: false },
      });

      broadcastProductUpdate(BIZ_ID, disabledForBoth);
      expect(posVisibleProducts).toHaveLength(0);

      // Archivar/eliminar producto en tiempo real
      posVisibleProducts = [initialProduct];
      broadcastProductDelete(BIZ_ID, initialProduct.id);
      expect(posVisibleProducts).toHaveLength(0);

      unsubPos();
      unsubQr();
    });
  });
});
