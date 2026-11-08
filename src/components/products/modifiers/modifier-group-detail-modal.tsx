"use client";

import React from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Button, Badge } from "@/components/ui";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { ModifierGroup, ModifierOption } from "@/lib/modifiers/types";
import { Product } from "@/lib/products/types";
import { formatCOP } from "@/lib/pos/types";
import {
  X,
  Layers,
  Sparkles,
  Tag,
  ArrowRightLeft,
  Package,
  Plus,
  Pencil,
  Trash2,
  Power,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface ModifierGroupDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: ModifierGroup | null;
  products: Product[];
  onEdit: (group: ModifierGroup) => void;
  onDelete: (group: ModifierGroup) => void;
  onConvertToGroup?: (group: ModifierGroup) => void;
  onAddOption: (groupId: string, groupName: string) => void;
  onEditOption: (groupId: string, groupName: string, option: ModifierOption) => void;
  onDeleteOption: (optionId: string, optionName: string) => void;
  onToggleOptionStatus: (option: ModifierOption) => void;
  onToggleGroupStatus: (group: ModifierGroup) => void;
  onUnassignProduct: (groupId: string, productId: string, productName: string) => void;
}

export function ModifierGroupDetailModal({
  isOpen,
  onClose,
  group,
  products,
  onEdit,
  onDelete,
  onConvertToGroup,
  onAddOption,
  onEditOption,
  onDeleteOption,
  onToggleOptionStatus,
  onToggleGroupStatus,
  onUnassignProduct,
}: ModifierGroupDetailModalProps) {
  if (!isOpen || !group) return null;

  const isSingleModifier =
    group.options.length === 1 && group.max_select === 1 && !group.required;
  const activeOptionsCount = group.options.filter((o) => o.status === "active").length;
  const linkedProducts = products.filter((p) =>
    group.applied_product_ids.includes(p.id)
  );

  const optionColumns: DataTableColumn<ModifierOption>[] = [
    {
      header: "#",
      align: "center",
      className: "w-10",
      render: (_, idx) => (
        <span className="text-slate-400 font-mono text-[11px]">{idx + 1}</span>
      ),
    },
    {
      header: "Nombre de la opción",
      accessor: "name",
      render: (opt) => (
        <span className="font-semibold text-slate-900 dark:text-white text-xs">{opt.name}</span>
      ),
    },
    {
      header: "Ajuste de Precio",
      align: "right",
      render: (opt) => {
        const isPositive = opt.price > 0;
        return isPositive ? (
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md text-xs">
            +{formatCOP(opt.price)}
          </span>
        ) : (
          <span className="font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.04] px-2 py-0.5 rounded-md text-xs">
            $0 COP (Sin recargo)
          </span>
        );
      },
    },
    {
      header: "Estado",
      align: "center",
      render: (opt) => (
        <button
          type="button"
          onClick={() => onToggleOptionStatus(opt)}
          className="cursor-pointer"
          title={opt.status === "active" ? "Pausar opción" : "Activar opción"}
        >
          <Badge
            size="sm"
            variant={opt.status === "active" ? "emerald" : "slate"}
            dot
          >
            {opt.status === "active" ? "Activo" : "Inactivo"}
          </Badge>
        </button>
      ),
    },
    {
      header: "Acciones",
      align: "center",
      className: "w-24",
      render: (opt) => (
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => onEditOption(group.id, group.name, opt)}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
            title="Editar opción"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteOption(opt.id, opt.name)}
            className="p-1 text-slate-400 hover:text-rose-500 rounded-md hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Eliminar opción"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
        {/* Backdrop Canónico */}
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal Container */}
        <div className="relative w-full max-w-3xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ED500A]/10 border border-[#ED500A]/20 flex items-center justify-center text-[#ED500A] shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    {group.name}
                  </h3>
                  {group.commercial_type === "replacement" ? (
                    <Badge variant="blue" size="sm" icon={<ArrowRightLeft className="w-3 h-3" />}>
                      Reemplazo
                    </Badge>
                  ) : group.commercial_type === "size" ? (
                    <Badge variant="slate" size="sm">
                      Tamaño
                    </Badge>
                  ) : (
                    <Badge variant="orange" size="sm" icon={<Tag className="w-3 h-3" />}>
                      Adicional
                    </Badge>
                  )}
                  {isSingleModifier && (
                    <Badge variant="emerald" size="sm" icon={<Sparkles className="w-3 h-3" />}>
                      Individual
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {group.description || "Detalles, reglas de selección y opciones configuradas"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Scrollable */}
          <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
            {/* Banner de conversión si es individual */}
            {isSingleModifier && onConvertToGroup && (
              <div className="p-3.5 bg-orange-500/10 border border-[#ED500A]/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#ED500A] shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                      Este es un modificador individual
                    </h5>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Puedes transformarlo en un grupo con múltiples alternativas conservando los productos asignados.
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onConvertToGroup(group);
                  }}
                  className="shrink-0"
                >
                  Convertir en grupo
                </Button>
              </div>
            )}

            {/* Reglas y Configuración */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Obligatoriedad
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 block">
                  {group.required ? "Obligatorio (Mín 1)" : "Opcional (Mín 0)"}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Tipo Selección
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1 block">
                  {group.selection_type === "single" ? "Única (Radio)" : "Múltiple (Checkboxes)"}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Rango Selección
                </span>
                <span className="text-xs font-semibold font-mono text-slate-800 dark:text-slate-200 mt-1 block">
                  Mín: {group.min_select} · Máx: {group.max_select}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Estado Grupo
                </span>
                <div className="mt-1">
                  <Badge
                    size="sm"
                    variant={group.status === "active" ? "emerald" : "slate"}
                    dot
                  >
                    {group.status === "active" ? "Activo" : "Pausado"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Sección de Opciones */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Opciones configuradas ({group.options.length})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {activeOptionsCount} activas para la venta en mostrador o catálogo
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddOption(group.id, group.name)}
                >
                  <Plus className="w-3.5 h-3.5 text-[#ED500A]" />
                  <span>Añadir opción</span>
                </Button>
              </div>

              <DataTable
                columns={optionColumns}
                data={group.options}
                keyExtractor={(opt) => opt.id}
                emptyState={{
                  title: "Sin opciones configuradas",
                  description: "Este grupo no tiene opciones agregadas aún.",
                  icon: Sparkles,
                  actionLabel: "Añadir primera opción",
                  onAction: () => onAddOption(group.id, group.name),
                }}
              />
            </div>

            {/* Sección de Productos Vinculados */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Productos vinculados ({linkedProducts.length})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Productos del catálogo que ofrecen este modificador
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onEdit(group);
                  }}
                >
                  Gestionar productos →
                </Button>
              </div>

              {linkedProducts.length === 0 ? (
                <div className="p-4 text-center border border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl text-slate-400 text-xs">
                  No está vinculado a ningún producto todavía. Edita el grupo para asignarlo a categorías o productos específicos.
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap max-h-40 overflow-y-auto p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02]">
                  {linkedProducts.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1.5 text-xs pl-2.5 pr-1.5 py-1 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-lg font-medium shadow-2xs"
                    >
                      <Package className="w-3.5 h-3.5 text-[#ED500A]" />
                      <span>{p.name}</span>
                      <button
                        type="button"
                        onClick={() => onUnassignProduct(group.id, p.id, p.name)}
                        className="ml-1 text-slate-400 hover:text-rose-500 rounded cursor-pointer"
                        title={`Desvincular de «${p.name}»`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex-wrap gap-2.5">
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onClose();
                  onDelete(group);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleGroupStatus(group)}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{group.status === "active" ? "Pausar" : "Activar"}</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cerrar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit(group);
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Editar configuración</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

