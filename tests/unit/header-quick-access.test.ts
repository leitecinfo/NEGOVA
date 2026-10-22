import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildWorkspaceNavSections,
  getDefaultQuickAccessModuleId,
  resolveQuickAccessItem,
  WORKSPACE_MODULES_CATALOG,
} from "@/config/workspace-navigation";
import { updateHeaderQuickAccessAction } from "@/app/workspace/[businessId]/configuracion/actions";

// Mock de autenticación y supabase para server actions
vi.mock("@/lib/auth/workspace-context", () => ({
  verifyWorkspaceAction: vi.fn(),
}));

vi.mock("@/lib/audit/audit-service", () => ({
  logAuditAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Acceso Rápido Configurable en el Header (NEGOVA)", () => {
  const businessId = "biz-restaurant-001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Valores Predeterminados por Tipo de Negocio y Vertical", () => {
    it("restaurantes y comida rápida deben resolver 'pedidos' por defecto", () => {
      expect(getDefaultQuickAccessModuleId("restaurant")).toBe("pedidos");
      expect(getDefaultQuickAccessModuleId("fast_food")).toBe("pedidos");
      expect(getDefaultQuickAccessModuleId("pizzeria")).toBe("pedidos");
    });

    it("negocios de servicios con citas deben resolver 'citas' por defecto", () => {
      expect(
        getDefaultQuickAccessModuleId("barbershop", [
          "provide_services",
          "manage_appointments",
        ])
      ).toBe("citas");
    });

    it("tiendas y comercio general deben resolver 'ventas' por defecto", () => {
      expect(
        getDefaultQuickAccessModuleId("retail_clothing", ["sell_products"])
      ).toBe("ventas");
      expect(getDefaultQuickAccessModuleId("retail")).toBe("ventas");
    });
  });

  describe("2. Resolución de Item de Acceso Rápido (resolveQuickAccessItem)", () => {
    it("debe resolver 'pedidos' por defecto para un restaurante sin configuración previa", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "restaurant",
        commercialActivities: ["sell_products"],
      });

      const resolved = resolveQuickAccessItem(
        sections,
        null,
        "restaurant",
        ["sell_products"]
      );

      expect(resolved).toBeDefined();
      expect(resolved?.id).toBe("pedidos");
      expect(resolved?.label).toBe("Pedidos");
      expect(resolved?.href).toBe(`/workspace/${businessId}/pedidos`);
      expect(resolved?.icon).toBeDefined();
    });

    it("el propietario puede seleccionar 'ventas' y el header debe reflejar dicho módulo", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "restaurant",
        commercialActivities: ["sell_products"],
      });

      const resolved = resolveQuickAccessItem(
        sections,
        "ventas",
        "restaurant",
        ["sell_products"]
      );

      expect(resolved).toBeDefined();
      expect(resolved?.id).toBe("ventas");
      expect(resolved?.label).toBe("Ventas");
      expect(resolved?.href).toBe(`/workspace/${businessId}/ventas`);
    });

    it("el propietario puede seleccionar 'pos' (Vender) y navegar a la ruta correcta", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "restaurant",
        commercialActivities: ["sell_products"],
      });

      const resolved = resolveQuickAccessItem(
        sections,
        "pos",
        "restaurant",
        ["sell_products"]
      );

      expect(resolved).toBeDefined();
      expect(resolved?.id).toBe("pos");
      expect(resolved?.label).toBe("Vender");
      expect(resolved?.href).toBe(`/workspace/${businessId}/pos`);
    });

    it("si el módulo configurado deja de existir o estar disponible, aplica un respaldo seguro sin conceder permisos extra", () => {
      const sections = buildWorkspaceNavSections(businessId, {
        businessType: "retail_clothing",
        commercialActivities: ["sell_products"],
      });

      // retail_clothing no tiene el módulo 'mesas' ni 'pedidos'
      const resolved = resolveQuickAccessItem(
        sections,
        "modulo_inexistente_o_deshabilitado",
        "retail_clothing",
        ["sell_products"]
      );

      expect(resolved).toBeDefined();
      // Debe respaldar a ventas, pos u otro módulo permitido para retail
      expect(["ventas", "pos"]).toContain(resolved?.id);
    });

    it("los módulos exclusivos de gastronomía no aparecen en secciones de retail", () => {
      const sections = buildWorkspaceNavSections("biz-retail-002", {
        businessType: "retail_clothing",
        commercialActivities: ["sell_products"],
      });

      const allItems = sections.flatMap((s) => s.items);
      const moduleIds = allItems.map((i) => i.id);

      expect(moduleIds).not.toContain("mesas");
      expect(moduleIds).not.toContain("cocina");
      expect(moduleIds).not.toContain("despacho");
    });
  });

  describe("3. Autorización y Seguridad Multi-Tenant en Server Action", () => {
    it("el propietario autorizado puede actualizar la preferencia de acceso rápido", async () => {
      const { verifyWorkspaceAction } = await import("@/lib/auth/workspace-context");
      (verifyWorkspaceAction as any).mockResolvedValue({
        success: true,
        context: {
          userId: "usr-owner-1",
          businessId,
          businessName: "Restaurante Don Pedro",
          isOwner: true,
          roleCode: "owner",
        },
      });

      // Mock createClient
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { settings: { pos: { printReceipt: true } } },
          }),
        }),
      });

      vi.doMock("@supabase/supabase-js", () => ({
        createClient: vi.fn(() => ({
          from: vi.fn(() => ({
            select: mockSelect,
            update: mockUpdate,
          })),
        })),
      }));

      const res = await updateHeaderQuickAccessAction(businessId, "ventas");
      expect(res.success).toBe(true);
    });

    it("un auxiliar o colaborador no puede modificar la configuración del acceso rápido", async () => {
      const { verifyWorkspaceAction } = await import("@/lib/auth/workspace-context");
      (verifyWorkspaceAction as any).mockResolvedValue({
        success: true,
        context: {
          userId: "usr-auxiliar-2",
          businessId,
          businessName: "Restaurante Don Pedro",
          isOwner: false,
          roleCode: "auxiliar",
        },
      });

      const res = await updateHeaderQuickAccessAction(businessId, "ventas");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Solo el propietario del negocio puede modificar");
    });

    it("debe rechazar módulos no válidos que no pertenezcan al catálogo canónico", async () => {
      const { verifyWorkspaceAction } = await import("@/lib/auth/workspace-context");
      (verifyWorkspaceAction as any).mockResolvedValue({
        success: true,
        context: {
          userId: "usr-owner-1",
          businessId,
          businessName: "Restaurante Don Pedro",
          isOwner: true,
          roleCode: "owner",
        },
      });

      const res = await updateHeaderQuickAccessAction(
        businessId,
        "https://malicious-site.com/exploit"
      );
      expect(res.success).toBe(false);
      expect(res.error).toContain("no es válido en el catálogo");
    });
  });
});
