import { describe, it, expect } from "vitest";
import { isRouteActive } from "../../src/components/layout/navigation-utils";

describe("isRouteActive navigation helper", () => {
  const businessId = "a8e2612f-4acc-4c84-a420-220131b70d66";
  const baseUrl = `/workspace/${businessId}`;

  it("debe marcar activo el Dashboard únicamente en coincidencia exacta", () => {
    const dashboardHref = baseUrl;
    expect(isRouteActive(dashboardHref, baseUrl, null, true)).toBe(true);
    expect(isRouteActive(dashboardHref, `${baseUrl}/ventas`, null, true)).toBe(false);
  });

  it("debe marcar activo un módulo regular y sus subrutas", () => {
    const ventasHref = `${baseUrl}/ventas`;
    expect(isRouteActive(ventasHref, `${baseUrl}/ventas`, null)).toBe(true);
    expect(isRouteActive(ventasHref, `${baseUrl}/ventas/nueva`, null)).toBe(true);
    expect(isRouteActive(ventasHref, `${baseUrl}/pedidos`, null)).toBe(false);
  });

  it("debe resolver correctamente la diferencia entre Documentos y Configuración", () => {
    const configHref = `${baseUrl}/configuracion`;
    const docsHref = `${baseUrl}/configuracion?tab=comprobantes`;

    // Caso 1: Usuario en Configuración general (sin searchParams o tab=general)
    expect(isRouteActive(configHref, `${baseUrl}/configuracion`, null)).toBe(true);
    expect(isRouteActive(docsHref, `${baseUrl}/configuracion`, null)).toBe(false);

    // Caso 2: Usuario en Documentos (con ?tab=comprobantes)
    const comprobantesParams = new URLSearchParams("tab=comprobantes");
    expect(isRouteActive(docsHref, `${baseUrl}/configuracion`, comprobantesParams)).toBe(true);
    expect(isRouteActive(configHref, `${baseUrl}/configuracion`, comprobantesParams)).toBe(false);

    // Caso 3: Usuario en otra pestaña como tab=branding
    const brandingParams = new URLSearchParams("tab=branding");
    expect(isRouteActive(docsHref, `${baseUrl}/configuracion`, brandingParams)).toBe(false);
    expect(isRouteActive(configHref, `${baseUrl}/configuracion`, brandingParams)).toBe(false);
  });
});
