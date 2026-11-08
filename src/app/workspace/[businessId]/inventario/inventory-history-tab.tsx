"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  History,
  Search,
  RefreshCw,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingCart,
  Bike,
  RotateCcw,
  Layers,
  Plus,
  X,
  FileText,
  Tag,
  Warehouse,
  Store,
  Package,
  Calendar,
  User,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  Location,
  InventoryMovementWithDetails,
  MovementOrigin,
  MOVEMENT_ORIGIN_OPTIONS,
  formatMovementDate,
  resolveMovementOrigin,
} from "@/lib/inventory/types";
import { getInventoryMovementsHistoryAction } from "./actions";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { MovementDetailModal } from "./movement-detail-modal";
import { formatCOP } from "@/lib/pos/types";

interface Props {
  businessId: string;
  locations?: Location[];
  onOpenMovementModal?: () => void;
  onOpenTransferModal?: () => void;
}

export function InventoryHistoryTab({
  businessId,
  locations = [],
  onOpenMovementModal,
  onOpenTransferModal,
}: Props) {
  const [movements, setMovements] = useState<InventoryMovementWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filtros
  const [selectedOrigin, setSelectedOrigin] = useState<MovementOrigin | "all">("all");
  const [search, setSearch] = useState<string>("");
  const [selectedType, setSelectedType] = useState<"all" | "entry" | "exit">("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Modal de detalle
  const [selectedMovementForDetail, setSelectedMovementForDetail] =
    useState<InventoryMovementWithDetails | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Consulta del kardex histórico
  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await getInventoryMovementsHistoryAction(businessId, {
        limit: 300,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (res.success && res.data) {
        const enriched = res.data.map((m) => ({
          ...m,
          origin:
            m.origin ||
            resolveMovementOrigin({
              referenceType: m.referenceType,
              referenceId: m.referenceId,
              notes: m.notes,
              movementType: m.movementType,
            }),
        }));
        setMovements(enriched);
      } else {
        const msg = res.error || "No se pudo recuperar el historial de movimientos.";
        setLoadError(msg);
        toast.error("Error al cargar historial", { description: msg });
      }
    } catch (err: any) {
      const msg = err?.message || "Error al conectar con el servidor.";
      setLoadError(msg);
      toast.error("Error al consultar historial", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [businessId, startDate, endDate]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Resetear página al modificar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedOrigin, search, selectedType, startDate, endDate, pageSize]);

  // Helper para clasificar Tipo: Entrada (verde) / Salida (rojo)
  const getMovementTypeMeta = (m: InventoryMovementWithDetails) => {
    const isEntry =
      m.movementType === "entry" ||
      m.movementType === "transfer_in" ||
      (m.movementType === "adjustment" && m.quantity >= 0);

    if (isEntry) {
      return {
        label: "Entrada",
        prefix: "+",
        badgeClass:
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
        icon: <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500 shrink-0" />,
        textClass: "text-emerald-600 dark:text-emerald-400",
      };
    }

    return {
      label: "Salida",
      prefix: "-",
      badgeClass:
        "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
      icon: <ArrowUpRight className="w-3.5 h-3.5 text-rose-500 shrink-0" />,
      textClass: "text-rose-600 dark:text-rose-400",
    };
  };

  // Helper para Badge del Origen (Compra, Merma, Ajuste, Receta, POS, Mesa, Domicilio, Devolución, Otro)
  const getOriginMeta = (origin: MovementOrigin | undefined) => {
    switch (origin) {
      case "Compra":
        return {
          label: "Compra",
          badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20",
          icon: <Package className="w-3 h-3 text-emerald-500 shrink-0" />,
        };
      case "Merma":
        return {
          label: "Merma",
          badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20",
          icon: <RotateCcw className="w-3 h-3 text-rose-500 shrink-0" />,
        };
      case "Ajuste":
        return {
          label: "Ajuste",
          badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20",
          icon: <SlidersHorizontal className="w-3 h-3 text-blue-500 shrink-0" />,
        };
      case "Receta":
        return {
          label: "Receta",
          badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20",
          icon: <Layers className="w-3 h-3 text-purple-500 shrink-0" />,
        };
      case "POS":
        return {
          label: "POS",
          badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20",
          icon: <ShoppingCart className="w-3 h-3 text-sky-500 shrink-0" />,
        };
      case "Mesa":
        return {
          label: "Mesa",
          badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20",
          icon: <Store className="w-3 h-3 text-amber-500 shrink-0" />,
        };
      case "Domicilio":
        return {
          label: "Domicilio",
          badgeClass: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20",
          icon: <Bike className="w-3 h-3 text-indigo-500 shrink-0" />,
        };
      case "Devolución":
        return {
          label: "Devolución",
          badgeClass: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20",
          icon: <RotateCcw className="w-3 h-3 text-violet-500 shrink-0" />,
        };
      case "Otro":
      default:
        return {
          label: "Otro",
          badgeClass: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20",
          icon: <Layers className="w-3 h-3 text-slate-500 shrink-0" />,
        };
    }
  };

  // Filtrado reactivo en memoria
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      // 1. Filtro por origen
      if (selectedOrigin !== "all") {
        if (m.origin !== selectedOrigin) return false;
      }

      // 2. Filtro por tipo (Entrada / Salida)
      if (selectedType !== "all") {
        const isEntry =
          m.movementType === "entry" ||
          m.movementType === "transfer_in" ||
          (m.movementType === "adjustment" && m.quantity >= 0);
        if (selectedType === "entry" && !isEntry) return false;
        if (selectedType === "exit" && isEntry) return false;
      }

      // 3. Búsqueda libre
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        const matchesProduct = (m.productName || "").toLowerCase().includes(term);
        const matchesSku = (m.productSku || "").toLowerCase().includes(term);
        const matchesNotes = (m.notes || "").toLowerCase().includes(term);
        const matchesOrigin = (m.origin || "").toLowerCase().includes(term);
        const matchesUser = (m.createdByName || "").toLowerCase().includes(term);

        if (!matchesProduct && !matchesSku && !matchesNotes && !matchesOrigin && !matchesUser) {
          return false;
        }
      }

      return true;
    });
  }, [movements, selectedOrigin, selectedType, search]);

  // Cálculos de paginación
  const totalItems = filteredMovements.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedMovements = filteredMovements.slice(startIndex, startIndex + pageSize);

  const hasActiveFilters =
    selectedOrigin !== "all" ||
    selectedType !== "all" ||
    startDate !== "" ||
    endDate !== "" ||
    search.trim() !== "";

  const handleClearFilters = () => {
    setSelectedOrigin("all");
    setSelectedType("all");
    setStartDate("");
    setEndDate("");
    setSearch("");
  };

  const handleOpenDetail = (m: InventoryMovementWithDetails) => {
    setSelectedMovementForDetail(m);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. ENCABEZADO: Título 'Historial de Movimientos' y Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-500" />
            <span>Historial de Movimientos</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Kardex trazable de entradas, salidas, mermas y ajustes con causas identificables.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onOpenMovementModal && (
            <button
              type="button"
              onClick={onOpenMovementModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-[#ED500A]/20 transition-all cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo movimiento</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadHistory}
            disabled={isLoading}
            title="Recargar movimientos"
            className="p-2 rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS: Búsqueda, Origen, Tipo, Rango de Fechas */}
      <div className="p-3.5 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Búsqueda libre */}
          <div className="sm:col-span-2">
            <SearchInput
              placeholder="Buscar por artículo, SKU, usuario, notas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
            />
          </div>

          {/* FILTRO POR CANAL / ORIGEN */}
          <Select
            aria-label="Filtro por canal u origen"
            value={selectedOrigin}
            onChange={(e) => setSelectedOrigin(e.target.value as MovementOrigin | "all")}
          >
            {MOVEMENT_ORIGIN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          {/* Filtro por Tipo (Entrada / Salida) */}
          <Select
            aria-label="Filtro por tipo de movimiento"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as "all" | "entry" | "exit")}
          >
            <option value="all">Entradas y Salidas</option>
            <option value="entry">Solo Entradas (+)</option>
            <option value="exit">Solo Salidas (-)</option>
          </Select>

          {/* Filtro Rango de Fechas */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="Fecha inicial"
              className="w-1/2 px-2 py-1.5 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40"
            />
            <span className="text-slate-400 text-xs">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="Fecha final"
              className="w-1/2 px-2 py-1.5 text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar filtros</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. TABLA DE MOVIMIENTOS (KARDEX) */}
      <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin mb-3 text-[#ED500A]" />
            <p className="text-sm font-medium">Consultando historial de movimientos...</p>
          </div>
        ) : loadError ? (
          <div className="p-8 text-center">
            <p className="text-sm text-rose-500 font-semibold mb-2">{loadError}</p>
            <button
              type="button"
              onClick={loadHistory}
              className="px-4 py-2 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 text-slate-700 dark:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        ) : filteredMovements.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[0.04] text-slate-400 flex items-center justify-center mx-auto mb-3">
              <History className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-white">
              {hasActiveFilters
                ? "No se encontraron movimientos con los filtros aplicados"
                : "No hay movimientos registrados en el historial"}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              {hasActiveFilters
                ? "Prueba cambiando o limpiando los filtros para ver otros movimientos."
                : "Las compras recibidas, ventas, recetas, mermas y ajustes aparecerán registrados aquí con su causa e impacto."}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-3.5 px-3.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/75 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-semibold uppercase text-2xs tracking-wider">
                <tr>
                  <th className="py-3 px-3.5 min-w-[125px]">Fecha / Hora</th>
                  <th className="py-3 px-3.5 min-w-[190px]">Artículo / Producto</th>
                  <th className="py-3 px-3 min-w-[100px]">Tipo</th>
                  <th className="py-3 px-3 min-w-[120px]">Origen</th>
                  <th className="py-3 px-3 text-right min-w-[90px]">Cantidad</th>
                  <th className="py-3 px-3 text-right min-w-[95px]" title="Existencia antes de la operación">
                    Anterior
                  </th>
                  <th className="py-3 px-3 text-right min-w-[95px]" title="Existencia después de la operación">
                    Resultante
                  </th>
                  <th className="py-3 px-3 text-right min-w-[100px]">Total</th>
                  <th className="py-3 px-3 min-w-[110px]">Usuario</th>
                  <th className="py-3 px-3 text-center min-w-[80px]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {paginatedMovements.map((m) => {
                  const typeMeta = getMovementTypeMeta(m);
                  const originMeta = getOriginMeta(m.origin);
                  const qty = Number(m.quantity || 0);
                  const unit = m.unit || "un";
                  const unitCost = m.unitCost ?? 0;
                  const total = m.totalCost ?? (unitCost > 0 ? qty * unitCost : null);

                  return (
                    <tr
                      key={m.id}
                      onClick={() => handleOpenDetail(m)}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/[0.015] transition-colors cursor-pointer group"
                    >
                      {/* Fecha y hora */}
                      <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
                        {formatMovementDate(m.createdAt)}
                      </td>

                      {/* Artículo */}
                      <td className="py-3 px-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 dark:text-white group-hover:text-[#ED500A] transition-colors">
                            {m.productName}
                          </span>
                          {m.productSku && (
                            <span className="text-2xs font-mono text-slate-400 dark:text-slate-500">
                              SKU: {m.productSku}
                            </span>
                          )}
                          {m.notes && (
                            <span className="text-2xs text-slate-400 dark:text-slate-500 truncate max-w-[220px]" title={m.notes}>
                              Notas: {m.notes}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-2xs font-bold ${typeMeta.badgeClass}`}
                        >
                          {typeMeta.icon}
                          <span>{typeMeta.label}</span>
                        </span>
                      </td>

                      {/* Origen */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-2xs font-bold ${originMeta.badgeClass}`}
                        >
                          {originMeta.icon}
                          <span>{originMeta.label}</span>
                        </span>
                      </td>

                      {/* Cantidad */}
                      <td className="py-3 px-3 text-right font-black font-mono text-xs whitespace-nowrap">
                        <span className={typeMeta.textClass}>
                          {typeMeta.prefix}
                          {qty.toLocaleString("es-CO")} {unit}
                        </span>
                      </td>

                      {/* Existencia Anterior */}
                      <td className="py-3 px-3 text-right text-slate-500 dark:text-slate-400 font-mono text-xs whitespace-nowrap">
                        {m.previousQuantity !== null && m.previousQuantity !== undefined
                          ? `${m.previousQuantity} ${unit}`
                          : "—"}
                      </td>

                      {/* Existencia Resultante */}
                      <td className="py-3 px-3 text-right font-bold text-slate-800 dark:text-slate-200 font-mono text-xs whitespace-nowrap">
                        {m.resultingQuantity !== null && m.resultingQuantity !== undefined
                          ? `${m.resultingQuantity} ${unit}`
                          : "—"}
                      </td>

                      {/* Total */}
                      <td className="py-3 px-3 text-right font-bold font-mono text-slate-900 dark:text-white text-xs whitespace-nowrap">
                        {total !== null && total > 0 ? formatCOP(total) : "—"}
                        {unitCost > 0 && (
                          <span className="text-2xs text-slate-400 font-normal block" title="Costo Unit.">
                            Costo Unit. {formatCOP(unitCost)}
                          </span>
                        )}
                      </td>

                      {/* Usuario */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 text-xs whitespace-nowrap">
                        <span className="truncate max-w-[100px] block" title={m.createdByName || "Sistema"}>
                          {m.createdByName || "Sistema"}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(m)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer"
                          title="Ver detalle completo del movimiento"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. PAGINACIÓN */}
        {!isLoading && filteredMovements.length > 0 && (
          <div className="border-t border-slate-200/80 dark:border-white/[0.08]">
            <Pagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              currentCount={Math.min(pageSize, totalItems - startIndex)}
              pageSize={pageSize}
              itemLabel="movimientos"
              onPageChange={(pg) => setCurrentPage(pg)}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              pageSizeOptions={[10, 20, 50, 100]}
              showFirstLast
            />
          </div>
        )}
      </div>

      {/* Modal de Detalle de Movimiento */}
      <MovementDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedMovementForDetail(null);
        }}
        movement={selectedMovementForDetail}
      />
    </div>
  );
}
