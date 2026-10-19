import { describe, it, expect, vi } from "vitest";
import React from "react";
import {
  DataTable,
  AdminDataTable,
  DataTableColumn,
  DataTableProps,
} from "@/components/ui/data-table";
import {
  AdminDataTable as BridgeAdminDataTable,
} from "@/components/admin/ui/admin-data-table";

interface TestProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
}

describe("DataTable — Componente Canónico Neutral y Puente de Compatibilidad", () => {
  const sampleProducts: TestProduct[] = [
    { id: "p1", name: "Café Especial", sku: "CAF-001", price: 8500, stock: 24 },
    { id: "p2", name: "Capuchino", sku: "CAP-002", price: 9500, stock: 12 },
  ];

  const columns: DataTableColumn<TestProduct>[] = [
    { header: "Producto", accessor: "name" },
    { header: "SKU", accessor: "sku" },
    {
      header: "Precio",
      align: "right",
      render: (p) => `$${p.price.toLocaleString("es-CO")}`,
    },
    { header: "Stock", align: "center", accessor: "stock" },
  ];

  it("debe garantizar que DataTable y AdminDataTable apunten a la misma implementación canónica", () => {
    expect(DataTable).toBeDefined();
    expect(AdminDataTable).toBe(DataTable);
    expect(BridgeAdminDataTable).toBe(DataTable);
  });

  it("debe instanciar la tabla con configuración estándar y stickyFirstColumn", () => {
    const table = React.createElement(DataTable<TestProduct>, {
      columns,
      data: sampleProducts,
      keyExtractor: (p) => p.id,
      stickyFirstColumn: true,
      minWidth: "min-w-[700px]",
    });

    expect(table).toBeDefined();
    expect(table.props.data.length).toBe(2);
    expect(table.props.columns.length).toBe(4);
    expect(table.props.stickyFirstColumn).toBe(true);
    expect(table.props.minWidth).toBe("min-w-[700px]");
  });

  it("debe soportar callbacks onRowClick y rowClassName", () => {
    const handleRowClick = vi.fn();
    const table = React.createElement(DataTable<TestProduct>, {
      columns,
      data: sampleProducts,
      keyExtractor: (p) => p.id,
      onRowClick: handleRowClick,
      rowClassName: (item) => (item.stock < 15 ? "bg-amber-500/10" : ""),
    });

    expect(table.props.onRowClick).toBeDefined();
    expect(table.props.rowClassName).toBeDefined();
  });

  it("debe soportar renderMobileCard para adaptabilidad responsive", () => {
    const renderCard = (p: TestProduct) =>
      React.createElement("div", { key: p.id }, p.name);

    const table = React.createElement(DataTable<TestProduct>, {
      columns,
      data: sampleProducts,
      keyExtractor: (p) => p.id,
      renderMobileCard: renderCard,
    });

    expect(table.props.renderMobileCard).toBeDefined();
  });

  it("debe soportar emptyState e isLoading", () => {
    const loadingTable = React.createElement(DataTable<TestProduct>, {
      columns,
      data: [],
      keyExtractor: (p) => p.id,
      isLoading: true,
    });

    expect(loadingTable.props.isLoading).toBe(true);

    const emptyTable = React.createElement(DataTable<TestProduct>, {
      columns,
      data: [],
      keyExtractor: (p) => p.id,
      emptyState: {
        title: "No hay productos",
        description: "Agrega tu primer producto",
      },
    });

    expect(emptyTable.props.emptyState?.title).toBe("No hay productos");
  });

  it("debe soportar paginación integrada", () => {
    const handlePageChange = vi.fn();
    const table = React.createElement(DataTable<TestProduct>, {
      columns,
      data: sampleProducts,
      keyExtractor: (p) => p.id,
      pagination: {
        currentPage: 1,
        totalPages: 3,
        totalItems: 30,
        currentCount: 2,
        pageSize: 10,
        onPageChange: handlePageChange,
      },
    });

    expect(table.props.pagination?.currentPage).toBe(1);
    expect(table.props.pagination?.totalPages).toBe(3);
  });
});
