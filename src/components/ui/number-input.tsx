"use client";

import React, { forwardRef, useState, useEffect, useRef } from "react";
import { Plus, Minus } from "lucide-react";

export type NumberInputSize = "sm" | "md" | "lg";

export interface NumberInputProps {
  id?: string;
  name?: string;
  label?: React.ReactNode;
  helperText?: string;
  error?: string;
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  allowDecimals?: boolean;
  unit?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  size?: NumberInputSize;
  className?: string;
  containerClassName?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
}

const sizeClasses: Record<NumberInputSize, { container: string; input: string; button: string; icon: string }> = {
  sm: {
    container: "h-8 rounded-lg",
    input: "text-xs py-1",
    button: "w-7 h-7 rounded-md",
    icon: "w-3 h-3",
  },
  md: {
    container: "h-10 rounded-xl",
    input: "text-xs py-2",
    button: "w-8 h-8 rounded-lg",
    icon: "w-3.5 h-3.5",
  },
  lg: {
    container: "h-12 rounded-xl",
    input: "text-sm py-2.5",
    button: "w-9 h-9 rounded-lg",
    icon: "w-4 h-4",
  },
};

/**
 * Normaliza un número redondeándolo con precisión decimal exacta para evitar
 * artefactos de coma flotante en JavaScript (ej. 0.1 + 0.2 = 0.30000000000000004).
 */
function roundToPrecision(val: number, precision?: number): number {
  if (precision === undefined) {
    // Si no se especifica, redondeamos a un máximo de 4 decimales
    return Math.round(val * 10000) / 10000;
  }
  const factor = Math.pow(10, precision);
  return Math.round(val * factor) / factor;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      id,
      name,
      label,
      helperText,
      error,
      value,
      onChange,
      min = 0,
      max,
      step = 1,
      precision,
      allowDecimals = true,
      unit,
      disabled = false,
      required = false,
      placeholder = "0",
      size = "md",
      className = "",
      containerClassName = "",
      autoFocus = false,
      onBlur,
    },
    ref
  ) => {
    const inputId = id || (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const sizeConfig = sizeClasses[size];

    // Mantener un estado local de texto para que el usuario pueda tipear libremente
    const [displayString, setDisplayString] = useState<string>(() => {
      if (value === "" || value === null || value === undefined || isNaN(Number(value))) {
        return "";
      }
      return String(value);
    });

    useEffect(() => {
      const numVal = typeof value === "number" ? value : parseFloat(String(value));
      if (!isNaN(numVal)) {
        // Solo actualizar displayString si difiere numéricamente
        const currentDisplayNum = parseFloat(displayString);
        if (currentDisplayNum !== numVal) {
          setDisplayString(String(numVal));
        }
      } else if (value === "" || value === null || value === undefined) {
        setDisplayString("");
      }
    }, [value]);

    const numValue = typeof value === "number" ? value : parseFloat(String(value)) || 0;

    const clamp = (val: number): number => {
      let clamped = val;
      if (min !== undefined && clamped < min) clamped = min;
      if (max !== undefined && clamped > max) clamped = max;
      return roundToPrecision(clamped, precision);
    };

    const handleIncrement = () => {
      if (disabled) return;
      const current = isNaN(numValue) ? (min !== undefined ? min : 0) : numValue;
      const next = clamp(current + step);
      setDisplayString(String(next));
      onChange(next);
    };

    const handleDecrement = () => {
      if (disabled) return;
      const current = isNaN(numValue) ? (min !== undefined ? min : 0) : numValue;
      const next = clamp(current - step);
      setDisplayString(String(next));
      onChange(next);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/,/g, "."); // Permitir coma decimal

      // Validar si es una entrada numérica válida
      if (raw === "" || raw === "-") {
        setDisplayString(raw);
        if (raw === "") onChange(min !== undefined && min > 0 ? min : 0);
        return;
      }

      // Validar caracteres permitidos
      const regex = allowDecimals ? (min !== undefined && min >= 0 ? /^\d*\.?\d*$/ : /^-?\d*\.?\d*$/) : (min !== undefined && min >= 0 ? /^\d*$/ : /^-?\d*$/);
      if (!regex.test(raw)) {
        return;
      }

      setDisplayString(raw);
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        onChange(roundToPrecision(parsed, precision));
      }
    };

    const handleInputBlur = () => {
      let parsed = parseFloat(displayString);
      if (isNaN(parsed)) {
        parsed = min !== undefined ? min : 0;
      } else {
        parsed = clamp(parsed);
      }
      setDisplayString(String(parsed));
      onChange(parsed);
      onBlur?.();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        handleIncrement();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        handleDecrement();
      } else if (e.key === "PageUp") {
        e.preventDefault();
        const next = clamp(numValue + step * 10);
        setDisplayString(String(next));
        onChange(next);
      } else if (e.key === "PageDown") {
        e.preventDefault();
        const next = clamp(numValue - step * 10);
        setDisplayString(String(next));
        onChange(next);
      }
    };

    const canDecrement = !disabled && (min === undefined || numValue > min);
    const canIncrement = !disabled && (max === undefined || numValue < max);

    return (
      <div className={`space-y-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 font-body"
          >
            {label}
            {required && <span className="text-[#ED500A] ml-1">*</span>}
          </label>
        )}

        <div
          className={`relative flex items-center border bg-slate-50/70 dark:bg-[#0B0D14] transition-all ${
            sizeConfig.container
          } ${
            error
              ? "border-red-500 focus-within:ring-2 focus-within:ring-red-500/30 focus-within:border-red-500"
              : "border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 focus-within:ring-2 focus-within:ring-[#ED500A]/30 focus-within:border-[#ED500A]"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
        >
          {/* Botón Decrementar (-) */}
          <button
            type="button"
            tabIndex={-1}
            onClick={handleDecrement}
            disabled={!canDecrement}
            aria-label="Disminuir cantidad"
            className={`inline-flex items-center justify-center shrink-0 ml-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed ${sizeConfig.button}`}
          >
            <Minus className={sizeConfig.icon} />
          </button>

          {/* Campo de texto numérico sin flechas nativas */}
          <input
            ref={ref}
            id={inputId}
            name={name}
            type="text"
            inputMode={allowDecimals ? "decimal" : "numeric"}
            role="spinbutton"
            aria-valuenow={numValue}
            aria-valuemin={min}
            aria-valuemax={max}
            disabled={disabled}
            required={required}
            autoFocus={autoFocus}
            value={displayString}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`w-full text-center font-mono font-bold text-slate-900 dark:text-white bg-transparent outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${sizeConfig.input}`}
          />

          {/* Unidad opcional */}
          {unit && (
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 select-none pr-1 shrink-0">
              {unit}
            </span>
          )}

          {/* Botón Incrementar (+) */}
          <button
            type="button"
            tabIndex={-1}
            onClick={handleIncrement}
            disabled={!canIncrement}
            aria-label="Aumentar cantidad"
            className={`inline-flex items-center justify-center shrink-0 mr-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed ${sizeConfig.button}`}
          >
            <Plus className={sizeConfig.icon} />
          </button>
        </div>

        {error ? (
          <p className="text-[11px] text-red-500 font-medium font-body">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-slate-400 font-body">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

NumberInput.displayName = "NumberInput";

