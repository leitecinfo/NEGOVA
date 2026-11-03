"use client";

import React, { useState, useEffect } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { User, X, Search, Phone, CreditCard, Plus, UserCheck } from "lucide-react";
import { searchCustomersForPosAction } from "@/app/workspace/[businessId]/clientes/actions";

export interface PosCustomerItem {
  id: string | null;
  name: string;
  phone?: string | null;
  documentNumber?: string | null;
}

interface PosSelectCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  selectedCustomerId?: string | null;
  onSelectCustomer: (customer: PosCustomerItem) => void;
  onCreateNewCustomer: () => void;
}

export function PosSelectCustomerModal({
  isOpen,
  onClose,
  businessId,
  selectedCustomerId,
  onSelectCustomer,
  onCreateNewCustomer,
}: PosSelectCustomerModalProps) {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<PosCustomerItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isSubscribed = true;
    setIsSearching(true);
    searchCustomersForPosAction(businessId, query.trim())
      .then((results) => {
        if (!isSubscribed) return;
        const mapped = (results || []).map((r) => ({
          id: r.id,
          name: r.fullName,
          phone: r.phone,
          documentNumber: (r as any).documentNumber || (r as any).document_number || null,
        }));
        setCustomers(mapped);
      })
      .catch(() => {
        if (isSubscribed) setCustomers([]);
      })
      .finally(() => {
        if (isSubscribed) setIsSearching(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, businessId, query]);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-md bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Encabezado */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Seleccionar Cliente
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Asocia la venta a un cliente para historial o crédito.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Buscador */}
          <div className="p-4 border-b border-slate-100 dark:border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre o documento..."
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                autoFocus
              />
            </div>
          </div>

          {/* Lista de selección */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 text-xs">
            {/* Opción A: Cliente General */}
            <button
              type="button"
              onClick={() => {
                onSelectCustomer({
                  id: null,
                  name: "Cliente General",
                });
                onClose();
              }}
              className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                !selectedCustomerId
                  ? "bg-orange-500/10 border-[#ED500A] ring-2 ring-[#ED500A]/20"
                  : "bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.06] hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                    Cliente General
                  </h4>
                  <span className="text-[11px] text-slate-400 block">
                    Sin descuentos especiales
                  </span>
                </div>
              </div>
              {!selectedCustomerId && (
                <UserCheck className="w-4 h-4 text-[#ED500A] shrink-0" />
              )}
            </button>

            {/* Clientes Registrados */}
            {customers.map((c) => {
              const isSelected = selectedCustomerId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelectCustomer(c);
                    onClose();
                  }}
                  className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-orange-500/10 border-[#ED500A] ring-2 ring-[#ED500A]/20"
                      : "bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.06] hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                      {c.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs truncate">
                        {c.name}
                      </h4>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                        {c.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {c.phone}
                          </span>
                        )}
                        {c.documentNumber && (
                          <span className="flex items-center gap-1 font-mono">
                            <CreditCard className="w-3 h-3" />
                            {c.documentNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <UserCheck className="w-4 h-4 text-[#ED500A] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Pie del modal: Crear Nuevo Cliente */}
          <div className="p-4 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
            <button
              type="button"
              onClick={() => {
                onClose();
                onCreateNewCustomer();
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-[#ED500A] text-[#ED500A] hover:bg-orange-500/5 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Crear Nuevo Cliente</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
