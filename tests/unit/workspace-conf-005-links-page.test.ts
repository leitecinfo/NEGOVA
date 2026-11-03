import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  getBusinessLinksPageConfig,
  saveBusinessLinksPageConfig,
  getPublicLinksPageBySlug,
  getDefaultPredefinedLinks,
  memoryLinksConfigs,
  memoryBusinesses,
} from "@/lib/links/links-service";
import { BioLinkItem } from "@/lib/links/types";

describe("[CONF-005] Crear página de enlaces tipo Linktree", () => {
  const businessId1 = "biz-links-alpha";
  const businessId2 = "biz-links-beta";

  beforeEach(() => {
    memoryLinksConfigs.clear();
    memoryBusinesses.clear();

    memoryBusinesses.set(businessId1, {
      id: businessId1,
      name: "Hamburguesería Artesanal Alpha",
      slug: "hamburgueseria-alpha",
      phone: "3001234567",
      address: "Calle 10 # 40-20",
      city: "Medellín",
      logo_url: "https://ejemplo.com/logo-alpha.png",
      description: "Las mejores hamburguesas artesanales de la ciudad.",
    });

    memoryBusinesses.set(businessId2, {
      id: businessId2,
      name: "Pizzería Beta",
      slug: "pizzeria-beta",
      phone: "3109876543",
      address: "Carrera 7 # 32-10",
      city: "Bogotá",
    });
  });

  describe("Criterio 1: Se pueden configurar 5 enlaces con título, URL e ícono", () => {
    it("debe generar por defecto 5 enlaces predeterminados completos y válidos", () => {
      const defaultLinks = getDefaultPredefinedLinks({
        id: businessId1,
        name: "Hamburguesería Artesanal Alpha",
        slug: "hamburgueseria-alpha",
        phone: "3001234567",
        address: "Calle 10 # 40-20",
        city: "Medellín",
      });

      expect(defaultLinks).toHaveLength(5);

      // 1. Menú
      const menuLink = defaultLinks.find((l) => l.predefinedType === "menu");
      expect(menuLink).toBeDefined();
      expect(menuLink?.title).toContain("menú");
      expect(menuLink?.icon).toBe("utensils");
      expect(menuLink?.url).toBe("/menu/hamburgueseria-alpha");

      // 2. Domicilio
      const deliveryLink = defaultLinks.find((l) => l.predefinedType === "delivery");
      expect(deliveryLink).toBeDefined();
      expect(deliveryLink?.title).toContain("domicilio");
      expect(deliveryLink?.icon).toBe("shopping-bag");
      expect(deliveryLink?.url).toContain("delivery");

      // 3. WhatsApp
      const waLink = defaultLinks.find((l) => l.predefinedType === "whatsapp");
      expect(waLink).toBeDefined();
      expect(waLink?.title).toContain("WhatsApp");
      expect(waLink?.icon).toBe("message-circle");
      expect(waLink?.url).toContain("wa.me");

      // 4. Instagram
      const igLink = defaultLinks.find((l) => l.predefinedType === "instagram");
      expect(igLink).toBeDefined();
      expect(igLink?.title).toContain("Instagram");
      expect(igLink?.icon).toBe("instagram");

      // 5. Maps
      const mapsLink = defaultLinks.find((l) => l.predefinedType === "maps");
      expect(mapsLink).toBeDefined();
      expect(mapsLink?.title).toContain("Maps");
      expect(mapsLink?.icon).toBe("map-pin");
      expect(mapsLink?.url).toContain("maps.google.com");
    });

    it("permite guardar una configuración de 5 enlaces con títulos, URLs e íconos personalizados", async () => {
      const customLinks: BioLinkItem[] = [
        { id: "1", title: "Menú Especial Fin de Semana", url: "/menu/hamburgueseria-alpha", icon: "utensils", order: 1, isActive: true },
        { id: "2", title: "Pide por WhatsApp Directo", url: "https://wa.me/573001234567", icon: "message-circle", order: 2, isActive: true },
        { id: "3", title: "Fotos y Novedades en Instagram", url: "https://instagram.com/hamburguesas_alpha", icon: "instagram", order: 3, isActive: true },
        { id: "4", title: "Encuéntranos en Google Maps", url: "https://maps.google.com/?q=Alpha", icon: "map-pin", order: 4, isActive: true },
        { id: "5", title: "Promociones y Cupones", url: "https://hamburguesasalpha.com/promo", icon: "star", order: 5, isActive: true },
      ];

      const saveRes = await saveBusinessLinksPageConfig(businessId1, {
        links: customLinks,
        theme: "emerald",
      });

      expect(saveRes.success).toBe(true);
      expect(saveRes.config?.links).toHaveLength(5);
      expect(saveRes.config?.theme).toBe("emerald");
    });
  });

  describe("Criterio 2: La página pública muestra los enlaces ordenados con el branding del negocio", () => {
    it("debe retornar los enlaces ordenados por 'order' ascendente junto al branding (logo, bio, nombre)", async () => {
      const customLinks: BioLinkItem[] = [
        { id: "l3", title: "Tercer Enlace (Maps)", url: "https://maps.google.com", icon: "map-pin", order: 3, isActive: true },
        { id: "l1", title: "Primer Enlace (Menú)", url: "/menu/hamburgueseria-alpha", icon: "utensils", order: 1, isActive: true },
        { id: "l2", title: "Segundo Enlace (WhatsApp)", url: "https://wa.me/573001234567", icon: "message-circle", order: 2, isActive: true },
      ];

      await saveBusinessLinksPageConfig(businessId1, {
        businessName: "Alpha Burger Gourmet",
        logoUrl: "https://cdn.negova.com/logos/alpha.png",
        description: "Hamburguesas al carbón con pan brioche artesanal.",
        links: customLinks,
      });

      const publicData = await getPublicLinksPageBySlug("hamburgueseria-alpha");
      expect(publicData).not.toBeNull();
      expect(publicData?.businessName).toBe("Alpha Burger Gourmet");
      expect(publicData?.logoUrl).toBe("https://cdn.negova.com/logos/alpha.png");
      expect(publicData?.description).toBe("Hamburguesas al carbón con pan brioche artesanal.");

      // Verificar orden exacto 1, 2, 3
      expect(publicData?.links[0].title).toBe("Primer Enlace (Menú)");
      expect(publicData?.links[1].title).toBe("Segundo Enlace (WhatsApp)");
      expect(publicData?.links[2].title).toBe("Tercer Enlace (Maps)");
    });
  });

  describe("Criterio 3: Los enlaces inactivos no se muestran en la página pública", () => {
    it("debe filtrar enlaces con isActive = false de modo que no se expongan al público", async () => {
      const mixedLinks: BioLinkItem[] = [
        { id: "act-1", title: "Menú Activo", url: "/menu/hamburgueseria-alpha", icon: "utensils", order: 1, isActive: true },
        { id: "inact-1", title: "Enlace Inactivo (Oculto)", url: "https://promo-vencida.com", icon: "star", order: 2, isActive: false },
        { id: "act-2", title: "WhatsApp Activo", url: "https://wa.me/573001234567", icon: "message-circle", order: 3, isActive: true },
        { id: "inact-2", title: "Enlace de Prueba Borrador", url: "https://test.com", icon: "link", order: 4, isActive: false },
      ];

      await saveBusinessLinksPageConfig(businessId1, {
        links: mixedLinks,
      });

      // Vista interna del workspace sí mantiene todos los enlaces (para administración)
      const workspaceConfig = await getBusinessLinksPageConfig(businessId1);
      expect(workspaceConfig.links).toHaveLength(4);

      // Vista pública solo entrega los enlaces activos
      const publicData = await getPublicLinksPageBySlug("hamburgueseria-alpha");
      expect(publicData?.links).toHaveLength(2);
      expect(publicData?.links.map((l) => l.id)).toEqual(["act-1", "act-2"]);
      expect(publicData?.links.some((l) => l.isActive === false)).toBe(false);
    });
  });

  describe("Criterio 4: Carga ultrarrápida y responsive", () => {
    it("la consulta pública por slug resuelve en menos de 50 milisegundos", async () => {
      await getBusinessLinksPageConfig(businessId1);

      const startTime = performance.now();
      const publicData = await getPublicLinksPageBySlug("hamburgueseria-alpha");
      const durationMs = performance.now() - startTime;

      expect(publicData).not.toBeNull();
      expect(durationMs).toBeLessThan(50); // Muy por debajo de los 2000 ms requeridos
    });
  });

  describe("Criterio 5: El enlace 'Ver menú' lleva al menú QR público del negocio", () => {
    it("el enlace predeterminado y configurado del menú digital apunta a /menu/[slug]", async () => {
      const publicData = await getPublicLinksPageBySlug("hamburgueseria-alpha");
      const menuLink = publicData?.links.find((l) => l.predefinedType === "menu" || l.icon === "utensils");

      expect(menuLink).toBeDefined();
      expect(menuLink?.url).toBe("/menu/hamburgueseria-alpha");
    });
  });

  describe("Validaciones de Negocio y Seguridad", () => {
    it("rechaza duplicar el slug si ya pertenece a otro comercio", async () => {
      const saveRes = await saveBusinessLinksPageConfig(businessId2, {
        slug: "hamburgueseria-alpha", // ya pertenece a businessId1
      });

      expect(saveRes.success).toBe(false);
      expect(saveRes.error).toContain("ya está en uso");
    });

    it("los componentes de UI no contienen llamadas a alertas nativas", () => {
      const clientPath = path.join(
        process.cwd(),
        "src/app/workspace/[businessId]/configuracion/pagina-enlaces/links-page-config-client.tsx"
      );
      expect(fs.existsSync(clientPath)).toBe(true);

      const content = fs.readFileSync(clientPath, "utf8");
      expect(content).not.toMatch(/window\.alert\s*\(/);
      expect(content).not.toMatch(/window\.confirm\s*\(/);
      expect(content).not.toMatch(/window\.prompt\s*\(/);
      expect(content).not.toMatch(/Alert\.alert\s*\(/);

      // Debe utilizar ConfirmModal y sonner toast
      expect(content).toContain("ConfirmModal");
      expect(content).toContain("toast.");
    });

    it("la ruta pública /links/[slug] existe y renderiza sin redirección errónea", () => {
      const publicPagePath = path.join(process.cwd(), "src/app/links/[slug]/page.tsx");
      expect(fs.existsSync(publicPagePath)).toBe(true);

      const content = fs.readFileSync(publicPagePath, "utf8");
      expect(content).toContain("getPublicLinksPageBySlug");
      expect(content).toContain("Potenciado por");
      expect(content).toContain("NEGOVA");
    });

    it("la ruta /negocio/[slug] también está disponible", () => {
      const negocioPagePath = path.join(process.cwd(), "src/app/negocio/[slug]/page.tsx");
      expect(fs.existsSync(negocioPagePath)).toBe(true);
    });

    it("el catálogo de navegación registra configuracion_pagina_enlaces como implementado", () => {
      const navPath = path.join(process.cwd(), "src/config/workspace-navigation.ts");
      const navContent = fs.readFileSync(navPath, "utf8");
      expect(navContent).toContain("configuracion_pagina_enlaces");
      expect(navContent).toContain("configuracion/pagina-enlaces");
      expect(navContent).toContain('"implemented"');
    });
  });
});
