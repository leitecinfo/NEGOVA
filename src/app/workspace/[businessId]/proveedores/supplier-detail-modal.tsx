"use client";

import React from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  X,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Edit,
  Power,
  ShieldCheck,
  FileText,
  ShoppingCart,
  User,
} from "lucide-react";
import { Supplier, Purchase } from "@/lib/purchases/types";
import { formatCOP } from "@/config/plans";

interface Props {
  supplier: Supplier | null;
  purchases: Purchase[];
  isOpen: boolean;
  onClose: () => void;
  onEdit: (supplier: Supplier) => void;
  onToggleStatus: (supplier: Supplier) => void;
}

export function SupplierDetailModal({
  supplier,
  purchases,
  isOpen,
  onClose,
  onEdit,
  onToggleStatus,
}: Props) {
  if (!isOpen || !supplier) return null;

  const isActive = supplier.status === "active";
  const supplierPurchases = purchases.filter(
    (p) => p.supplierId === supplier.id && p.status !== "cancelled"
  );
  const totalPurchased = supplierPurchases.reduce((acc, p) => acc + p.total, 0);

  const formattedDate = supplier.createdAt
    ? new Date(supplier.createdAt).toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "No registrada";

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl border ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">
                    {supplier.name}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {isActive ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {supplier.taxId ? `NIT / Identificación: ${supplier.taxId}` : "Sin identificación registrada"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cuerpo informativo */}
          <div className="p-6 space-y-6 overflow-y-auto text-xs">
            {/* Fila de Contacto */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Persona de contacto
                </span>
                <p className="text-xs font-semibold text-foreground">
                  {supplier.contactName || "No especificada"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Teléfono
                </span>
                <p className="text-xs font-semibold text-foreground">
                  {supplier.phone ? (
                    <a
                      href={`tel:${supplier.phone}`}
                      className="text-primary hover:underline font-mono"
                    >
                      {supplier.phone}
                    </a>
                  ) : (
                    "No registrado"
                  )}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Correo electrónico
                </span>
                <p className="text-xs font-semibold text-foreground truncate">
                  {supplier.email ? (
                    <a
                      href={`mailto:${supplier.email}`}
                      className="text-primary hover:underline"
                    >
                      {supplier.email}
                    </a>
                  ) : (
                    "No registrado"
                  )}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Ciudad / Dirección
                </span>
                <p className="text-xs font-semibold text-foreground">
                  {supplier.address || "No registrada"}
                </p>
              </div>
            </div>

            {/* Plazo y Fechas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Plazo de crédito comercial
                </span>
                <p className="text-xs font-semibold text-foreground">
                  {supplier.paymentTermsDays && supplier.paymentTermsDays > 0
                    ? `${supplier.paymentTermsDays} días de crédito`
                    : "De contado (0 días)"}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Fecha de registro
                </span>
                <p className="text-xs font-semibold text-foreground">
                  {formattedDate}
                </p>
              </div>
            </div>

            {/* Observaciones */}
            {supplier.notes && (
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Observaciones
                </span>
                <p className="text-xs text-foreground whitespace-pre-wrap">
                  {supplier.notes}
                </p>
              </div>
            )}

            {/* Resumen de Compras Asociadas */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                  <span>Compras históricas con este proveedor</span>
                </h4>
                <span className="text-[11px] font-bold text-primary font-mono">
                  Total: {formatCOP(totalPurchased)} ({supplierPurchases.length} compra
                  {supplierPurchases.length !== 1 ? "s" : ""})
                </span>
              </div>

              {supplierPurchases.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic py-2">
                  No hay compras registradas con este proveedor.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-1.5 border border-border rounded-xl p-2 bg-muted/20">
                  {supplierPurchases.slice(0, 10).map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-card border border-border text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">
                          {purchase.purchaseNumber}
                        </span>
                        {purchase.invoiceNumber && (
                          <span className="text-muted-foreground">
                            Fact: {purchase.invoiceNumber}
                          </span>
                        )}
                        <span className="text-muted-foreground hidden sm:inline">
                          • {new Date(purchase.purchaseDate).toLocaleDateString("es-CO")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">
                          {formatCOP(purchase.total)}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                          {purchase.paymentType === "credit" ? "Crédito" : "Contado"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer con Acciones */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
            <button
              type="button"
              onClick={() => onToggleStatus(supplier)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isActive
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isActive ? "Desactivar proveedor" : "Activar proveedor"}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(supplier);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary/90 transition-all cursor-pointer shadow-xs"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Editar datos</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
