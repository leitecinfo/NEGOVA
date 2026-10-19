/**
 * Utilidades de navegación para NEGOVA
 * Determina de forma precisa y robusta si una opción de menú está activa,
 * soportando URLs con parámetros de búsqueda (ej. configuracion?tab=comprobantes)
 * y rutas anidadas.
 */

export function isRouteActive(
  itemHref: string,
  pathname: string,
  searchParams?: { get: (name: string) => string | null; toString: () => string } | null,
  exactMatch?: boolean
): boolean {
  if (!itemHref || !pathname) return false;

  const [itemPath, itemQuery] = itemHref.split("?");

  // 1. Si el enlace del item define query params explícitos (ej. /configuracion?tab=comprobantes)
  if (itemQuery) {
    if (pathname !== itemPath) return false;
    if (!searchParams) return false;

    const expectedParams = new URLSearchParams(itemQuery);
    for (const [key, expectedVal] of expectedParams.entries()) {
      if (searchParams.get(key) !== expectedVal) {
        return false;
      }
    }
    return true;
  }

  // 2. Si requiere coincidencia exacta (ej. Dashboard / Inicio)
  if (exactMatch) {
    return pathname === itemPath;
  }

  // 3. Si el enlace es la base de una ruta parametrizada (ej. /configuracion):
  // Si la URL actual contiene un ?tab= que pertenece a otro item hermano (como comprobantes),
  // no debemos marcar como activo el item base.
  if (pathname === itemPath) {
    const activeTab = searchParams?.get("tab");
    if (activeTab && activeTab !== "general") {
      return false;
    }
    return true;
  }

  // 4. Sub-rutas anidadas (ej. /workspace/[id]/ventas/nueva con respecto a /workspace/[id]/ventas)
  const normalizedItemPath = itemPath.endsWith("/") ? itemPath.slice(0, -1) : itemPath;
  return pathname.startsWith(`${normalizedItemPath}/`);
}
