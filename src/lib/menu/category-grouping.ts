import { Category, Product, isProductAvailableInQr } from "@/lib/products/types";

export interface MenuGroup {
  categoryId: string;
  categoryName: string;
  products: Product[];
}

export interface MenuCategoryPill {
  id: string;
  name: string;
  displayName: string;
  isChild: boolean;
  count: number;
}

/**
 * Filtra productos para el menú público QR considerando:
 * - Búsqueda por texto (nombre, descripción)
 * - Filtro por categoría:
 *   - "all": todos los productos
 *   - ID de categoría padre: incluye productos de la categoría padre Y de todas sus subcategorías
 *   - ID de subcategoría: incluye únicamente productos de esa subcategoría
 */
export function filterMenuProducts(
  products: Product[],
  categories: Category[],
  search: string,
  selectedCat: string
): Product[] {
  const query = search.trim();
  const normalizedQuery = query
    ? query
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
    : "";

  return products.filter((p) => {
    if (!isProductAvailableInQr(p)) return false;

    // 1. Filtrado por texto (búsqueda cliente-side insensible a mayúsculas, minúsculas y tildes)
    let matchesSearch = true;
    if (normalizedQuery) {
      const normName = p.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      const normDesc = p.description
        ? p.description
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
        : "";

      matchesSearch =
        normName.includes(normalizedQuery) || normDesc.includes(normalizedQuery);
    }

    if (!matchesSearch) return false;

    // 2. Filtrado por categoría
    const matchesCat =
      selectedCat === "all" ||
      p.category_id === selectedCat ||
      categories.some(
        (c) => c.parent_category_id === selectedCat && p.category_id === c.id
      );

    return matchesCat;
  });
}

/**
 * Agrupa productos para el menú QR:
 * - Si hay búsqueda activa: grupo único "Resultados de búsqueda"
 * - Si hay categoría seleccionada:
 *   - Si la categoría tiene subcategorías: agrupa por padre y por cada subcategoría con productos
 *   - Si es categoría simple o subcategoría: grupo único con formato "Padre › Hijo" si corresponde
 * - Si es "all":
 *   - Recorre categorías raíz y sus respectivas subcategorías (formato "Padre › Hijo")
 *   - Agrupa huérfanas si existieran
 *   - Agrupa productos sin categoría en "Otros"
 */
export function groupMenuProducts(
  filteredProducts: Product[],
  categories: Category[],
  selectedCat: string,
  search: string
): MenuGroup[] {
  if (filteredProducts.length === 0) return [];

  const query = search.trim();
  if (query !== "") {
    return [
      {
        categoryId: "search-results",
        categoryName: "Resultados de búsqueda",
        products: filteredProducts,
      },
    ];
  }

  if (selectedCat !== "all") {
    const targetCat = categories.find((c) => c.id === selectedCat);
    const subcategories = categories.filter((c) => c.parent_category_id === selectedCat);

    if (subcategories.length > 0 && targetCat) {
      const groups: MenuGroup[] = [];

      // Productos directos de la categoría padre
      const directProducts = filteredProducts.filter((p) => p.category_id === targetCat.id);
      if (directProducts.length > 0) {
        groups.push({
          categoryId: targetCat.id,
          categoryName: targetCat.name,
          products: directProducts,
        });
      }

      // Productos de cada subcategoría
      subcategories.forEach((sub) => {
        const subProducts = filteredProducts.filter((p) => p.category_id === sub.id);
        if (subProducts.length > 0) {
          groups.push({
            categoryId: sub.id,
            categoryName: `${targetCat.name} › ${sub.name}`,
            products: subProducts,
          });
        }
      });

      if (groups.length > 0) return groups;
    }

    // Categoría individual o subcategoría seleccionada directamente
    const parent = targetCat?.parent_category_id
      ? categories.find((c) => c.id === targetCat.parent_category_id)
      : null;
    const displayName =
      parent && targetCat ? `${parent.name} › ${targetCat.name}` : targetCat?.name || "Categoría";

    return [
      {
        categoryId: selectedCat,
        categoryName: displayName,
        products: filteredProducts,
      },
    ];
  }

  // Agrupación general ("all")
  const groups: MenuGroup[] = [];
  const roots = categories.filter((c) => !c.parent_category_id);
  const childrenMap = new Map<string, Category[]>();

  categories.forEach((c) => {
    if (c.parent_category_id) {
      const list = childrenMap.get(c.parent_category_id) || [];
      list.push(c);
      childrenMap.set(c.parent_category_id, list);
    }
  });

  const processedCategoryIds = new Set<string>();

  roots.forEach((root) => {
    processedCategoryIds.add(root.id);
    const rootProducts = filteredProducts.filter((p) => p.category_id === root.id);
    if (rootProducts.length > 0) {
      groups.push({
        categoryId: root.id,
        categoryName: root.name,
        products: rootProducts,
      });
    }

    const kids = childrenMap.get(root.id) || [];
    kids.forEach((kid) => {
      processedCategoryIds.add(kid.id);
      const kidProducts = filteredProducts.filter((p) => p.category_id === kid.id);
      if (kidProducts.length > 0) {
        groups.push({
          categoryId: kid.id,
          categoryName: `${root.name} › ${kid.name}`,
          products: kidProducts,
        });
      }
    });
  });

  // Huérfanas (con parent_category_id que no apunta a una categoría existente)
  categories.forEach((cat) => {
    if (!processedCategoryIds.has(cat.id)) {
      const orphanProducts = filteredProducts.filter((p) => p.category_id === cat.id);
      if (orphanProducts.length > 0) {
        groups.push({
          categoryId: cat.id,
          categoryName: cat.name,
          products: orphanProducts,
        });
      }
    }
  });

  // Productos sin categoría o con categoría inexistente
  const uncategorized = filteredProducts.filter(
    (p) => !p.category_id || !categories.some((c) => c.id === p.category_id)
  );
  if (uncategorized.length > 0) {
    groups.push({
      categoryId: "uncategorized",
      categoryName: "Otros",
      products: uncategorized,
    });
  }

  return groups;
}

/**
 * Retorna las categorías disponibles como pastillas (pills) para el menú QR,
 * calculando para los padres el total acumulado de sus hijos y mostrando
 * la jerarquía padre › hijo.
 */
export function getMenuCategoryPills(
  categories: Category[],
  products: Product[]
): MenuCategoryPill[] {
  const qrProducts = products.filter((p) => isProductAvailableInQr(p));
  const roots = categories.filter((c) => !c.parent_category_id);
  const childrenMap = new Map<string, Category[]>();

  categories.forEach((c) => {
    if (c.parent_category_id) {
      const list = childrenMap.get(c.parent_category_id) || [];
      list.push(c);
      childrenMap.set(c.parent_category_id, list);
    }
  });

  const pills: MenuCategoryPill[] = [];

  roots.forEach((root) => {
    const kids = childrenMap.get(root.id) || [];
    const childIds = new Set(kids.map((k) => k.id));
    const totalCount = qrProducts.filter(
      (p) => p.category_id === root.id || (p.category_id && childIds.has(p.category_id))
    ).length;

    if (totalCount > 0) {
      pills.push({
        id: root.id,
        name: root.name,
        displayName: root.name,
        isChild: false,
        count: totalCount,
      });
    }

    kids.forEach((kid) => {
      const kidCount = qrProducts.filter((p) => p.category_id === kid.id).length;
      if (kidCount > 0) {
        pills.push({
          id: kid.id,
          name: kid.name,
          displayName: `${root.name} › ${kid.name}`,
          isChild: true,
          count: kidCount,
        });
      }
    });
  });

  // Huérfanas
  categories.forEach((cat) => {
    if (!pills.some((p) => p.id === cat.id)) {
      const count = qrProducts.filter((p) => p.category_id === cat.id).length;
      if (count > 0) {
        const parent = categories.find((c) => c.id === cat.parent_category_id);
        pills.push({
          id: cat.id,
          name: cat.name,
          displayName: parent ? `${parent.name} › ${cat.name}` : cat.name,
          isChild: Boolean(cat.parent_category_id),
          count,
        });
      }
    }
  });

  return pills;
}
