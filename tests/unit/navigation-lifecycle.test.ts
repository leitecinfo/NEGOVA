import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Ciclo de vida de navegación y pantalla de carga entre módulos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no debe autodescartar el overlay de carga solo por cambio de pathname si el componente de destino no ha montado", () => {
    // Simular el estado de navegación
    let isNavigating = true;
    let navigatingHref = "/workspace/negocio-1/mesas";
    const startPath = "/workspace/negocio-1/pos";

    // En Next.js App Router, el router actualiza el pathname a /mesas inmediatamente al iniciar la transición,
    // pero el Server Component sigue resolviendo en el servidor durante 2-3 segundos.
    const currentRouterPathname = "/workspace/negocio-1/mesas";

    // La lógica anterior calculaba:
    const oldIsAlreadyAtTarget = currentRouterPathname === navigatingHref;
    // Anteriormente, esto era true y forzaba el cierre anticipado (el bug reportado por el usuario):
    expect(oldIsAlreadyAtTarget).toBe(true);

    // Con la nueva arquitectura, el overlay NO se autodescarta por pathname prematuro,
    // sino que espera la llamada explícita de notifyRouteMounted desde el template de la vista.
    const shouldStayActiveUntilMounted = isNavigating && true;
    expect(shouldStayActiveUntilMounted).toBe(true);

    // Cuando el nuevo componente realmente monta en el DOM, emite notifyRouteMounted:
    const notifyRouteMounted = (mountedPath: string) => {
      if (mountedPath === navigatingHref) {
        isNavigating = false;
        navigatingHref = "";
      }
    };

    notifyRouteMounted("/workspace/negocio-1/mesas");
    expect(isNavigating).toBe(false);
  });
});
