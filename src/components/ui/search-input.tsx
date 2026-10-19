"use client";

import React from "react";
import { Search, X, Loader2 } from "lucide-react";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (e: React.FormEvent) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
  showSubmitButton?: boolean;
  submitButtonLabel?: string;
  onClear?: () => void;
}

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Buscar...",
  className = "",
  disabled = false,
  isLoading = false,
  showSubmitButton = false,
  submitButtonLabel = "Buscar",
  onClear,
}: SearchInputProps) {
  const handleClear = () => {
    onChange("");
    if (onClear) {
      onClear();
    }
  };

  const content = (
    <div className={`relative flex items-center flex-1 ${className}`}>
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#ED500A]" />
        ) : (
          <Search className="w-4 h-4" />
        )}
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full h-10 pl-10 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] text-xs font-body text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all disabled:opacity-50 ${
          showSubmitButton ? "pr-24" : value ? "pr-10" : "pr-3.5"
        }`}
      />

      {value && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-md ${
            showSubmitButton ? "right-16" : "right-3"
          }`}
          title="Limpiar búsqueda"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {showSubmitButton && (
        <button
          type="submit"
          disabled={disabled}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-slate-200/80 dark:bg-white/10 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-white/20 transition-all disabled:opacity-50 cursor-pointer"
        >
          {submitButtonLabel}
        </button>
      )}
    </div>
  );

  if (onSubmit) {
    return (
      <form onSubmit={onSubmit} className="flex-1 flex items-center">
        {content}
      </form>
    );
  }

  return content;
}

// Aliases para retrocompatibilidad total
export const AdminSearchInput = SearchInput;
export type AdminSearchInputProps = SearchInputProps;
