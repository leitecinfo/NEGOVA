"use client";

import React, { forwardRef } from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightElement,
      className = "",
      containerClassName = "",
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

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

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            className={`w-full h-10 rounded-xl border bg-slate-50/50 dark:bg-white/[0.03] text-xs font-body text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              leftIcon ? "pl-10" : "pl-3.5"
            } ${rightElement ? "pr-10" : "pr-3.5"} ${
              error
                ? "border-red-500 focus:ring-red-500/30 focus:border-red-500"
                : "border-slate-200 dark:border-white/10"
            } ${className}`}
            {...props}
          />

          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
              {rightElement}
            </div>
          )}
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

Input.displayName = "Input";

// Aliases para retrocompatibilidad total
export const AdminInput = Input;
export type AdminInputProps = InputProps;
