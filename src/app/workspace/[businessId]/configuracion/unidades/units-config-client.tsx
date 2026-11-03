"use client";

import React, { useState, useMemo } from "react";
import {
  Scale,
  Droplets,
  Ruler,
  Hash,
  Plus,
  Search,
  Edit2,
  Trash2,
  Lock,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  MeasurementUnit,
  MeasurementUnitType,
  MEASUREMENT_UNIT_TYPES,
  MEASUREMENT_UNIT_TYPE_LABELS,
} from "@/lib/units/types";
import { UnitFormModal } from "./unit-form-modal";
import { deleteMeasurementUnitAction, checkUnitUsageAction } from "./actions";

interface Props {
  businessId: string;
  initialUnits: MeasurementUnit[];
  canManage: boolean;
}

export function UnitsConfigClient({ businessId, initialUnits, canManage }: Props) {
  const [units, setUnits] = useState<MeasurementUnit[]>(initialUnits);
  const [activeTab, setActiveTab] = useState<"all" | MeasurementUnitType>("all");
  const [search, setSearch] = useState("");

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unitToEdit, setUnitToEdit] = useState<MeasurementUnit | null>(null);

  // Modal de confirmación de eliminación accesible (NO alertas nativas)
  const [unitToDelete, setUnitToDelete] = useState<MeasurementUnit | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [usageCheck, setUsageCheck] = useState<{
    loading: boolean;
    inUse: boolean;
    count: number;
    details: string[];
  } | null>(null);

  // Unidades base para configurar referencias
  const baseUnits = useMemo(() => units.filter((u) => u.isBase), [units]);

  // Filtrado reactivo
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      const matchesTab = activeTab === "all" || u.type === activeTab;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.abbreviation.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [units, activeTab, search]);

  // Contadores métricos
  const stats = useMemo(() => {
    return {
      total: units.length,
      base: units.filter((u) => u.isBase).length,
      system: units.filter((u) => u.isSystem).length,
      custom: units.filter((u) => !u.isSystem).length,
    };
  }, [units]);

  const handleOpenCreate = () => {
    setUnitToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (unit: MeasurementUnit) => {
    setUnitToEdit(unit);
    setIsModalOpen(true);
  };

  const handleSuccessUnit = (savedUnit: MeasurementUnit) => {
    setUnits((prev) => {
      const idx = prev.findIndex((u) => u.id === savedUnit.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = savedUnit;
        return next;
      }
      return [...prev, savedUnit];
    });
  };

  const handlePromptDelete = async (unit: MeasurementUnit) => {
    if (unit.isSystem || unit.isBase) {
      toast.error("Las unidades base y predeterminadas del sistema no pueden ser eliminadas.");
      return;
    }

    setUnitToDelete(unit);
    setUsageCheck({ loading: true, inUse: false, count: 0, details: [] });

    try {
      const res = await checkUnitUsageAction(businessId, unit.abbreviation);
      setUsageCheck({
        loading: false,
        inUse: res.inUse,
        count: res.count,
        details: res.details,
      });
    } catch {
      setUsageCheck({
        loading: false,
        inUse: false,
        count: 0,
        details: [],
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!unitToDelete) return;
    setIsDeleting(true);

    try {
      const res = await deleteMeasurementUnitAction(businessId, unitToDelete.id);
      if (!res.success) {
        toast.error(res.error || "No fue posible eliminar la unidad.");
        setIsDeleting(false);
        return;
      }

      toast.success(res.message || "Unidad eliminada exitosamente.");
      setUnits((prev) => prev.filter((u) => u.id !== unitToDelete.id));
      setUnitToDelete(null);
    } catch (err: any) {
      toast.error("Error al eliminar", { description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const getTypeBadge = (type: MeasurementUnitType) => {
    switch (type) {
      case "weight":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <Scale className="w-3 h-3" />
            {MEASUREMENT_UNIT_TYPE_LABELS[type]}
          </span>
        );
      case "volume":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20">
            <Droplets className="w-3 h-3" />
            {MEASUREMENT_UNIT_TYPE_LABELS[type]}
          </span>
        );
      case "length":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
            <Ruler className="w-3 h-3" />
            {MEASUREMENT_UNIT_TYPE_LABELS[type]}
          </span>
        );
      case "count":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <Hash className="w-3 h-3" />
            {MEASUREMENT_UNIT_TYPE_LABELS[type]}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Tarjetas métricas superiores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Unidades</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{stats.total}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Disponibles en el negocio</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Unidades Base</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{stats.base}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">kg, lt, m, un (factor 1.0)</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Del Sistema</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{stats.system}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Predeterminadas protegidas</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/[0.08] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Personalizadas</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Hash className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{stats.custom}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Creadas para recetas/stock</p>
        </div>
      </div>

      {/* Barra de Filtros y Acciones */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm">
        {/* Pestañas por Magnitud */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === "all"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            }`}
          >
            Todas ({units.length})
          </button>
          {MEASUREMENT_UNIT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === t
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
              }`}
            >
              {MEASUREMENT_UNIT_TYPE_LABELS[t]} (
              {units.filter((u) => u.type === t).length})
            </button>
          ))}
        </div>

        {/* Buscador y Botón Crear */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar unidad o símbolo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {canManage && (
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Unidad</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Unidades */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3">Unidad</th>
                <th className="px-4 py-3">Abreviación</th>
                <th className="px-4 py-3">Magnitud</th>
                <th className="px-4 py-3">Factor de Conversión</th>
                <th className="px-4 py-3">Nivel</th>
                <th className="px-4 py-3">Origen</th>
                {canManage && <th className="px-4 py-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
              {filteredUnits.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 7 : 6}
                    className="px-6 py-12 text-center text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                      <div className="p-3 rounded-2xl bg-slate-100 dark:bg-white/[0.04] text-slate-400 mb-3">
                        <Scale className="w-6 h-6" />
                      </div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        No se encontraron unidades de medida
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {search
                          ? "Intenta con otro término de búsqueda."
                          : "Crea una nueva unidad de medida personalizada para recetas o inventario."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUnits.map((u) => {
                  const baseUnit = baseUnits.find((b) => b.id === u.baseUnitId);
                  const baseAbbrev = baseUnit?.abbreviation || (u.isBase ? u.abbreviation : "base");

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Nombre */}
                      <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{u.name}</span>
                          {u.isBase && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                              BASE
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Abreviación */}
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                        <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.06]">
                          {u.abbreviation}
                        </span>
                      </td>

                      {/* Magnitud / Tipo */}
                      <td className="px-4 py-3.5">{getTypeBadge(u.type)}</td>

                      {/* Factor de Conversión */}
                      <td className="px-4 py-3.5">
                        {u.isBase ? (
                          <span className="text-slate-400 text-xs italic">
                            1.0 (Referencia base)
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.04] text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                            <span>1 {u.abbreviation}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {u.conversionFactor} {baseAbbrev}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Nivel */}
                      <td className="px-4 py-3.5">
                        {u.isBase ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400">
                            <Sparkles className="w-3 h-3" />
                            Unidad Base
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Unidad Derivada
                          </span>
                        )}
                      </td>

                      {/* Origen */}
                      <td className="px-4 py-3.5">
                        {u.isSystem ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <Lock className="w-3 h-3" />
                            Sistema
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Negocio
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      {canManage && (
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEdit(u)}
                              title="Editar unidad"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {u.isSystem || u.isBase ? (
                              <button
                                disabled
                                title="Las unidades de sistema o base no pueden eliminarse"
                                className="p-1.5 rounded-lg text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-50"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handlePromptDelete(u)}
                                title="Eliminar unidad"
                                className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Formulario Crear/Editar */}
      <UnitFormModal
        businessId={businessId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccessUnit}
        baseUnits={baseUnits}
        unitToEdit={unitToEdit}
      />

      {/* Modal de Confirmación de Eliminación Accesible (PROHIBIDO ALERTAS NATIVAS) */}
      {unitToDelete && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-2xl bg-red-500/10 text-red-600 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    ¿Eliminar unidad «{unitToDelete.name}»?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Esta acción eliminará permanentemente la unidad con símbolo{" "}
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {unitToDelete.abbreviation}
                    </span>
                    .
                  </p>
                </div>
              </div>

              {/* Verificación de Uso en Recetas y Productos */}
              {usageCheck?.loading ? (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span>Verificando uso en recetas y catálogo de productos...</span>
                </div>
              ) : usageCheck?.inUse ? (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Unidad en uso actualmente:
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Esta unidad no se puede eliminar porque está asociada a:{" "}
                    <strong>{usageCheck.details.join(", ")}</strong>. Para eliminarla, primero
                    reemplaza su uso en las recetas o productos correspondientes.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>La unidad no tiene dependencias activas en recetas ni catálogo.</span>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setUnitToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting || usageCheck?.loading || usageCheck?.inUse}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isDeleting ? "Eliminando..." : "Confirmar Eliminación"}</span>
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
