"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";

export type SearchInputSize = "sm" | "md" | "lg";

export interface SearchInputProps {
  value: string;
  onChange?: (e: any) => void;
  onValueChange?: (value: string) => void;
  onSubmit?: (e: React.FormEvent) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
  showSubmitButton?: boolean;
  submitButtonLabel?: string;
  onClear?: () => void;
  debounceMs?: number;
  inputSize?: SearchInputSize;
  endAdornment?: React.ReactNode;
}

const sizeClasses: Record<SearchInputSize, string> = {
  sm: "h-8 text-[11px] rounded-lg",
  md: "h-10 text-xs rounded-xl",
  lg: "h-12 text-sm rounded-xl",
};

export function SearchInput({
  value,
  onChange,
  onValueChange,
  onSubmit,
  placeholder = "Buscar...",
  className = "",
  disabled = false,
  isLoading = false,
  showSubmitButton = false,
  submitButtonLabel = "Buscar",
  onClear,
  debounceMs,
  inputSize = "md",
  endAdornment,
}: SearchInputProps) {
  // Manejo de estado local cuando debounceMs está presente
  const [internalValue, setInternalValue] = useState(value);
  const isFirstMount = useRef(true);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const triggerChange = (val: string, originalEvent?: React.ChangeEvent<HTMLInputElement>) => {
    if (onValueChange) {
      onValueChange(val);
    }
    if (onChange) {
      try {
        const fnStr = onChange.toString();
        if (fnStr.includes(".target")) {
          onChange(originalEvent || { target: { value: val } });
        } else {
          onChange(val);
        }
      } catch {
        onChange(originalEvent || { target: { value: val } });
      }
    }
  };

  useEffect(() => {
    if (debounceMs === undefined || debounceMs <= 0) return;
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    const handler = setTimeout(() => {
      triggerChange(internalValue);
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [internalValue, debounceMs]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    if (debounceMs !== undefined && debounceMs > 0) {
      setInternalValue(nextVal);
    } else {
      triggerChange(nextVal, e);
    }
  };

  const handleClear = () => {
    setInternalValue("");
    triggerChange("");
    if (onClear) {
      onClear();
    }
  };

  const currentDisplayValue = debounceMs && debounceMs > 0 ? internalValue : value;

  const content = (
    <div className={`relative flex items-center flex-1 ${className}`}>
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#ED500A]" />
        ) : (
          <Search className="w-4 h-4" />
        )}
      </div>

      <input
        type="text"
        value={currentDisplayValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full pl-10 border bg-slate-50/70 dark:bg-[#0B0D14] border-slate-200/80 dark:border-white/10 font-body text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 hover:border-slate-300 dark:hover:border-white/20 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all disabled:opacity-50 ${
          sizeClasses[inputSize]
        } ${
          showSubmitButton
            ? "pr-24"
            : endAdornment && currentDisplayValue
            ? "pr-16"
            : endAdornment || currentDisplayValue
            ? "pr-10"
            : "pr-3.5"
        }`}
      />

      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {currentDisplayValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-md"
            title="Limpiar búsqueda"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {endAdornment}
      </div>

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
