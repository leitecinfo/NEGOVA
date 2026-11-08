"use client";

import React, { useState, useMemo } from "react";
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Edit,
  Power,
  Trash2,
  CheckCircle2,
  X,
  Eye,
  MoreVertical,
  Layers,
  Store,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { Supplier, Purchase } from "@/lib/purchases/types";
import { SupplierFormModal } from "./supplier-form-modal";
import { SupplierDetailModal } from "./supplier-detail-modal";
import { ConfirmToggleStatusModal } from "./confirm-toggle-status-modal";
import { ConfirmDeleteSupplierModal } from "./confirm-delete-supplier-modal";
import Link from "next/link";
import { formatCOP } from "@/config/plans";
import { KpiCard, KpiGrid, SearchInput } from "@/components/ui";

interface Props {
  businessId: string;
  initialSuppliers: Supplier[];
  initialPurchases: Purchase[];
  initialAccountsPayable?: any[];
  products?: any[];
  locations?: any[];
  categories?: any[];
}

type StatusFilter = "all" | "active" | "inactive";

export function WorkspaceProveedoresClient({
  businessId,
  initialSuppliers = [],
  initialPurchases = [],
}: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [purchases, setPurchases] = useState<Purchase[]>(initialPurchases);

  // Estados de búsqueda y filtrado
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Modales
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [supplierForDetail, setSupplierForDetail] = useState<Supplier | null>(null);

  const [isToggleModalOpen, setIsToggleModalOpen] = useState(false);
  const [supplierToToggle, setSupplierToToggle] = useState<Supplier | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // Menú flotante de acciones por fila
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  // =========================================================================
  // INDICADORES REALES (SIN BLOAT NI MÉTRICAS FALSAS)
  // =========================================================================
  const kpis = useMemo(() => {
    const totalCount = suppliers.length;
    const activeCount = suppliers.filter((s) => s.status === "active").length;
    const inactiveCount = suppliers.filter((s) => s.status === "inactive").length;
    const totalPurchasesCount = purchases.filter((p) => p.status !== "cancelled").length;

    return {
      totalCount,
      activeCount,
      inactiveCount,
      totalPurchasesCount,
    };
  }, [suppliers, purchases]);

  // =========================================================================
  // FILTRADO DE PROVEEDORES
  // =========================================================================
  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return suppliers.filter((s) => {
      // 1. Filtro por estado
      if (statusFilter === "active" && s.status !== "active") return false;
      if (statusFilter === "inactive" && s.status !== "inactive") return false;

      // 2. Filtro por búsqueda
      if (!q) return true;
      const matchName = s.name.toLowerCase().includes(q);
      const matchTaxId = s.taxId ? s.taxId.toLowerCase().includes(q) : false;
      const matchPhone = s.phone ? s.phone.toLowerCase().includes(q) : false;
      const matchContact = s.contactName ? s.contactName.toLowerCase().includes(q) : false;
      const matchAddress = s.address ? s.address.toLowerCase().includes(q) : false;

      return matchName || matchTaxId || matchPhone || matchContact || matchAddress;
    });
  }, [suppliers, search, statusFilter]);

  // Handlers
  const handleOpenCreate = () => {
    setSupplierToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setSupplierToEdit(supplier);
    setIsFormModalOpen(true);
  };

  const handleOpenDetail = (supplier: Supplier) => {
    setSupplierForDetail(supplier);
    setIsDetailModalOpen(true);
  };

  const handleOpenToggleStatus = (supplier: Supplier) => {
    setSupplierToToggle(supplier);
    setIsToggleModalOpen(true);
  };

  const handleOpenDelete = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setIsDeleteModalOpen(true);
  };

  const handleFormSuccess = (savedSupplier: Supplier) => {
    setSuppliers((prev) => {
      const idx = prev.findIndex((s) => s.id === savedSupplier.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = savedSupplier;
        return next;
      }
      return [savedSupplier, ...prev];
    });
  };

  const handleStatusToggled = (updatedSupplier: Supplier) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.id === updatedSupplier.id ? updatedSupplier : s))
    );
    if (supplierForDetail && supplierForDetail.id === updatedSupplier.id) {
      setSupplierForDetail(updatedSupplier);
    }
  };

  const handleDeleteSuccess = (deletedId: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== deletedId));
  };

  return (
    <div className="space-y-6">
      {/* 1. BARRA DE ACCIONES SUPERIOR */}
      <div className="flex items-center justify-end gap-2.5 pb-1">
        <Link
          href={`/workspace/${businessId}/compras`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors shadow-2xs"
        >
          <ShoppingCart className="w-3.5 h-3.5 text-[#ED500A]" />
          <span>Ir a Compras</span>
        </Link>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ED500A] text-white font-bold text-xs shadow-md shadow-[#ED500A]/20 hover:bg-[#ED500A]/90 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nuevo proveedor</span>
        </button>
      </div>

      {/* 2. INDICADORES REALES SUPERIORES (NORMALIZADOS) */}
      <KpiGrid cols={4}>
        <KpiCard
          title="Total Proveedores"
          value={kpis.totalCount}
          subtext="Registrados en tu negocio"
          icon={<Building2 className="w-5 h-5" />}
          variant="blue"
        />
        <KpiCard
          title="Proveedores Activos"
          value={kpis.activeCount}
          subtext="Disponibles para compras"
          icon={<CheckCircle2 className="w-5 h-5" />}
          variant="emerald"
        />
        <KpiCard
          title="Inactivos"
          value={kpis.inactiveCount}
          subtext="Pausados temporalmente"
          icon={<Power className="w-5 h-5" />}
          variant="default"
        />
        <KpiCard
          title="Compras Vinculadas"
          value={kpis.totalPurchasesCount}
          subtext="Órdenes en historial"
          icon={<ShoppingCart className="w-5 h-5" />}
          variant="orange"
        />
      </KpiGrid>

      {/* 3. BARRA DE CONTROL (BÚSQUEDA Y FILTRO DE ESTADO) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] shadow-xs">
        {/* Input de Búsqueda Normalizado */}
        <div className="flex-1 max-w-md">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            placeholder="Buscar por nombre, NIT, teléfono o dirección..."
          />
        </div>

        {/* Pestañas de Filtro por Estado */}
        <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border/50 shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos ({suppliers.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "active"
                ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Activos ({kpis.activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("inactive")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "inactive"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Inactivos ({kpis.inactiveCount})
          </button>
        </div>
      </div>

      {/* 4. LISTADO Y ESTADOS */}
      {suppliers.length === 0 ? (
        /* ESTADO VACÍO: Cuando no hay ningún proveedor registrado */
        <div className="p-8 sm:p-12 rounded-2xl border border-dashed border-border bg-card text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mx-auto shadow-xs">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-bold text-foreground">
              Aún no tienes proveedores registrados
            </h3>
            <p className="text-xs text-muted-foreground">
              Registra a tus proveedores para asociar compras, controlar tus insumos y abastecer tu negocio sin complicaciones.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-md hover:bg-primary/90 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar mi primer proveedor</span>
          </button>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        /* ESTADO VACÍO DE BÚSQUEDA / FILTRO */
        <div className="p-8 rounded-2xl border border-border bg-card text-center space-y-3">
          <p className="text-xs font-semibold text-foreground">
            No se encontraron proveedores con los filtros aplicados.
          </p>
          <p className="text-[11px] text-muted-foreground">
            {search ? `Ningún resultado para «${search}».` : "No hay proveedores en este estado."}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-foreground hover:bg-muted font-semibold cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Limpiar filtros</span>
          </button>
        </div>
      ) : (
        /* TABLA DE PROVEEDORES */
        <div className="border border-border rounded-2xl bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-border">
              <thead className="bg-muted/40 font-bold text-muted-foreground text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Proveedor / NIT</th>
                  <th className="px-4 py-3 hidden md:table-cell">Contacto</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Correo / Dirección</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Registro</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredSuppliers.map((supplier) => {
                  const isActive = supplier.status === "active";
                  const formattedDate = supplier.createdAt
                    ? new Date(supplier.createdAt).toLocaleDateString("es-CO", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <tr
                      key={supplier.id}
                      className="hover:bg-muted/20 transition-colors group"
                    >
                      {/* Nombre y NIT */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                              isActive
                                ? "bg-primary/10 text-primary border-primary/20"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {supplier.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-foreground block truncate">
                              {supplier.name}
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground block truncate">
                              {supplier.taxId ? `NIT: ${supplier.taxId}` : "Sin NIT"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contacto */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="text-foreground font-medium block truncate">
                          {supplier.contactName || "—"}
                        </span>
                      </td>

                      {/* Teléfono */}
                      <td className="px-4 py-3.5">
                        {supplier.phone ? (
                          <a
                            href={`tel:${supplier.phone}`}
                            className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
                          >
                            <Phone className="w-3 h-3 opacity-70" />
                            <span>{supplier.phone}</span>
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Correo y Dirección */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <div className="min-w-0 space-y-0.5">
                          {supplier.email && (
                            <a
                              href={`mailto:${supplier.email}`}
                              className="text-muted-foreground hover:text-foreground flex items-center gap-1 truncate"
                            >
                              <Mail className="w-3 h-3 opacity-60 shrink-0" />
                              <span className="truncate">{supplier.email}</span>
                            </a>
                          )}
                          {supplier.address && (
                            <span className="text-muted-foreground flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 opacity-60 shrink-0" />
                              <span className="truncate">{supplier.address}</span>
                            </span>
                          )}
                          {!supplier.email && !supplier.address && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isActive
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? "bg-emerald-500" : "bg-muted-foreground"
                            }`}
                          />
                          <span>{isActive ? "Activo" : "Inactivo"}</span>
                        </span>
                      </td>

                      {/* Fecha de Registro */}
                      <td className="px-4 py-3.5 hidden sm:table-cell text-muted-foreground text-[11px]">
                        {formattedDate}
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(supplier)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Ver ficha y compras"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(supplier)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Editar proveedor"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenToggleStatus(supplier)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isActive
                                ? "text-amber-600 hover:bg-amber-500/10"
                                : "text-emerald-600 hover:bg-emerald-500/10"
                            }`}
                            title={isActive ? "Desactivar proveedor" : "Activar proveedor"}
                          >
                            <Power className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDelete(supplier)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Archivar proveedor"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR PROVEEDOR */}
      <SupplierFormModal
        businessId={businessId}
        isOpen={isFormModalOpen}
        supplier={supplierToEdit}
        onClose={() => {
          setIsFormModalOpen(false);
          setSupplierToEdit(null);
        }}
        onSuccess={handleFormSuccess}
      />

      {/* MODAL DETALLE DE PROVEEDOR */}
      <SupplierDetailModal
        supplier={supplierForDetail}
        purchases={purchases}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSupplierForDetail(null);
        }}
        onEdit={(s) => {
          handleOpenEdit(s);
        }}
        onToggleStatus={(s) => {
          handleOpenToggleStatus(s);
        }}
      />

      {/* MODAL CONFIRMAR ACTIVAR / DESACTIVAR (CERO ALERTAS NATIVAS) */}
      <ConfirmToggleStatusModal
        businessId={businessId}
        isOpen={isToggleModalOpen}
        supplier={supplierToToggle}
        onClose={() => {
          setIsToggleModalOpen(false);
          setSupplierToToggle(null);
        }}
        onSuccess={handleStatusToggled}
      />

      {/* MODAL CONFIRMAR ARCHIVAR PROVEEDOR (CERO ALERTAS NATIVAS) */}
      <ConfirmDeleteSupplierModal
        businessId={businessId}
        isOpen={isDeleteModalOpen}
        supplier={supplierToDelete}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSupplierToDelete(null);
        }}
        onSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
