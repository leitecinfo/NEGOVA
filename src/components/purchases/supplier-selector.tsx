"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Search,
  Check,
  ChevronsUpDown,
  Building2,
  Plus,
  Phone,
  MapPin,
  X,
} from "lucide-react";
import { Supplier } from "@/lib/purchases/types";

interface Props {
  suppliers: Supplier[];
  value: string;
  onChange: (supplierId: string) => void;
  onOpenCreateSupplier: (prefillName?: string) => void;
  disabled?: boolean;
  placeholder?: string;
  error?: string;
}

export function SupplierSelector({
  suppliers,
  value,
  onChange,
  onOpenCreateSupplier,
  disabled = false,
  placeholder = "Buscar o seleccionar proveedor...",
  error,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filtrar solo proveedores activos para nuevas compras
  const activeSuppliers = useMemo(() => {
    return suppliers.filter((s) => s.status !== "inactive" && s.status !== "archived");
  }, [suppliers]);

  // Proveedor seleccionado actualmente
  const selectedSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === value) || null;
  }, [suppliers, value]);

  // Filtrar según el término de búsqueda
  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeSuppliers;
    return activeSuppliers.filter((s) => {
      const matchName = s.name.toLowerCase().includes(q);
      const matchTaxId = s.taxId ? s.taxId.toLowerCase().includes(q) : false;
      const matchContact = s.contactName ? s.contactName.toLowerCase().includes(q) : false;
      const matchPhone = s.phone ? s.phone.toLowerCase().includes(q) : false;
      const matchAddress = s.address ? s.address.toLowerCase().includes(q) : false;
      return matchName || matchTaxId || matchContact || matchPhone || matchAddress;
    });
  }, [activeSuppliers, search]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Foco al input de búsqueda cuando se abre
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Botón Disparador del Selector */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex-1 flex items-center justify-between min-w-0 px-3 py-2 text-xs rounded-xl border bg-background text-foreground transition-all cursor-pointer text-left shadow-xs ${
            isOpen ? "ring-2 ring-primary/20 border-primary" : "border-border hover:border-border/80"
          } ${error ? "border-red-500 focus:ring-red-500" : ""} ${
            disabled ? "opacity-60 cursor-not-allowed" : ""
          }`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Building2 className="w-4 h-4 text-primary shrink-0" />
            {selectedSupplier ? (
              <div className="flex items-baseline gap-2 min-w-0 truncate">
                <span className="font-bold text-foreground truncate">
                  {selectedSupplier.name}
                </span>
                {selectedSupplier.taxId && (
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                    NIT: {selectedSupplier.taxId}
                  </span>
                )}
                {selectedSupplier.phone && (
                  <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">
                    • {selectedSupplier.phone}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground truncate">{placeholder}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {selectedSupplier && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onChange("");
                  }
                }}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                title="Quitar proveedor seleccionado"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        </button>

        {/* Botón contextual rápido para crear proveedor */}
        <button
          type="button"
          onClick={() => onOpenCreateSupplier(search)}
          disabled={disabled}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20 cursor-pointer shrink-0 disabled:opacity-50"
          title="Crear nuevo proveedor"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nuevo</span>
        </button>
      </div>

      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}

      {/* Menú Desplegable con Búsqueda */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Input de Búsqueda */}
          <div className="p-2 border-b border-border bg-muted/30">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, NIT o teléfono..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Lista de Resultados */}
          <div className="max-h-60 overflow-y-auto p-1 text-xs divide-y divide-border/30">
            {filteredSuppliers.length === 0 ? (
              <div className="p-4 text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  {search.trim()
                    ? `No se encontró ningún proveedor activo para «${search}»`
                    : "No hay proveedores activos registrados"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenCreateSupplier(search.trim());
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary/90 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear proveedor {search.trim() ? `«${search.trim()}»` : "nuevo"}</span>
                </button>
              </div>
            ) : (
              filteredSuppliers.map((supplier) => {
                const isSelected = supplier.id === value;
                return (
                  <button
                    key={supplier.id}
                    type="button"
                    onClick={() => handleSelect(supplier.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-primary/10 text-primary font-bold"
                        : "hover:bg-muted/60 text-foreground"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {supplier.name}
                        </span>
                        {supplier.taxId && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                            NIT: {supplier.taxId}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 truncate">
                        {supplier.contactName && (
                          <span className="truncate">Contacto: {supplier.contactName}</span>
                        )}
                        {supplier.phone && (
                          <span className="flex items-center gap-1 shrink-0">
                            <Phone className="w-3 h-3 opacity-70" />
                            {supplier.phone}
                          </span>
                        )}
                        {supplier.address && (
                          <span className="flex items-center gap-1 truncate hidden sm:inline-flex">
                            <MapPin className="w-3 h-3 opacity-70" />
                            {supplier.address}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-primary shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Pie del desplegable: Botón directo para registrar */}
          {filteredSuppliers.length > 0 && (
            <div className="p-2 border-t border-border bg-muted/20 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {filteredSuppliers.length} proveedor{filteredSuppliers.length !== 1 ? "es" : ""}{" "}
                activo{filteredSuppliers.length !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenCreateSupplier(search.trim());
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Crear otro proveedor</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
