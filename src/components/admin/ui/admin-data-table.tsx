"use client";

import React from "react";
import { AdminEmptyState, AdminEmptyStateProps } from "./admin-empty-state";
import { AdminTableSkeleton } from "./admin-loading-state";
import { AdminPagination, AdminPaginationProps } from "./admin-pagination";

export interface AdminDataTableColumn<T> {
  header: string | React.ReactNode;
  accessor?: keyof T;
  render?: (item: T, index: number) => React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
  headerClassName?: string;
}

export interface AdminDataTableProps<T> {
  columns: AdminDataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  isLoading?: boolean;
  emptyState?: AdminEmptyStateProps;
  renderMobileCard?: (item: T, index: number) => React.ReactNode;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
  rowClassName?: (item: T, index: number) => string;
  /**
   * Fija la primera columna al hacer scroll horizontal (Sticky Column en X).
   * Por defecto: false (fácil de activar o desactivar por tabla con true/false).
   */
  stickyFirstColumn?: boolean;
  /**
   * Ancho mínimo de la tabla para forzar o permitir scroll horizontal.
   * Por defecto: "min-w-[850px]" cuando stickyFirstColumn está activo, o "w-full"
   */
  minWidth?: string;
  /**
   * Paginación integrada opcional
   */
  pagination?: AdminPaginationProps;
}

export function AdminDataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyState,
  renderMobileCard,
  className = "",
  onRowClick,
  rowClassName,
  stickyFirstColumn = false,
  minWidth,
  pagination,
}: AdminDataTableProps<T>) {
  if (isLoading) {
    return <AdminTableSkeleton rows={5} cols={columns.length} />;
  }

  if (data.length === 0 && emptyState) {
    return <AdminEmptyState {...emptyState} />;
  }

  const hasMobileCards = Boolean(renderMobileCard);
  const tableMinWidth = minWidth || (stickyFirstColumn ? "min-w-[850px]" : "w-full");

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Vista de Tabla (Desktop, y Móvil con Scroll Horizontal si no hay renderMobileCard) */}
      <div
        className={`${
          hasMobileCards ? "hidden md:block" : "block"
        } rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0D0E12] shadow-xs overflow-hidden`}
      >
        <div className="overflow-x-auto">
          <table className={`w-full text-left border-collapse ${tableMinWidth}`}>
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                {columns.map((col, idx) => {
                  const isFirstCol = idx === 0 && stickyFirstColumn;
                  return (
                    <th
                      key={idx}
                      className={`py-3.5 px-4 ${
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                          ? "text-center"
                          : "text-left"
                      } ${
                        isFirstCol
                          ? "sticky left-0 z-20 bg-slate-50/95 dark:bg-[#0D0E12]/95 backdrop-blur-xs border-r border-slate-200/80 dark:border-white/10 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_12px_-2px_rgba(0,0,0,0.4)]"
                          : ""
                      } ${col.headerClassName || ""}`}
                    >
                      {col.header}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-xs">
              {data.map((item, rowIdx) => {
                const customRowClass = rowClassName ? rowClassName(item, rowIdx) : "";
                return (
                  <tr
                    key={keyExtractor(item, rowIdx)}
                    onClick={onRowClick ? () => onRowClick(item, rowIdx) : undefined}
                    className={`hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group ${
                      onRowClick ? "cursor-pointer" : ""
                    } ${customRowClass}`}
                  >
                    {columns.map((col, colIdx) => {
                      const isFirstCol = colIdx === 0 && stickyFirstColumn;
                      return (
                        <td
                          key={colIdx}
                          className={`py-3.5 px-4 ${
                            col.align === "right"
                              ? "text-right"
                              : col.align === "center"
                              ? "text-center"
                              : "text-left"
                          } ${
                            isFirstCol
                              ? "sticky left-0 z-10 bg-white group-hover:bg-slate-50/90 dark:bg-[#0D0E12] dark:group-hover:bg-[#14161F] border-r border-slate-200/80 dark:border-white/10 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_12px_-2px_rgba(0,0,0,0.4)]"
                              : ""
                          } ${col.className || ""}`}
                        >
                          {col.render
                            ? col.render(item, rowIdx)
                            : col.accessor
                            ? String(item[col.accessor] ?? "")
                            : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación integrada para vista de tabla */}
      {pagination && (
        <div className={hasMobileCards ? "hidden md:block" : "block"}>
          <AdminPagination {...pagination} />
        </div>
      )}

      {/* Vista Mobile / Tablet Cards */}
      {hasMobileCards && renderMobileCard && (
        <div className="block md:hidden space-y-3">
          {data.map((item, idx) => (
            <React.Fragment key={keyExtractor(item, idx)}>
              {renderMobileCard(item, idx)}
            </React.Fragment>
          ))}
          {pagination && <AdminPagination {...pagination} />}
        </div>
      )}
    </div>
  );
}
