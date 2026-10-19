"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X, Loader2 } from "lucide-react";

export interface SearchSelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SearchSelectProps {
  label?: string;
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
  containerClassName?: string;
  className?: string;
}

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
  containerClassName = "",
  className = "",
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
          {required && <span className="text-[#ED500A] ml-1">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-10 px-3.5 rounded-xl border bg-slate-50/50 dark:bg-white/[0.03] text-xs font-body text-left flex items-center justify-between transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
          error
            ? "border-red-500 focus:ring-red-500/30 focus:border-red-500"
            : isOpen
            ? "border-[#ED500A] ring-2 ring-[#ED500A]/30"
            : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15]"
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
            className={`w-4 h-4 text-slate-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Field */}
          <div className="p-2 border-b border-slate-100 dark:border-white/[0.06]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-xs font-body text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 text-xs">
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
                    className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#ED500A]/10 text-[#ED500A] font-semibold"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                    } ${opt.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div className="truncate">
                        <p className="font-semibold truncate">{opt.label}</p>
                        {opt.description && (
                          <p className="text-[11px] text-slate-400 font-mono truncate">
                            {opt.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-[#ED500A] shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
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
export type AdminSearchSelectOption = SearchSelectOption;
export type AdminSearchSelectProps = SearchSelectProps;
