import { describe, it, expect } from "vitest";
import {
  resolveBusinessCategory,
  resolveProductVerticalContext,
} from "@/lib/products/types";

describe("Ajustes Complementarios Tarea 2 — Formulario Contextual de Productos y Canales", () => {
  describe("1. Identificación y Resolución de Categorías de Negocio", () => {
    it("clasifica restaurantes y gastronomía correctamente", () => {
      expect(resolveBusinessCategory("restaurant")).toBe("gastronomicos");
      expect(resolveBusinessCategory("fast_food")).toBe("gastronomicos");
      expect(resolveBusinessCategory("cafe")).toBe("gastronomicos");
      expect(resolveBusinessCategory("pizzeria")).toBe("gastronomicos");
      expect(resolveBusinessCategory("bakery")).toBe("gastronomicos");
      expect(resolveBusinessCategory("comidas_rapidas")).toBe("gastronomicos");
    });

    it("clasifica barberías y servicios correctamente", () => {
      expect(resolveBusinessCategory("barbershop")).toBe("servicios");
      expect(resolveBusinessCategory("spa")).toBe("servicios");
      expect(resolveBusinessCategory("barberia")).toBe("servicios");
      expect(resolveBusinessCategory("peluqueria")).toBe("servicios");
      expect(resolveBusinessCategory("automotive")).toBe("servicios");
      expect(resolveBusinessCategory("technical_service")).toBe("servicios");
    });

    it("clasifica minimercados y mercados correctamente", () => {
      expect(resolveBusinessCategory("minimarket")).toBe("mercados");
      expect(resolveBusinessCategory("supermarket")).toBe("mercados");
      expect(resolveBusinessCategory("butchery")).toBe("mercados");
    });

    it("clasifica tiendas de ropa, ferreterías y farmacias como comercio", () => {
      expect(resolveBusinessCategory("fashion")).toBe("comercios");
      expect(resolveBusinessCategory("hardware")).toBe("comercios");
      expect(resolveBusinessCategory("pharmacy")).toBe("comercios");
      expect(resolveBusinessCategory("stationery")).toBe("comercios");
    });
  });

  describe("2. Modalidades de comportamiento del producto por Vertical", () => {
    it("Barbería: debe mostrar exactamente 'stock' y 'service' (Con existencias y Servicio / Sin stock)", () => {
      const ctx = resolveProductVerticalContext("barbershop");
      expect(ctx.availableKinds).toEqual(["stock", "service"]);
      expect(ctx.availableKinds).not.toContain("prepared");
    });

    it("Restaurante con venta de productos y servicios: debe mostrar 'stock', 'prepared' y 'service'", () => {
      const ctx = resolveProductVerticalContext("restaurant", ["sell_products", "provide_services"]);
      expect(ctx.availableKinds).toEqual(["stock", "prepared", "service"]);
    });

    it("Gastronomía (restaurantes, cafeterías, comidas rápidas): debe mostrar las tres modalidades ('stock', 'prepared', 'service')", () => {
      const ctx = resolveProductVerticalContext("fast_food", ["sell_products"]);
      expect(ctx.availableKinds).toEqual(["stock", "prepared", "service"]);
    });

    it("Minimercado: debe mostrar únicamente 'stock' (Con existencias)", () => {
      const ctx = resolveProductVerticalContext("minimarket");
      expect(ctx.availableKinds).toEqual(["stock"]);
      expect(ctx.availableKinds).not.toContain("prepared");
      expect(ctx.availableKinds).not.toContain("service");
    });

    it("Tienda de ropa: debe mostrar únicamente 'stock' (Con existencias)", () => {
      const ctx = resolveProductVerticalContext("fashion");
      expect(ctx.availableKinds).toEqual(["stock"]);
      expect(ctx.availableKinds).not.toContain("prepared");
      expect(ctx.availableKinds).not.toContain("service");
    });

    it("Ferretería: debe mostrar únicamente 'stock' (Con existencias)", () => {
      const ctx = resolveProductVerticalContext("hardware");
      expect(ctx.availableKinds).toEqual(["stock"]);
      expect(ctx.availableKinds).not.toContain("prepared");
      expect(ctx.availableKinds).not.toContain("service");
    });

    it("Farmacia: debe mostrar únicamente 'stock' (Con existencias)", () => {
      const ctx = resolveProductVerticalContext("pharmacy");
      expect(ctx.availableKinds).toEqual(["stock"]);
      expect(ctx.availableKinds).not.toContain("prepared");
      expect(ctx.availableKinds).not.toContain("service");
    });

    it("Comercio híbrido con servicios activos: debe mostrar 'stock' y 'service'", () => {
      const ctx = resolveProductVerticalContext("hardware", ["sell_products", "provide_services"]);
      expect(ctx.availableKinds).toEqual(["stock", "service"]);
      expect(ctx.availableKinds).not.toContain("prepared");
    });

    it("Preservación de productos existentes: no bloquea ni reclasifica un producto existente", () => {
      // Si por alguna razón una ferretería tuviera un producto histórico de tipo service
      const ctx = resolveProductVerticalContext("hardware", ["sell_products"], "service");
      expect(ctx.availableKinds).toContain("service");
    });
  });

  describe("3. Canales de venta visibles por Vertical", () => {
    it("Restaurantes: debe mostrar 'pos' y 'qr' (POS / Caja y Menú QR), NUNCA Tienda online", () => {
      const ctx = resolveProductVerticalContext("restaurant");
      expect(ctx.availableChannels).toEqual(["pos", "qr"]);
      expect(ctx.availableChannels).not.toContain("online" as any);
    });

    it("Barberías: debe mostrar únicamente 'pos' (POS / Caja), NUNCA Menú QR ni Tienda online", () => {
      const ctx = resolveProductVerticalContext("barbershop");
      expect(ctx.availableChannels).toEqual(["pos"]);
      expect(ctx.availableChannels).not.toContain("qr");
      expect(ctx.availableChannels).not.toContain("online" as any);
    });

    it("Tiendas y comercios (Minimercado, Ropa, Ferretería, Farmacia): debe mostrar únicamente 'pos'", () => {
      for (const bType of ["minimarket", "fashion", "hardware", "pharmacy"]) {
        const ctx = resolveProductVerticalContext(bType);
        expect(ctx.availableChannels).toEqual(["pos"]);
        expect(ctx.availableChannels).not.toContain("qr");
        expect(ctx.availableChannels).not.toContain("online" as any);
      }
    });
  });
});

