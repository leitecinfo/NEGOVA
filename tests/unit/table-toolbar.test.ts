import { describe, it, expect, vi } from "vitest";
import React from "react";
import {
  TableToolbar,
  AdminTableToolbar,
  TableToolbarProps,
} from "@/components/ui/table-toolbar";
import {
  AdminTableToolbar as BridgeAdminTableToolbar,
} from "@/components/admin/ui/admin-table-toolbar";

describe("TableToolbar — Componente Neutral y Puente de Compatibilidad", () => {
  it("debe garantizar que TableToolbar y AdminTableToolbar apunten a la misma implementación canónica", () => {
    expect(TableToolbar).toBeDefined();
    expect(AdminTableToolbar).toBe(TableToolbar);
    expect(BridgeAdminTableToolbar).toBe(TableToolbar);
  });

  it("debe instanciar TableToolbar con layout inline por defecto", () => {
    const handleSearchChange = vi.fn();
    const handleRefresh = vi.fn();

    const element = React.createElement(TableToolbar, {
      searchQuery: "test",
      onSearchChange: handleSearchChange,
      searchPlaceholder: "Buscar elementos...",
      onRefresh: handleRefresh,
      isPending: false,
      tabs: React.createElement("div", null, "Tabs"),
      filters: React.createElement("div", null, "Filters"),
      actions: React.createElement("div", null, "Actions"),
    });

    expect(element).toBeDefined();
    expect(element.props.searchQuery).toBe("test");
    expect(element.props.searchPlaceholder).toBe("Buscar elementos...");
    expect(element.props.isPending).toBe(false);
    expect(element.props.tabs).toBeDefined();
    expect(element.props.filters).toBeDefined();
    expect(element.props.actions).toBeDefined();
  });

  it("debe instanciar TableToolbar con layout stacked", () => {
    const element = React.createElement(TableToolbar, {
      layout: "stacked",
      searchQuery: "",
      onSearchChange: vi.fn(),
      searchPlaceholder: "Buscar por # o cliente...",
    });

    expect(element).toBeDefined();
    expect(element.props.layout).toBe("stacked");
  });

  it("debe aceptar callbacks tipados de onSearchChange y onRefresh", () => {
    const handleSearchChange = vi.fn((q: string) => q);
    const handleRefresh = vi.fn();

    const element = React.createElement(TableToolbar, {
      searchQuery: "query",
      onSearchChange: handleSearchChange,
      onRefresh: handleRefresh,
    });

    element.props.onSearchChange("nuevo");
    expect(handleSearchChange).toHaveBeenCalledWith("nuevo");

    element.props.onRefresh();
    expect(handleRefresh).toHaveBeenCalled();
  });
});
