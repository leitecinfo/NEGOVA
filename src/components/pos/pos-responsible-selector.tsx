"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { User, Search, Check, ChevronDown, Sparkles } from "lucide-react";
import { StaffMember } from "@/lib/restaurant/types";

export function getCargoBadgeColor(role: string): string {
  const r = (role || "").toLowerCase().trim();
  if (r.includes("propietari") || r.includes("dueñ") || r.includes("owner") || r.includes("admin")) {
    return "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/20";
  }
  if (r.includes("cajer") || r.includes("cashier") || r.includes("ventas") || r.includes("vendedor")) {
    return "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20";
  }
  if (r.includes("meser") || r.includes("camarer") || r.includes("waiter") || r.includes("atención")) {
    return "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20";
  }
  if (r.includes("cocin") || r.includes("chef") || r.includes("parrill") || r.includes("barra")) {
    return "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20";
  }
  if (r.includes("domicili") || r.includes("repartid") || r.includes("delivery") || r.includes("moto")) {
    return "bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] dark:text-[#ED500A] border-orange-200 dark:border-orange-500/20";
  }
  return "bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/[0.08]";
}

interface PosResponsibleSelectorProps {
  staffList: StaffMember[];
  selectedStaffId: string | null;
  onSelectStaff: (staff: StaffMember) => void;
  disabled?: boolean;
  serviceType?: "TAKEOUT" | "DINE_IN" | "PICKUP" | "DELIVERY";
}

export function PosResponsibleSelector({
  staffList,
  selectedStaffId,
  onSelectStaff,
  disabled = false,
  serviceType,
}: PosResponsibleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Autoenfoque en el input de búsqueda
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Miembro seleccionado actualmente
  const selectedMember = useMemo(() => {
    if (!selectedStaffId) return staffList[0] || null;
    return staffList.find((s) => s.id === selectedStaffId || s.userId === selectedStaffId) || staffList[0] || null;
  }, [staffList, selectedStaffId]);

  // Lista filtrada por nombre, cargos, email y teléfono, priorizando según servicio
  const filteredStaff = useMemo(() => {
    let list = staffList;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = staffList.filter((s) => {
        const matchName = (s.name || "").toLowerCase().includes(term);
        const matchRole = s.roles.some((r) => (r || "").toLowerCase().includes(term));
        const matchEmail = (s.email || "").toLowerCase().includes(term);
        const matchPhone = (s.phone || "").toLowerCase().includes(term);
        return matchName || matchRole || matchEmail || matchPhone;
      });
    }

    if (serviceType === "DELIVERY") {
      return [...list].sort((a, b) => {
        const aIsDelivery = a.roles.some((r) => {
          const norm = (r || "").toLowerCase();
          return norm.includes("domicili") || norm.includes("repart") || norm.includes("delivery") || norm.includes("moto");
        });
        const bIsDelivery = b.roles.some((r) => {
          const norm = (r || "").toLowerCase();
          return norm.includes("domicili") || norm.includes("repart") || norm.includes("delivery") || norm.includes("moto");
        });
        if (aIsDelivery && !bIsDelivery) return -1;
        if (!aIsDelivery && bIsDelivery) return 1;
        return 0;
      });
    }

    if (serviceType === "DINE_IN") {
      return [...list].sort((a, b) => {
        const aIsWaiter = a.roles.some((r) => {
          const norm = (r || "").toLowerCase();
          return norm.includes("meser") || norm.includes("camarer") || norm.includes("waiter") || norm.includes("atención");
        });
        const bIsWaiter = b.roles.some((r) => {
          const norm = (r || "").toLowerCase();
          return norm.includes("meser") || norm.includes("camarer") || norm.includes("waiter") || norm.includes("atención");
        });
        if (aIsWaiter && !bIsWaiter) return -1;
        if (!aIsWaiter && bIsWaiter) return 1;
        return 0;
      });
    }

    return list;
  }, [staffList, searchTerm, serviceType]);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
          <span>Responsable del pedido</span>
          {serviceType === "DELIVERY" && (
            <span className="text-[10px] normal-case text-[#ED500A] font-semibold bg-[#ED500A]/10 px-1.5 py-0.2 rounded border border-[#ED500A]/20">
              Domicilio
            </span>
          )}
          {serviceType === "DINE_IN" && (
            <span className="text-[10px] normal-case text-blue-600 dark:text-blue-400 font-semibold bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">
              Mesa
            </span>
          )}
        </label>
        {selectedMember && (
          <span className="text-[10px] text-slate-400">
            {selectedMember.isCurrentUser ? "Tú (asignado por defecto)" : "Reasignado"}
          </span>
        )}
      </div>

      {/* DISPARADOR COMPACTO PERSONALIZADO */}
      <button
        type="button"
        disabled={disabled || staffList.length === 0}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
          isOpen
            ? "border-[#ED500A] ring-2 ring-[#ED500A]/20 bg-white dark:bg-[#0D0F16]"
            : "border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] hover:border-slate-300 dark:hover:border-white/[0.15]"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Avatar con iniciales */}
          <div className="w-8 h-8 rounded-xl bg-[#ED500A]/10 text-[#ED500A] font-black text-xs flex items-center justify-center shrink-0 uppercase">
            {selectedMember ? (selectedMember.name || "U").slice(0, 2) : <User className="w-4 h-4" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                {selectedMember ? selectedMember.name : "Seleccionar responsable..."}
              </span>

              {/* Badges de cargos del seleccionado */}
              {selectedMember && selectedMember.roles.length > 0 ? (
                selectedMember.roles.map((role, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${getCargoBadgeColor(
                      role
                    )}`}
                  >
                    {role}
                  </span>
                ))
              ) : null}
            </div>
            <p className="text-[10px] text-slate-400 truncate mt-0.5">
              {selectedMember?.isCurrentUser ? "Tú en sesión" : "Personal asignado"}
              {selectedMember?.email ? ` · ${selectedMember.email}` : ""}
              {!selectedMember?.email && selectedMember?.phone ? ` · ${selectedMember.phone}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          <span className="text-[11px] font-semibold text-[#ED500A] hover:underline hidden sm:inline">
            Cambiar
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180 text-[#ED500A]" : ""}`}
          />
        </div>
      </button>

      {/* DROPDOWN FLOTANTE CON BÚSQUEDA Y LISTA DE PERSONAL */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1.5 p-2 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.12] rounded-2xl shadow-xl space-y-2 animate-in fade-in slide-in-from-top-1 duration-150 max-h-[320px] flex flex-col"
        >
          {/* Campo de Búsqueda */}
          <div className="relative shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, cargo, email o teléfono..."
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#ED500A] focus:border-[#ED500A]"
            />
          </div>

          {/* Listado de Personal */}
          <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.04] flex-1 pr-1">
            {filteredStaff.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No se encontraron personas con ese nombre, cargo o contacto.
              </div>
            ) : (
              filteredStaff.map((member) => {
                const isSelected = selectedMember?.id === member.id;
                const isDeliveryMatch = serviceType === "DELIVERY" && member.roles.some(r => {
                  const norm = (r || "").toLowerCase();
                  return norm.includes("domicili") || norm.includes("repart") || norm.includes("delivery") || norm.includes("moto");
                });
                const isWaiterMatch = serviceType === "DINE_IN" && member.roles.some(r => {
                  const norm = (r || "").toLowerCase();
                  return norm.includes("meser") || norm.includes("camarer") || norm.includes("waiter") || norm.includes("atención");
                });

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      onSelectStaff(member);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                    className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#ED500A]/10 text-slate-900 dark:text-white font-bold"
                        : "hover:bg-slate-50 dark:hover:bg-white/[0.03] text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 uppercase ${
                          isSelected
                            ? "bg-[#ED500A] text-white shadow-xs"
                            : "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {(member.name || "U").slice(0, 2)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold truncate">{member.name}</span>
                          {member.isCurrentUser && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                              Tú
                            </span>
                          )}
                          {(isDeliveryMatch || isWaiterMatch) && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <Sparkles className="w-2.5 h-2.5" />
                              Recomendado
                            </span>
                          )}
                        </div>

                        {/* Contacto distintivo para diferenciar múltiples auxiliares */}
                        {(member.email || member.phone) && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5 font-normal">
                            {member.email}
                            {member.email && member.phone ? " · " : ""}
                            {member.phone ? <span className="font-mono">{member.phone}</span> : null}
                          </p>
                        )}

                        {/* Etiquetas visuales de cargos con colores */}
                        {member.roles && member.roles.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mt-1">
                            {member.roles.map((r, rIdx) => (
                              <span
                                key={rIdx}
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md border ${getCargoBadgeColor(
                                  r
                                )}`}
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#ED500A] text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
