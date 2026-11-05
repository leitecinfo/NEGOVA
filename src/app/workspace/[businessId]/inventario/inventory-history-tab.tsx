"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  History,
  Search,
  Filter,
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Tag,
  Warehouse,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import {
  Location,
  MovementType,
  InventoryMovementWithDetails,
  MovementOrigin,
  MOVEMENT_ORIGIN_OPTIONS,
  formatMovementDate,
  resolveMovementOrigin,
} from "@/lib/inventory/types";
import { getInventoryMovementsHistoryAction } from "./actions";

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
  const [selectedLocation, setSelectedLocation] = useState<string>("all");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Consulta del kardex histórico
  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await getInventoryMovementsHistoryAction(businessId, {
        limit: 200,
        locationId: selectedLocation !== "all" ? selectedLocation : undefined,
      });

      if (res.success && res.data) {
        // Asegurar que cada movimiento tenga su origen resuelto
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
  }, [businessId, selectedLocation]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Resetear página al modificar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedOrigin, search, selectedType, selectedLocation, pageSize]);

  // Formato COP
  const formatCOP = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return "—";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

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

  // Helper para Badge del Origen (POS, Mesa, Domicilio, Devolución, Otro)
  const getOriginMeta = (origin: MovementOrigin | undefined) => {
    switch (origin) {
      case "POS":
        return {
          label: "POS",
          badgeClass:
            "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
          icon: <ShoppingCart className="w-3 h-3 text-blue-500 shrink-0" />,
        };
      case "Mesa":
        return {
          label: "Mesa",
          badgeClass:
            "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
          icon: <Store className="w-3 h-3 text-amber-500 shrink-0" />,
        };
      case "Domicilio":
        return {
          label: "Domicilio",
          badgeClass:
            "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
          icon: <Bike className="w-3 h-3 text-sky-500 shrink-0" />,
        };
      case "Devolución":
        return {
          label: "Devolución",
          badgeClass:
            "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
          icon: <RotateCcw className="w-3 h-3 text-purple-500 shrink-0" />,
        };
      case "Otro":
      default:
        return {
          label: "Otro",
          badgeClass:
            "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20",
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

      // 3. Filtro por ubicación
      if (selectedLocation !== "all" && m.locationId !== selectedLocation) {
        return false;
      }

      // 4. Búsqueda libre
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        const matchesProduct = (m.productName || "").toLowerCase().includes(term);
        const matchesSku = (m.productSku || "").toLowerCase().includes(term);
        const matchesNotes = (m.notes || "").toLowerCase().includes(term);
        const matchesLocation = (m.locationName || "").toLowerCase().includes(term);
        const matchesOrigin = (m.origin || "").toLowerCase().includes(term);

        if (
          !matchesProduct &&
          !matchesSku &&
          !matchesNotes &&
          !matchesLocation &&
          !matchesOrigin
        ) {
          return false;
        }
      }

      return true;
    });
  }, [movements, selectedOrigin, selectedType, selectedLocation, search]);

  // Cálculos de paginación
  const totalItems = filteredMovements.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedMovements = filteredMovements.slice(startIndex, startIndex + pageSize);

  const hasActiveFilters =
    selectedOrigin !== "all" ||
    selectedType !== "all" ||
    selectedLocation !== "all" ||
    search.trim() !== "";

  const handleClearFilters = () => {
    setSelectedOrigin("all");
    setSelectedType("all");
    setSelectedLocation("all");
    setSearch("");
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
            Kardex detallado de entradas, salidas y orígenes por módulo operativo.
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
              <span>+ Nuevo movimiento</span>
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

      {/* 2. BARRA DE FILTROS: Canal/Origen, Búsqueda, Tipo y Ubicación */}
      <div className="p-3.5 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Búsqueda libre */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar producto, SKU, notas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50/50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* FILTRO DESPLEGABLE POR CANAL / ORIGEN */}
          <div className="relative">
            <select
              aria-label="Filtro por canal u origen"
              value={selectedOrigin}
              onChange={(e) => setSelectedOrigin(e.target.value as MovementOrigin | "all")}
              className="w-full px-3 py-2 bg-slate-50/50 dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 transition-colors cursor-pointer"
            >
              {MOVEMENT_ORIGIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Tipo (Entrada / Salida) */}
          <div className="relative">
            <select
              aria-label="Filtro por tipo de movimiento"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as "all" | "entry" | "exit")}
              className="w-full px-3 py-2 bg-slate-50/50 dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 transition-colors cursor-pointer"
            >
              <option value="all">Todos los Tipos</option>
              <option value="entry">Entradas (+)</option>
              <option value="exit">Salidas (-)</option>
            </select>
          </div>

          {/* Filtro por Ubicación (si hay más de 1) */}
          {locations.length > 1 ? (
            <div className="relative">
              <select
                aria-label="Filtro por ubicación o almacén"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50/50 dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/40 transition-colors cursor-pointer"
              >
                <option value="all">Todas las Ubicaciones</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04] rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpiar filtros</span>
                </button>
              )}
            </div>
          )}
        </div>

        {locations.length > 1 && hasActiveFilters && (
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
                : "Las ventas, órdenes en mesa, domicilios, devoluciones y ajustes de inventario aparecerán registrados aquí."}
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
                  {/* Fecha (D/M/AAAA HH:mm) */}
                  <th className="py-3 px-4 min-w-[130px]">Fecha</th>
                  {/* Producto (Nombre) */}
                  <th className="py-3 px-4 min-w-[200px]">Producto</th>
                  {/* Tipo (Badge Entrada en verde / Salida en rojo) */}
                  <th className="py-3 px-4 min-w-[120px]">Tipo</th>
                  {/* Origen (Badge del módulo: POS, Mesa, Domicilio, Devolución, Otro) */}
                  <th className="py-3 px-4 min-w-[130px]">Origen</th>
                  {/* Cantidad (Unidades afectadas) */}
                  <th className="py-3 px-4 text-right min-w-[100px]">Cantidad</th>
                  {/* Costo Unit. (Formato moneda) */}
                  <th className="py-3 px-4 text-right min-w-[110px]">Costo Unit.</th>
                  {/* Total (Cantidad x Costo unitario) */}
                  <th className="py-3 px-4 text-right min-w-[120px]">Total</th>
                  {/* Notas (Identificador de factura, ticket de cocina, motivo de merma o devolución) */}
                  <th className="py-3 px-4 min-w-[220px]">Notas / Referencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {paginatedMovements.map((m) => {
                  const typeMeta = getMovementTypeMeta(m);
                  const originMeta = getOriginMeta(m.origin);
                  const qty = Number(m.quantity || 0);
                  const unitCost = m.unitCost ?? 0;
                  const total = m.totalCost ?? qty * unitCost;

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/[0.015] transition-colors"
                    >
                      {/* Fecha (D/M/AAAA HH:mm) */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
                        {formatMovementDate(m.createdAt)}
                      </td>

                      {/* Producto (Nombre) */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {m.productName}
                          </span>
                          {m.productSku && (
                            <span className="text-2xs font-mono text-slate-400 dark:text-slate-500">
                              SKU: {m.productSku}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tipo (Badge Entrada en verde / Salida en rojo) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-2xs font-bold ${typeMeta.badgeClass}`}
                        >
                          {typeMeta.icon}
                          <span>{typeMeta.label}</span>
                        </span>
                      </td>

                      {/* Origen (Badge del módulo: POS, Mesa, Domicilio, Devolución, Otro) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-2xs font-bold ${originMeta.badgeClass}`}
                        >
                          {originMeta.icon}
                          <span>{originMeta.label}</span>
                        </span>
                      </td>

                      {/* Cantidad (Unidades afectadas) */}
                      <td className="py-3 px-4 text-right font-black font-mono text-xs sm:text-sm whitespace-nowrap">
                        <span className={typeMeta.textClass}>
                          {typeMeta.prefix}
                          {qty.toLocaleString("es-CO")}
                        </span>
                      </td>

                      {/* Costo Unit. (Formato moneda) */}
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400 font-mono text-xs whitespace-nowrap">
                        {m.unitCost !== null && m.unitCost !== undefined
                          ? formatCOP(m.unitCost)
                          : "—"}
                      </td>

                      {/* Total (Cantidad x Costo unitario) */}
                      <td className="py-3 px-4 text-right font-bold font-mono text-slate-900 dark:text-white text-xs whitespace-nowrap">
                        {total > 0 ? formatCOP(total) : "—"}
                      </td>

                      {/* Notas (Identificador de factura, ticket de cocina, motivo de merma o devolución) */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 text-xs">
                        {m.notes ? (
                          <div className="flex items-start gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-2" title={m.notes}>
                              {m.notes}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-2xs">
                            Sin observaciones
                          </span>
                        )}
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
          <div className="p-3.5 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-200/80 dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <span>
                Mostrando{" "}
                <strong className="text-slate-900 dark:text-white">
                  {startIndex + 1}
                </strong>{" "}
                a{" "}
                <strong className="text-slate-900 dark:text-white">
                  {Math.min(startIndex + pageSize, totalItems)}
                </strong>{" "}
                de{" "}
                <strong className="text-slate-900 dark:text-white">
                  {totalItems}
                </strong>{" "}
                movimientos
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-2xs uppercase tracking-wider text-slate-400">
                  Filas:
                </span>
                <select
                  aria-label="Movimientos por página"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 bg-white dark:bg-[#0E131F] border border-slate-200/80 dark:border-white/[0.08] rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-hidden"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Primera página"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 font-mono font-medium text-slate-700 dark:text-slate-300">
                Página {safeCurrentPage} de {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Página siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                title="Última página"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
