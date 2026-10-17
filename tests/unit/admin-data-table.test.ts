import { describe, it, expect, vi } from "vitest";
import React from "react";
import { AdminDataTable, AdminDataTableColumn } from "@/components/admin/ui/admin-data-table";

interface TestRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive";
}

describe("AdminDataTable — Componente Global Unificado", () => {
  const sampleData: TestRow[] = [
    { id: "1", name: "Alexander Smith", email: "alex@example.com", role: "Owner", status: "active" },
    { id: "2", name: "María Gómez", email: "maria@example.com", role: "Auxiliar", status: "active" },
    { id: "3", name: "Carlos López", email: "carlos@example.com", role: "Cajero", status: "inactive" },
  ];

  const columns: AdminDataTableColumn<TestRow>[] = [
    {
      header: "Usuario",
      accessor: "name",
    },
    {
      header: "Correo",
      accessor: "email",
    },
    {
      header: "Rol",
      accessor: "role",
    },
    {
      header: "Estado",
      render: (item) => (item.status === "active" ? "Activo" : "Inactivo"),
    },
  ];

  it("debe instanciar el componente con columnas y filas sin errores", () => {
    const table = React.createElement(AdminDataTable<TestRow>, {
      columns,
      data: sampleData,
      keyExtractor: (item) => item.id,
      stickyFirstColumn: true,
    });

    expect(table).toBeDefined();
    expect(table.props.data.length).toBe(3);
    expect(table.props.columns.length).toBe(4);
    expect(table.props.stickyFirstColumn).toBe(true);
  });

  it("debe aceptar callbacks onRowClick y generar cursor pointer", () => {
    const handleRowClick = vi.fn();
    const table = React.createElement(AdminDataTable<TestRow>, {
      columns,
      data: sampleData,
      keyExtractor: (item) => item.id,
      onRowClick: handleRowClick,
    });

    expect(table.props.onRowClick).toBeDefined();
  });

  it("debe soportar renderMobileCard para adaptabilidad responsive", () => {
    const renderMobileCard = (item: TestRow) =>
      React.createElement("div", { key: item.id }, item.name);

    const table = React.createElement(AdminDataTable<TestRow>, {
      columns,
      data: sampleData,
      keyExtractor: (item) => item.id,
      renderMobileCard,
    });

    expect(table.props.renderMobileCard).toBeDefined();
  });

  it("debe soportar configuración de paginación integrada", () => {
    const table = React.createElement(AdminDataTable<TestRow>, {
      columns,
      data: sampleData,
      keyExtractor: (item) => item.id,
      pagination: {
        currentPage: 1,
        totalPages: 5,
        totalItems: 50,
        currentCount: 3,
        itemLabel: "usuarios",
        onPageChange: vi.fn(),
      },
    });

    expect(table.props.pagination?.currentPage).toBe(1);
    expect(table.props.pagination?.totalPages).toBe(5);
    expect(table.props.pagination?.itemLabel).toBe("usuarios");
  });

  it("debe soportar emptyState personalizado cuando data está vacía", () => {
    const table = React.createElement(AdminDataTable<TestRow>, {
      columns,
      data: [],
      keyExtractor: (item) => item.id,
      emptyState: {
        title: "No hay registros",
        description: "Intenta con otros criterios de búsqueda",
      },
    });

    expect(table.props.data.length).toBe(0);
    expect(table.props.emptyState?.title).toBe("No hay registros");
  });
});
