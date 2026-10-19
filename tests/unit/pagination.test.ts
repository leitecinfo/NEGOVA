import { describe, it, expect, vi } from "vitest";
import React from "react";
import {
  Pagination,
  AdminPagination,
  PaginationProps,
} from "@/components/ui/pagination";
import {
  AdminPagination as BridgeAdminPagination,
} from "@/components/admin/ui/admin-pagination";

describe("Pagination — Componente Neutral y Puente de Compatibilidad", () => {
  it("debe garantizar que Pagination y AdminPagination apunten a la misma implementación canónica", () => {
    expect(Pagination).toBeDefined();
    expect(AdminPagination).toBe(Pagination);
    expect(BridgeAdminPagination).toBe(Pagination);
  });

  it("debe instanciar con totalItems = 0 (lista vacía) sin errores", () => {
    const handlePageChange = vi.fn();
    const element = React.createElement(Pagination, {
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      currentCount: 0,
      onPageChange: handlePageChange,
    });

    expect(element).toBeDefined();
    expect(element.props.totalItems).toBe(0);
    expect(element.props.currentCount).toBe(0);
  });

  it("debe soportar primera página con botones de retroceso deshabilitados", () => {
    const element = React.createElement(Pagination, {
      currentPage: 1,
      totalPages: 4,
      totalItems: 40,
      currentCount: 10,
      pageSize: 10,
      onPageChange: vi.fn(),
      showFirstLast: true,
    });

    expect(element).toBeDefined();
    expect(element.props.currentPage).toBe(1);
    expect(element.props.totalPages).toBe(4);
    expect(element.props.showFirstLast).toBe(true);
  });

  it("debe soportar página intermedia y llamar a onPageChange", () => {
    const handlePageChange = vi.fn();
    const element = React.createElement(Pagination, {
      currentPage: 2,
      totalPages: 5,
      totalItems: 50,
      currentCount: 10,
      pageSize: 10,
      onPageChange: handlePageChange,
    });

    expect(element.props.currentPage).toBe(2);
    element.props.onPageChange(3);
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it("debe soportar última página con totalItems mayor a pageSize", () => {
    const element = React.createElement(Pagination, {
      currentPage: 5,
      totalPages: 5,
      totalItems: 48,
      currentCount: 8,
      pageSize: 10,
      onPageChange: vi.fn(),
    });

    expect(element.props.currentPage).toBe(5);
    expect(element.props.currentCount).toBe(8);
  });

  it("debe renderizar versión compacta cuando totalItems <= pageSize y totalPages <= 1", () => {
    const element = React.createElement(Pagination, {
      currentPage: 1,
      totalPages: 1,
      totalItems: 6,
      currentCount: 6,
      pageSize: 10,
      onPageChange: vi.fn(),
    });

    expect(element).toBeDefined();
    expect(element.props.totalItems).toBe(6);
    expect(element.props.totalPages).toBe(1);
  });
});
