import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WORKSPACE_MODULES_CATALOG,
  getWorkspaceModuleById,
  isGastronomyBusiness,
  buildWorkspaceNavSections,
  CORE_WORKSPACE_GROUPS,
  GASTRONOMY_WORKSPACE_GROUPS,
} from "../../src/config/workspace-navigation";

// Mock de notFound y redirect de Next.js
const mockNotFound = vi.fn();
const mockRedirect = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => {
    mockNotFound();
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

// Mock de requireWorkspaceSession
const mockSession = {
  userId: "user-test-123",
  userEmail: "user@test.com",
  businessId: "biz-test-uuid",
  businessName: "Retail Store",
  businessStatus: "active",
  businessType: "retail",
  roleCode: "owner",
  roleName: "Propietario",
  isOwner: true,
  isSuperAdmin: false,
};

let currentSession = { ...mockSession };

vi.mock("@/lib/auth/workspace-context", () => ({
  requireWorkspaceSession: vi.fn(async (businessId: string, permission?: string) => {
    if (businessId === "biz-invalid-membership") {
      mockRedirect("/login?error=workspace_unauthorized");
      throw new Error("NEXT_REDIRECT:/login?error=workspace_unauthorized");
    }
    if (businessId === "biz-inactive") {
      mockRedirect("/login?error=business_inactive");
      throw new Error("NEXT_REDIRECT:/login?error=business_inactive");
    }
    return { ...currentSession, businessId };
  }),
}));

// Importar el componente de la página para probar su comportamiento de enrutamiento
import WorkspaceModulePlaceholderPage from "../../src/app/workspace/[businessId]/modulo/[moduleId]/page";

describe("Fase 2.7 — Endurecimiento del Catálogo y Verificación de Integridad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSession = { ...mockSession, businessType: "retail" };
  });

  describe("1. Enrutamiento y Verificación de Módulos Dinámicos", () => {
    it("debe invocar notFound() real cuando moduleId es desconocido", async () => {
      await expect(
        WorkspaceModulePlaceholderPage({
          params: Promise.resolve({
            businessId: "biz-test-uuid",
            moduleId: "modulo_fantasma_inexistente",
          }),
        })
      ).rejects.toThrow("NEXT_NOT_FOUND");

      expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it("debe invocar notFound() real si se intenta acceder a un módulo exclusivo de nivel global (/admin)", async () => {
      // Simular módulo global si existiera en catálogo o resolver con nivel global
      const globalMod = WORKSPACE_MODULES_CATALOG.find((m) => m.level === "global");
      if (globalMod) {
        await expect(
          WorkspaceModulePlaceholderPage({
            params: Promise.resolve({
              businessId: "biz-test-uuid",
              moduleId: globalMod.id,
            }),
          })
        ).rejects.toThrow("NEXT_NOT_FOUND");
        expect(mockNotFound).toHaveBeenCalledTimes(1);
      } else {
        // Confirmar que ningún módulo en catálogo de workspace es global
        expect(WORKSPACE_MODULES_CATALOG.every((m) => m.level !== "global")).toBe(true);
      }
    });

    it("debe invocar notFound() real al intentar abrir un módulo gastronómico desde un comercio no gastronómico", async () => {
      currentSession.businessType = "retail"; // Comercio no gastronómico

      await expect(
        WorkspaceModulePlaceholderPage({
          params: Promise.resolve({
            businessId: "biz-test-uuid",
            moduleId: "pedidos",
          }),
        })
      ).rejects.toThrow("NEXT_NOT_FOUND");

      expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it("debe redirigir al módulo real cuando el negocio ES gastronómico y el módulo ya está implementado", async () => {
      currentSession.businessType = "fast_food"; // Comercio gastronómico

      await expect(
        WorkspaceModulePlaceholderPage({
          params: Promise.resolve({
            businessId: "biz-test-uuid",
            moduleId: "pedidos",
          }),
        })
      ).rejects.toThrow("NEXT_REDIRECT:/workspace/biz-test-uuid/pedidos");

      expect(mockNotFound).not.toHaveBeenCalled();
      expect(mockRedirect).toHaveBeenCalledWith("/workspace/biz-test-uuid/pedidos");
    });

    it("debe redirigir a la ruta real cuando se intenta acceder a un módulo que ya está implementado", async () => {
      await expect(
        WorkspaceModulePlaceholderPage({
          params: Promise.resolve({
            businessId: "biz-test-uuid",
            moduleId: "ventas",
          }),
        })
      ).rejects.toThrow("NEXT_REDIRECT:/workspace/biz-test-uuid/ventas");

      expect(mockRedirect).toHaveBeenCalledWith("/workspace/biz-test-uuid/ventas");
      expect(mockNotFound).not.toHaveBeenCalled();
    });

    it("debe renderizar la pantalla informativa para un módulo Core en construcción", async () => {
      const pageElement = await WorkspaceModulePlaceholderPage({
        params: Promise.resolve({
          businessId: "biz-test-uuid",
          moduleId: "inventario",
        }),
      });

      expect(pageElement).toBeDefined();
      expect(mockNotFound).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  describe("2. Aislamiento Multi-Tenant y Seguridad de Sesión", () => {
    it("debe rechazar el acceso si el usuario no tiene membresía activa en el negocio", async () => {
      await expect(
        WorkspaceModulePlaceholderPage({
          params: Promise.resolve({
            businessId: "biz-invalid-membership",
            moduleId: "inventario",
          }),
        })
      ).rejects.toThrow("NEXT_REDIRECT:/login?error=workspace_unauthorized");
    });

    it("debe rechazar el acceso si el negocio se encuentra inactivo", async () => {
      await expect(
        WorkspaceModulePlaceholderPage({
          params: Promise.resolve({
            businessId: "biz-inactive",
            moduleId: "inventario",
          }),
        })
      ).rejects.toThrow("NEXT_REDIRECT:/login?error=business_inactive");
    });

    it("debe garantizar que todas las URLs generadas en el menú pertenezcan al businessId activo", () => {
      const targetBiz = "biz-custom-isolation-123";
      const sections = buildWorkspaceNavSections(targetBiz, {
        businessType: "restaurant",
      });
      const allItems = sections.flatMap((s) => s.items);

      expect(allItems.length).toBeGreaterThan(0);
      for (const item of allItems) {
        expect(item.href.startsWith(`/workspace/${targetBiz}`)).toBe(true);
      }
    });
  });

  describe("3. Reglas de Visibilidad de Módulos", () => {
    it("no debe mostrar la sección de Comida Rápida en comercios minoristas o servicios", () => {
      const retailSections = buildWorkspaceNavSections("biz-1", {
        businessType: "retail",
      });
      expect(retailSections.some((s) => s.id === "comida_rapida")).toBe(false);

      const servicesSections = buildWorkspaceNavSections("biz-1", {
        businessType: "servicios",
      });
      expect(servicesSections.some((s) => s.id === "comida_rapida")).toBe(false);
    });

    it("debe mostrar exactamente los 5 grupos canónicos en comercios", () => {
      const sections = buildWorkspaceNavSections("biz-1", {
        businessType: "tienda_ropa",
      });
      expect(sections.length).toBe(CORE_WORKSPACE_GROUPS.length);
      expect(sections.map((s) => s.id)).toEqual(
        CORE_WORKSPACE_GROUPS.map((g) => g.id)
      );
    });

    it("debe incluir Pedidos y Mesas dentro de Operación para negocios gastronómicos", () => {
      const sections = buildWorkspaceNavSections("biz-1", {
        businessType: "restaurant",
      });
      expect(sections.length).toBe(CORE_WORKSPACE_GROUPS.length);
      const operacion = sections.find((s) => s.id === "operacion");
      expect(operacion?.items.some((i) => i.id === "pedidos")).toBe(true);
      expect(operacion?.items.some((i) => i.id === "mesas")).toBe(true);
    });
  });
});
