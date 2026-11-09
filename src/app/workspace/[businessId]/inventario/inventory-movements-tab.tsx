"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  History,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  Sliders,
  ArrowLeftRight,
  ShoppingCart,
  AlertTriangle,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  InventoryMovementWithDetails,
  Location,
  MovementType,
  MOVEMENT_TYPE_LABELS,
} from "@/lib/inventory/types";
import { getInventoryMovementsHistoryAction } from "./actions";
import { MovementFormModal } from "./movement-form-modal";
import { formatCOP } from "@/lib/pos/types";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";

interface Props {
  businessId: string;
  locations: Location[];
  onRefreshStock?: () => void;
}

export function InventoryMovementsTab({
  businessId,
  locations,
  onRefreshStock,
}: Props) {
  const [movements, setMovements] = useState<InventoryMovementWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Filtros
  const [search, setSearch] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");

  const loadMovements = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getInventoryMovementsHistoryAction(businessId, {
        locationId: selectedLocation !== "all" ? selectedLocation : undefined,
        movementType: selectedType !== "all" ? (selectedType as MovementType) : undefined,
        limit: 150,
      });

      if (res.success && res.data) {
        setMovements(res.data);
      } else {
        toast.error("Error al consultar movimientos", { description: res.error });
      }
    } catch (err: any) {
      toast.error("Error al cargar historial de inventario", { description: err?.message });
    } finally {
      setIsLoading(false);
    }
  }, [businessId, selectedLocation, selectedType]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  // Filtrado de texto local
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      const prodMatch = m.productName.toLowerCase().includes(term);
      const skuMatch = m.productSku?.toLowerCase()?.includes(term);
      const noteMatch = m.notes?.toLowerCase()?.includes(term);
      const locMatch = m.locationName.toLowerCase().includes(term);
      return prodMatch || skuMatch || noteMatch || locMatch;
    });
  }, [movements, search]);

  // Paginación estándar
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedLocation, selectedType]);

  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedMovements = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredMovements.slice(startIndex, startIndex + pageSize);
  }, [filteredMovements, safeCurrentPage, pageSize]);

  const getMovementBadge = (type: MovementType) => {
    switch (type) {
      case "entry":
        return {
          icon: <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />,
          label: "Entrada",
          className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          prefix: "+",
        };
      case "exit":
        return {
          icon: <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />,
          label: "Salida",
          className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
          prefix: "-",
        };
      case "adjustment":
        return {
          icon: <Sliders className="w-3.5 h-3.5 text-blue-500" />,
          label: "Ajuste Físico",
          className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          prefix: "=",
        };
      case "transfer_in":
        return {
          icon: <ArrowLeftRight className="w-3.5 h-3.5 text-purple-500" />,
          label: "Transferencia (+)",
          className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
          prefix: "+",
        };
      case "transfer_out":
        return {
          icon: <ArrowLeftRight className="w-3.5 h-3.5 text-purple-500" />,
          label: "Transferencia (-)",
          className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
          prefix: "-",
        };
      case "sale":
        return {
          icon: <ShoppingCart className="w-3.5 h-3.5 text-slate-500" />,
          label: "Venta POS",
          className: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
          prefix: "-",
        };
      case "spoilage":
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
          label: "Merma",
          className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          prefix: "-",
        };
      default:
        return {
          icon: <History className="w-3.5 h-3.5 text-slate-500" />,
          label: type,
          className: "bg-slate-100 text-slate-600 border-slate-200",
          prefix: "",
        };
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat("es-CO", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(d);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* 1. BARRA SUPERIOR DE ACCIONES Y FILTROS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Buscador */}
          <div className="flex-1 sm:w-64">
            <SearchInput
              placeholder="Buscar por producto, SKU o notas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch("")}
            />
          </div>

          {/* Tipo de movimiento */}
          <Select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="all">Todos los Tipos</option>
            <option value="entry">Entrada (+)</option>
            <option value="exit">Salida (-)</option>
            <option value="adjustment">Ajuste (=)</option>
            <option value="transfer_in">Transferencia (Entrada)</option>
            <option value="transfer_out">Transferencia (Salida)</option>
            <option value="spoilage">Merma</option>
            <option value="sale">Venta</option>
          </Select>

          {/* Ubicación */}
          <Select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
          >
            <option value="all">Todas las Ubicaciones</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </Select>

          {/* Recargar */}
          <button
            onClick={() => loadMovements()}
            title="Recargar historial"
            className="p-2 rounded-xl border border-slate-200/80 dark:border-white/[0.08] text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* BOTÓN NUEVO MOVIMIENTO */}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-[#ED500A]/20 transition-all cursor-pointer active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nuevo movimiento</span>
        </button>
      </div>

      {/* 2. TABLA DE HISTORIAL DE MOVIMIENTOS */}
      <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin mb-3 text-[#ED500A]" />
            <p className="text-sm">Consultando kardex de inventario...</p>
          </div>
        ) : filteredMovements.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[0.04] text-slate-400 flex items-center justify-center mx-auto mb-3">
              <History className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-white">
              No hay movimientos registrados
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              Registra nuevas entradas, salidas o ajustes de inventario para alimentar el kardex histórico.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[1000px]">
                <thead className="bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4 min-w-[130px]">Fecha / Hora</th>
                    <th className="py-3 px-4 min-w-[140px]">Tipo</th>
                    <th className="py-3 px-4 min-w-[180px]">Producto</th>
                    <th className="py-3 px-4 min-w-[130px]">Ubicación</th>
                    <th className="py-3 px-4 text-right min-w-[90px]">Cantidad</th>
                    <th className="py-3 px-4 text-right min-w-[110px]">Costo Unit.</th>
                    <th className="py-3 px-4 text-right min-w-[110px]">Costo Total</th>
                    <th className="py-3 px-4 min-w-[140px]">Responsable</th>
                    <th className="py-3 px-4 min-w-[180px]">Notas / Referencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                  {paginatedMovements.map((m) => {
                    const badge = getMovementBadge(m.movementType);
                    return (
                      <tr
                        key={m.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-white/[0.015] transition-colors"
                      >
                        {/* Fecha y hora */}
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">
                          {formatDate(m.createdAt)}
                        </td>

                        {/* Tipo de movimiento */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-2xs font-bold border ${badge.className}`}
                          >
                            {badge.icon}
                            <span>{badge.label}</span>
                          </span>
                        </td>

                        {/* Producto */}
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                          <div className="flex flex-col">
                            <span>{m.productName}</span>
                            {m.productSku && (
                              <span className="text-2xs text-slate-400 font-normal">
                                SKU: {m.productSku}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Ubicación */}
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                          {m.locationName}
                        </td>

                        {/* Cantidad */}
                        <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                          <span
                            className={
                              m.movementType === "entry" || m.movementType === "transfer_in"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : m.movementType === "exit" || m.movementType === "transfer_out" || m.movementType === "spoilage" || m.movementType === "sale"
                                ? "text-red-600 dark:text-red-400"
                                : "text-blue-600 dark:text-blue-400"
                            }
                          >
                            {badge.prefix}
                            {m.quantity}
                          </span>
                        </td>

                        {/* Costo Unitario */}
                        <td className="py-3 px-4 text-right text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                          {m.unitCost ? formatCOP(m.unitCost) : "—"}
                        </td>

                        {/* Costo Total */}
                        <td className="py-3 px-4 text-right font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {m.totalCost ? formatCOP(m.totalCost) : "—"}
                        </td>

                        {/* Responsable */}
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 text-xs">
                          <div className="flex items-center gap-1.5 text-2xs">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[120px]">
                              {m.createdByName || "Sistema"}
                            </span>
                          </div>
                        </td>

                        {/* Notas */}
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-xs">
                          {m.notes ? (
                            <span className="line-clamp-2" title={m.notes}>
                              {m.notes}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-2xs">Sin observaciones</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredMovements.length > 0 && (
              <div className="border-t border-slate-200/80 dark:border-white/[0.08] p-3 sm:p-4">
                <Pagination
                  currentPage={safeCurrentPage}
                  totalPages={totalPages}
                  totalItems={filteredMovements.length}
                  currentCount={paginatedMovements.length}
                  pageSize={pageSize}
                  itemLabel="movimientos"
                  onPageChange={(pg) => setCurrentPage(pg)}
                  onPageSizeChange={(newSize: number) => {
                    setPageSize(newSize);
                    setCurrentPage(1);
                  }}
                  pageSizeOptions={[10, 20, 50, 100]}
                  showFirstLast
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL NUEVO MOVIMIENTO */}
      <MovementFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        businessId={businessId}
        locations={locations}
        onSuccess={() => {
          loadMovements();
          if (onRefreshStock) onRefreshStock();
        }}
      />
    </div>
  );
}
