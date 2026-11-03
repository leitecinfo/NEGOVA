import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { searchWorkspaceEntities } from "@/lib/search/workspace-search-service";

// Mock de Supabase para pruebas unitarias deterministas
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

describe("[NAV-001] Búsqueda Global en Workspace (Command Palette)", () => {
  const businessId = "biz-nav-001-search";

  const mockProducts = [
    { id: "prod-1", name: "Hamburguesa Clásica", sku: "HAM-01", price: 25000, is_available: true },
    { id: "prod-2", name: "Hamburguesa Doble Queso", sku: "HAM-02", price: 32000, is_available: true },
    { id: "prod-3", name: "Papas Rústicas", sku: "PAP-01", price: 12000, is_available: true },
    { id: "prod-4", name: "Gaseosa Cola 400ml", sku: "BEB-01", price: 6000, is_available: false },
  ];

  const mockCustomers = [
    {
      id: "cust-1",
      full_name: "Carlos Ruiz",
      document_number: "1020304050",
      phone: "+57 300 123 4567",
      email: "carlos.ruiz@correo.com",
    },
    {
      id: "cust-2",
      full_name: "María Gómez",
      document_number: "52889900",
      phone: "+57 310 987 6543",
      email: "maria.gomez@correo.com",
    },
  ];

  const mockOrders = [
    {
      id: "ord-1",
      order_number: 104,
      customer_name: "Carlos Ruiz",
      total: 50000,
      status: "delivered",
      created_at: "2026-10-31T20:00:00Z",
      order_type: "dine_in",
    },
    {
      id: "ord-2",
      order_number: 105,
      customer_name: "María Gómez",
      total: 38000,
      status: "in_preparation",
      created_at: "2026-10-31T20:30:00Z",
      order_type: "delivery",
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    const mockSupabase = {
      from: vi.fn((tableName: string) => {
        let currentData: any[] = [];
        if (tableName === "products") currentData = [...mockProducts];
        else if (tableName === "customers") currentData = [...mockCustomers];
        else if (tableName === "restaurant_orders") currentData = [...mockOrders];

        const queryObj: any = {
          select: vi.fn().mockImplementation(() => queryObj),
          eq: vi.fn().mockImplementation((col: string, val: any) => {
            currentData = currentData.filter((r) => r[col] === val || !r[col]);
            return queryObj;
          }),
          or: vi.fn().mockImplementation((orExpr: string) => {
            // Simulación básica de filtro or para vitest
            const parts = orExpr.split(",");
            const filters = parts.map((p) => {
              const [col, op, pattern] = p.split(".");
              const val = pattern?.replace(/%/g, "").toLowerCase() || "";
              return { col, val };
            });

            currentData = currentData.filter((r) =>
              filters.some((f) => {
                const cellVal = String(r[f.col] || "").toLowerCase();
                return cellVal.includes(f.val);
              })
            );
            return queryObj;
          }),
          ilike: vi.fn().mockImplementation((col: string, pattern: string) => {
            const val = pattern.replace(/%/g, "").toLowerCase();
            currentData = currentData.filter((r) => String(r[col] || "").toLowerCase().includes(val));
            return queryObj;
          }),
          order: vi.fn().mockImplementation(() => queryObj),
          limit: vi.fn().mockImplementation((lim: number) => {
            currentData = currentData.slice(0, lim);
            return queryObj;
          }),
          then: (resolve: any) => Promise.resolve({ data: currentData, error: null }).then(resolve),
        };

        return queryObj;
      }),
    };

    const { createClient } = await import("@/lib/supabase/server");
    (createClient as any).mockResolvedValue(mockSupabase);

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  // ==========================================
  // CRITERIO 2: Permite buscar productos y navegar a la ficha
  // ==========================================
  it("Criterio 2: Permite buscar productos por nombre o SKU y genera URL directa a la ficha", async () => {
    const result = await searchWorkspaceEntities(businessId, "hamburguesa");

    expect(result.products).toBeDefined();
    expect(result.products.length).toBeGreaterThan(0);

    const firstProduct = result.products[0];
    expect(firstProduct.category).toBe("product");
    expect(firstProduct.title).toContain("Hamburguesa");
    expect(firstProduct.subtitle).toContain("SKU:");
    // URL directa para filtrar el catálogo en la ficha de productos
    expect(firstProduct.href).toContain(`/workspace/${businessId}/productos?search=`);
    expect(firstProduct.badge).toBe("Disponible");
  });

  it("Criterio 2: Producto agotado muestra distintivo correspondiente", async () => {
    const result = await searchWorkspaceEntities(businessId, "gaseosa");

    const cola = result.products.find((p) => p.title.includes("Gaseosa Cola"));
    expect(cola).toBeDefined();
    expect(cola?.badge).toBe("Agotado");
  });

  // ==========================================
  // CRITERIO 3: Permite buscar clientes y navegar al perfil
  // ==========================================
  it("Criterio 3: Permite buscar clientes por nombre o cédula y navegar a su perfil /clientes/[id]", async () => {
    const result = await searchWorkspaceEntities(businessId, "carlos");

    expect(result.customers).toBeDefined();
    expect(result.customers.length).toBeGreaterThan(0);

    const carlos = result.customers[0];
    expect(carlos.category).toBe("customer");
    expect(carlos.title).toBe("Carlos Ruiz");
    expect(carlos.subtitle).toContain("Doc: 1020304050");
    // URL exacta al perfil del cliente: /workspace/[businessId]/clientes/[id]
    expect(carlos.href).toBe(`/workspace/${businessId}/clientes/cust-1`);
    expect(carlos.badge).toBe("Cliente");
  });

  // ==========================================
  // BÚSQUEDA EN COMANDAS Y PEDIDOS RECIENTES
  // ==========================================
  it("Búsqueda en comandas: permite buscar por número de orden o nombre de cliente", async () => {
    const result = await searchWorkspaceEntities(businessId, "104");

    expect(result.orders).toBeDefined();
    expect(result.orders.length).toBeGreaterThan(0);

    const order104 = result.orders.find((o) => o.title.includes("#104"));
    expect(order104).toBeDefined();
    expect(order104?.category).toBe("order");
    expect(order104?.subtitle).toContain("Carlos Ruiz");
    expect(order104?.href).toBe(`/workspace/${businessId}/pedidos/ord-1`);
    expect(order104?.badge).toBe("Entregado");
  });

  // ==========================================
  // CRITERIO 4: Resultados se cargan en <500ms
  // ==========================================
  it("Criterio 4: Los resultados se cargan y resuelven en menos de 500ms (Benchmark de latencia)", async () => {
    const iterations = 10;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const res = await searchWorkspaceEntities(businessId, "ham");
      expect(res.durationMs).toBeLessThan(500);
    }

    const totalDuration = performance.now() - start;
    const avgDuration = totalDuration / iterations;

    expect(avgDuration).toBeLessThan(500);
  });

  // ==========================================
  // CRITERIO 1: Componentes y Atajo Ctrl+K
  // ==========================================
  it("Criterio 1: Componentes de WorkspaceCommandPalette y WorkspaceShell integran Ctrl+K", () => {
    const palettePath = path.join(
      process.cwd(),
      "src/components/workspace/workspace-command-palette.tsx"
    );
    const shellPath = path.join(
      process.cwd(),
      "src/components/workspace/workspace-shell.tsx"
    );

    expect(fs.existsSync(palettePath)).toBe(true);
    expect(fs.existsSync(shellPath)).toBe(true);

    const paletteContent = fs.readFileSync(palettePath, "utf8");
    const shellContent = fs.readFileSync(shellPath, "utf8");

    // Atajo de teclado en el shell
    expect(shellContent).toMatch(/e\.key\.toLowerCase\(\)\s*===\s*["']k["']/);
    expect(shellContent).toMatch(/(e\.ctrlKey\s*\|\|\s*e\.metaKey|e\.metaKey\s*\|\|\s*e\.ctrlKey)/);
    expect(shellContent).toContain("WorkspaceCommandPalette");

    // Modal accesible en la paleta
    expect(paletteContent).toContain("ModalPortal");
    expect(paletteContent).toContain("role=\"dialog\"");
  });

  // ==========================================
  // REGLA GLOBAL: Cero Alertas Nativas
  // ==========================================
  it("Regla Global: Prohibido el uso de alertas nativas (window.alert, window.confirm, window.prompt)", () => {
    const palettePath = path.join(
      process.cwd(),
      "src/components/workspace/workspace-command-palette.tsx"
    );
    const shellPath = path.join(
      process.cwd(),
      "src/components/workspace/workspace-shell.tsx"
    );

    const paletteContent = fs.readFileSync(palettePath, "utf8");
    const shellContent = fs.readFileSync(shellPath, "utf8");

    expect(paletteContent).not.toMatch(/\bwindow\.alert\b/);
    expect(paletteContent).not.toMatch(/\bwindow\.confirm\b/);
    expect(paletteContent).not.toMatch(/\bwindow\.prompt\b/);
    expect(paletteContent).not.toMatch(/\bAlert\.alert\b/);

    expect(shellContent).not.toMatch(/\bwindow\.alert\b/);
    expect(shellContent).not.toMatch(/\bwindow\.confirm\b/);
    expect(shellContent).not.toMatch(/\bwindow\.prompt\b/);
    expect(shellContent).not.toMatch(/\bAlert\.alert\b/);
  });
});
