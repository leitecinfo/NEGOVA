import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import path from "path";
import {
  LoadingSkeleton,
  TableSkeleton,
  KpiSkeleton,
  CardSkeleton,
} from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { Users, AlertTriangle, Package, RefreshCw } from "lucide-react";

describe("[DS-002] Aplicar estados de carga, error y vacío consistentes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Componentes de Carga (LoadingSkeleton, TableSkeleton, KpiSkeleton, CardSkeleton)", () => {
    it("debe renderizar LoadingSkeleton con clase animate-pulse", () => {
      const html = renderToStaticMarkup(<LoadingSkeleton className="h-6 w-32" />);
      expect(html).toContain("animate-pulse");
      expect(html).toContain("h-6 w-32");
    });

    it("debe renderizar TableSkeleton con el número especificado de filas y columnas", () => {
      const html = renderToStaticMarkup(<TableSkeleton rows={4} cols={5} />);
      expect(html).toContain("animate-pulse");
      // Cuenta de elementos skeleton: 5 en el header + (4 filas * 5 cols) = 25
      const skeletonCount = (html.match(/animate-pulse/g) || []).length;
      expect(skeletonCount).toBe(25);
    });

    it("debe renderizar KpiSkeleton con el conteo de tarjetas indicado", () => {
      const html = renderToStaticMarkup(<KpiSkeleton count={3} />);
      expect(html).toContain("grid-cols-2");
      // Cada tarjeta tiene 4 skeletons internos * 3 tarjetas = 12 skeletons
      const skeletonCount = (html.match(/animate-pulse/g) || []).length;
      expect(skeletonCount).toBe(12);
    });

    it("debe renderizar CardSkeleton correctamente", () => {
      const html = renderToStaticMarkup(<CardSkeleton className="custom-card-skeleton" />);
      expect(html).toContain("custom-card-skeleton");
      expect(html).toContain("animate-pulse");
    });
  });

  describe("2. Componente de Estado Vacío (EmptyState)", () => {
    it("debe mostrar icono, título y descripción cuando no hay datos", () => {
      const html = renderToStaticMarkup(
        <EmptyState
          icon={Users}
          title="No hay clientes registrados"
          description="Comienza añadiendo un nuevo cliente a la base de datos."
        />
      );

      expect(html).toContain("No hay clientes registrados");
      expect(html).toContain("Comienza añadiendo un nuevo cliente");
      expect(html).toContain("lucide-users");
    });

    it("debe renderizar botón de acción primaria con callback onAction", () => {
      const html = renderToStaticMarkup(
        <EmptyState
          title="Sin productos"
          description="No se encontraron productos."
          actionLabel="Nuevo Producto"
          onAction={() => {}}
        />
      );

      expect(html).toContain("Nuevo Producto");
      expect(html).toContain("<button");
    });

    it("debe renderizar enlace de acción primaria cuando se provee actionHref", () => {
      const html = renderToStaticMarkup(
        <EmptyState
          title="Sin órdenes"
          description="No hay comandas activas."
          actionLabel="Ir al POS"
          actionHref="/workspace/test-biz/pos"
        />
      );

      expect(html).toContain("Ir al POS");
      expect(html).toContain('href="/workspace/test-biz/pos"');
    });

    it("debe mostrar botón secundario para restablecer filtros cuando se define onReset", () => {
      const html = renderToStaticMarkup(
        <EmptyState
          title="Filtro sin resultados"
          description="Ningún registro coincide con la búsqueda."
          resetLabel="Restablecer filtros"
          onReset={() => {}}
        />
      );

      expect(html).toContain("Restablecer filtros");
      expect(html).toContain("<button");
    });
  });

  describe("3. Componente de Estado de Error (ErrorState)", () => {
    it("debe renderizar mensaje de error con role='alert' e icono de advertencia", () => {
      const html = renderToStaticMarkup(
        <ErrorState
          title="Fallo de conexión"
          description="No pudimos sincronizar los datos con el servidor."
        />
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain("Fallo de conexión");
      expect(html).toContain("No pudimos sincronizar los datos");
      expect(html).toMatch(/lucide-(triangle-alert|alert-triangle)/);
    });

    it("debe renderizar botón de reintento con opción de callback", () => {
      const html = renderToStaticMarkup(
        <ErrorState
          title="Error temporal"
          description="Reintenta la operación."
          onRetry={() => {}}
          retryLabel="Reintentar ahora"
        />
      );

      expect(html).toContain("Reintentar ahora");
      expect(html).toContain("<button");
    });

    it("debe soportar acción secundaria con enlace", () => {
      const html = renderToStaticMarkup(
        <ErrorState
          title="Módulo no disponible"
          onRetry={() => {}}
          secondaryActionLabel="Volver al Inicio"
          secondaryActionHref="/workspace/test-biz"
        />
      );

      expect(html).toContain("Volver al Inicio");
      expect(html).toContain('href="/workspace/test-biz"');
    });
  });

  describe("4. Integración Automática en DataTable", () => {
    interface TestItem {
      id: string;
      name: string;
    }

    const columns: DataTableColumn<TestItem>[] = [
      { header: "ID", accessor: "id" },
      { header: "Nombre", accessor: "name" },
    ];

    it("debe renderizar TableSkeleton cuando isLoading es true", () => {
      const html = renderToStaticMarkup(
        <DataTable<TestItem>
          columns={columns}
          data={[]}
          keyExtractor={(item) => item.id}
          isLoading={true}
        />
      );

      expect(html).toContain("animate-pulse");
      expect(html).not.toContain("<table"); // Skeleton sustituye la tabla
    });

    it("debe renderizar EmptyState personalizado cuando data está vacía", () => {
      const html = renderToStaticMarkup(
        <DataTable<TestItem>
          columns={columns}
          data={[]}
          keyExtractor={(item) => item.id}
          emptyState={{
            title: "Tabla vacía",
            description: "No existen registros en esta lista.",
            actionLabel: "Crear ítem",
            onAction: () => {},
          }}
        />
      );

      expect(html).toContain("Tabla vacía");
      expect(html).toContain("No existen registros en esta lista.");
      expect(html).toContain("Crear ítem");
    });

    it("debe renderizar EmptyState por defecto cuando data está vacía y emptyState es omitido", () => {
      const html = renderToStaticMarkup(
        <DataTable<TestItem>
          columns={columns}
          data={[]}
          keyExtractor={(item) => item.id}
        />
      );

      expect(html).toContain("No se encontraron registros");
      expect(html).toContain("No hay información disponible para mostrar");
    });

    it("debe renderizar ErrorState cuando se suministra la propiedad errorState", () => {
      const html = renderToStaticMarkup(
        <DataTable<TestItem>
          columns={columns}
          data={[]}
          keyExtractor={(item) => item.id}
          errorState={{
            title: "Error de consulta",
            description: "No se pudieron obtener los registros de la tabla.",
            onRetry: () => {},
          }}
        />
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain("Error de consulta");
      expect(html).toContain("Reintentar operación");
    });
  });

  describe("5. Regla Global Antigravity: Prohibición de Alertas Nativas", () => {
    it("ningún componente de estado o módulo modificado debe utilizar alertas nativas", () => {
      const filesToCheck = [
        path.join(process.cwd(), "src/components/ui/loading-skeleton.tsx"),
        path.join(process.cwd(), "src/components/ui/empty-state.tsx"),
        path.join(process.cwd(), "src/components/ui/error-state.tsx"),
        path.join(process.cwd(), "src/components/ui/data-table.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/error.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/dashboard/sales-dashboard-client.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/productos/products-manager-client.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/productos/inventory-products-tab.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/productos/inventory-locations-tab.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/productos/inventory-history-tab.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/productos/inventory-low-stock-tab.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/gastos/workspace-gastos-client.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/proveedores/workspace-proveedores-client.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/recetas/recipes-tab.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/recetas/ingredients-tab.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/cocina/kds-screen-client.tsx"),
        path.join(process.cwd(), "src/app/workspace/[businessId]/clientes/customers-list-client.tsx"),
      ];

      for (const file of filesToCheck) {
        expect(fs.existsSync(file), `El archivo ${file} debe existir`).toBe(true);
        const content = fs.readFileSync(file, "utf-8");
        expect(content).not.toMatch(/\bwindow\.alert\b/);
        expect(content).not.toMatch(/\bwindow\.confirm\b/);
        expect(content).not.toMatch(/\bwindow\.prompt\b/);
        expect(content).not.toMatch(/\bAlert\.alert\b/);
      }
    });
  });
});
