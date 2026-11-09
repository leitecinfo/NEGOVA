"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Search, ChevronDown, Check, X, Loader2 } from "lucide-react";

export type SearchSelectSize = "sm" | "md" | "lg";

export interface SearchSelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SearchSelectProps {
  label?: React.ReactNode;
  helperText?: string;
  error?: string;
  options: SearchSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  required?: boolean;
  isLoading?: boolean;
  clearable?: boolean;
  searchable?: boolean;
  containerClassName?: string;
  className?: string;
  selectSize?: SearchSelectSize;
}

const sizeClasses: Record<SearchSelectSize, string> = {
  sm: "h-8 text-[11px] rounded-lg",
  md: "h-10 text-xs rounded-xl",
  lg: "h-12 text-sm rounded-xl",
};

export function SearchSelect({
  label,
  helperText,
  error,
  options,
  value,
  onChange,
  placeholder = "Seleccionar opción...",
  searchPlaceholder = "Buscar en la lista...",
  emptyText = "No se encontraron resultados",
  disabled = false,
  required = false,
  isLoading = false,
  clearable = true,
  searchable = true,
  containerClassName = "",
  className = "",
  selectSize = "md",
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight?: number;
  }>({
    left: 0,
    width: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value) || null;
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [options, search]);

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const minWidth = Math.max(rect.width, 240);

    // 1. Alineación horizontal
    let left = rect.left;
    if (left + minWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - minWidth - 12);
    }

    // 2. Alineación vertical (detectar si cabe abajo o abrir arriba pegado al botón)
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedHeight = Math.min(280, (options.length || 1) * 38 + (searchable ? 50 : 16));

    // Si no cabe abajo pero sí cabe arriba, abrir hacia arriba pegado justo encima del botón
    const openUpwards = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    if (openUpwards) {
      setCoords({
        bottom: window.innerHeight - rect.top + 6,
        left,
        width: minWidth,
        maxHeight: Math.min(280, Math.max(120, spaceAbove - 16)),
      });
    } else {
      setCoords({
        top: rect.bottom + 6,
        left,
        width: minWidth,
        maxHeight: Math.min(280, Math.max(120, spaceBelow - 16)),
      });
    }
  }, [options.length, searchable]);

  // Actualizar coordenadas dinámicas al abrir, redimensionar o hacer scroll
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
  };

  return (
    <div ref={containerRef} className={`space-y-1.5 relative ${containerClassName}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 font-body">
          {label}
          {required && typeof label === "string" && <span className="text-[#ED500A] ml-1">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3.5 border bg-slate-50/70 dark:bg-[#0B0D14] font-body text-left flex items-center justify-between transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
          sizeClasses[selectSize]
        } ${
          error
            ? "border-red-500 focus:ring-red-500/30 focus:border-red-500"
            : isOpen
            ? "border-[#ED500A] ring-2 ring-[#ED500A]/30"
            : "border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
        } ${className}`}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
          ) : selectedOption?.icon ? (
            <span className="shrink-0">{selectedOption.icon}</span>
          ) : null}

          {selectedOption ? (
            <span className="font-semibold text-slate-900 dark:text-white truncate">
              {selectedOption.label}
            </span>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {clearable && selectedOption && !disabled && (
            <span
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors"
              title="Limpiar selección"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Popover renderizado en Portal para evitar overflow clipping y problemas de z-index */}
      {isOpen && mounted && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            ...(coords.bottom !== undefined ? { bottom: `${coords.bottom}px` } : { top: `${coords.top ?? 0}px` }),
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxHeight: coords.maxHeight ? `${coords.maxHeight}px` : undefined,
            zIndex: 99999,
          }}
          className="rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Search Field */}
          {searchable && (
            <div className="p-2 border-b border-slate-100 dark:border-white/[0.06] shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#0B0D14] border border-transparent dark:border-white/10 text-xs font-body text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:border-[#ED500A]"
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div
            style={{ maxHeight: coords.maxHeight ? `${coords.maxHeight - (searchable ? 54 : 12)}px` : undefined }}
            className="overflow-y-auto p-1.5 space-y-0.5 text-xs flex-1 custom-scrollbar"
          >
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isSelected
                        ? "bg-[#ED500A]/10 text-[#ED500A] font-semibold"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div>
                        <p className="truncate font-body">{opt.label}</p>
                        {opt.description && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-body">
                            {opt.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[#ED500A] shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}

      {error ? (
        <p className="text-[11px] text-red-500 font-medium font-body">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-400 font-body">{helperText}</p>
      ) : null}
    </div>
  );
}

// Aliases para retrocompatibilidad total
export const AdminSearchSelect = SearchSelect;
export type AdminSearchSelectProps = SearchSelectProps;
export type AdminSearchSelectOption = SearchSelectOption;
