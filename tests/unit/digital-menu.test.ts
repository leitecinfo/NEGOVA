import { describe, it, expect, vi } from "vitest";
import {
  DIGITAL_MENU_TEMPLATES,
  DEFAULT_DIGITAL_MENU_SETTINGS,
  DigitalMenuTemplateId,
} from "@/lib/menu/types";
import {
  WORKSPACE_MODULES_CATALOG,
  buildWorkspaceNavSections,
} from "@/config/workspace-navigation";
import {
  STORAGE_PATHS,
  uploadDigitalMenuFileStorage,
  deleteDigitalMenuFileStorage,
} from "@/lib/storage/supabase-storage";

describe("NEGOVA — Módulo de Menú Digital", () => {
  describe("1. Catálogo de Plantillas y Ajustes por Defecto", () => {
    it("debe contener exactamente las 4 direcciones visuales requeridas", () => {
      const templateIds = DIGITAL_MENU_TEMPLATES.map((t) => t.id);
      expect(templateIds).toContain("urbana");
      expect(templateIds).toContain("elegante");
      expect(templateIds).toContain("comercial");
      expect(templateIds).toContain("visual");
      expect(templateIds.length).toBe(4);
    });

    it("cada plantilla debe tener paleta de colores predeterminada y descripción", () => {
      DIGITAL_MENU_TEMPLATES.forEach((tpl) => {
        expect(tpl.name).toBeDefined();
        expect(tpl.category).toBeDefined();
        expect(tpl.description).toBeDefined();
        expect(tpl.defaultColors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(tpl.defaultColors.secondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(tpl.defaultColors.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    it("debe proveer configuraciones por defecto completas para personalización", () => {
      expect(DEFAULT_DIGITAL_MENU_SETTINGS.primaryColor).toBe("#ED500A");
      expect(DEFAULT_DIGITAL_MENU_SETTINGS.showDescriptions).toBe(true);
      expect(DEFAULT_DIGITAL_MENU_SETTINGS.showPhotos).toBe(true);
      expect(DEFAULT_DIGITAL_MENU_SETTINGS.showPrices).toBe(true);
      expect(DEFAULT_DIGITAL_MENU_SETTINGS.showContactInfo).toBe(true);
      expect(DEFAULT_DIGITAL_MENU_SETTINGS.showAddress).toBe(true);
      expect(["grid", "list", "compact"]).toContain(DEFAULT_DIGITAL_MENU_SETTINGS.layoutStyle);
    });
  });

  describe("2. Integración en Navegación del Workspace", () => {
    it("el módulo 'menu-digital' debe existir en WORKSPACE_MODULES_CATALOG bajo el grupo 'catalogo'", () => {
      const menuMod = WORKSPACE_MODULES_CATALOG.find((m) => m.id === "menu-digital");
      expect(menuMod).toBeDefined();
      expect(menuMod?.group).toBe("catalogo");
      expect(menuMod?.href).toBe("presencia-digital");
      expect(menuMod?.status).toBe("implemented");
      expect(menuMod?.label).toBe("Presencia digital");
      expect(menuMod?.showInMenu).toBe(true);
    });

    it("el catálogo canónico debe mantener la sección de Catálogo limpia con acceso centralizado a productos y menú", () => {
      const sections = buildWorkspaceNavSections("biz-123", {
        businessType: "fast_food",
        commercialActivities: ["sell_products"],
      });

      const catalogoSection = sections.find((s) => s.id === "catalogo");
      expect(catalogoSection).toBeDefined();

      const items = catalogoSection?.items.map((i) => i.id);
      expect(items).toContain("productos");
      expect(items).toContain("menu-digital");
    });
  });

  describe("3. Rutas y Almacenamiento Aislado en Supabase Storage", () => {
    const businessId = "biz-abc-123";

    it("las rutas de Storage deben respetar el aislamiento multi-tenant por businessId", () => {
      const dir = STORAGE_PATHS.businessMenuDir(businessId);
      expect(dir).toBe("businesses/biz-abc-123/menu");

      const file = STORAGE_PATHS.businessMenuFile(businessId, "menu-17000.pdf");
      expect(file).toBe("businesses/biz-abc-123/menu/menu-17000.pdf");
      expect(file.startsWith(`businesses/${businessId}/`)).toBe(true);
    });

    it("debe rechazar formatos no permitidos (ej: scripts, ejecutables, texto plano)", async () => {
      const fakeClient: any = {
        storage: {
          getBucket: vi.fn().mockResolvedValue({ data: { name: "negova-storage" }, error: null }),
        },
      };

      const invalidFile = new File(["malicious"], "script.exe", { type: "application/x-msdownload" });
      const res = await uploadDigitalMenuFileStorage(fakeClient, businessId, invalidFile);

      expect(res.error).toBeDefined();
      expect(res.error).toContain("Formato no válido");
      expect(res.url).toBeNull();
    });

    it("debe rechazar archivos que excedan el límite de 10MB", async () => {
      const fakeClient: any = {
        storage: {
          getBucket: vi.fn().mockResolvedValue({ data: { name: "negova-storage" }, error: null }),
        },
      };

      // Crear un archivo simulado de 11MB
      const bigFile = new File(["x"], "heavy.pdf", { type: "application/pdf" });
      Object.defineProperty(bigFile, "size", { value: 11 * 1024 * 1024 });

      const res = await uploadDigitalMenuFileStorage(fakeClient, businessId, bigFile);
      expect(res.error).toBeDefined();
      expect(res.error).toContain("supera el tamaño máximo permitido de 10MB");
      expect(res.url).toBeNull();
    });

    it("debe eliminar el archivo anterior en Storage al sustituirlo exitosamente", async () => {
      const removedFiles: string[] = [];
      const fakeClient: any = {
        storage: {
          getBucket: vi.fn().mockResolvedValue({ data: { name: "negova-storage" }, error: null }),
          from: () => ({
            upload: vi.fn().mockResolvedValue({ error: null }),
            getPublicUrl: vi.fn().mockReturnValue({
              data: { publicUrl: "https://mock.supabase.co/storage/v1/object/public/negova-storage/businesses/biz-abc-123/menu/new-menu.pdf" },
            }),
            remove: vi.fn().mockImplementation((paths: string[]) => {
              removedFiles.push(...paths);
              return Promise.resolve({ error: null });
            }),
          }),
        },
      };

      const validPdf = new File(["pdf content"], "new-menu.pdf", { type: "application/pdf" });
      const oldStoragePath = "businesses/biz-abc-123/menu/old-menu.pdf";

      const res = await uploadDigitalMenuFileStorage(fakeClient, businessId, validPdf, oldStoragePath);

      expect(res.error).toBeNull();
      expect(res.fileType).toBe("pdf");
      expect(res.url).toBeDefined();
      expect(removedFiles).toContain(oldStoragePath);
    });

    it("no debe eliminar archivos fuera del aislamiento del tenant del negocio", async () => {
      const removedFiles: string[] = [];
      const fakeClient: any = {
        storage: {
          from: () => ({
            remove: vi.fn().mockImplementation((paths: string[]) => {
              removedFiles.push(...paths);
              return Promise.resolve({ error: null });
            }),
          }),
        },
      };

      // Intentar borrar ruta que pertenece a otro negocio
      const foreignPath = "businesses/other-biz/menu/secret.pdf";
      await deleteDigitalMenuFileStorage(fakeClient, businessId, foreignPath);

      expect(removedFiles).not.toContain(foreignPath);
      expect(removedFiles.length).toBe(0);
    });
  });
});
