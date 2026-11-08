"use client";

import React, { forwardRef } from "react";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  containerClassName?: string;
  inputSize?: InputSize;
}

const sizeClasses: Record<InputSize, string> = {
  sm: "h-8 text-[11px] rounded-lg",
  md: "h-10 text-xs rounded-xl",
  lg: "h-12 text-sm rounded-xl",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightElement,
      startAdornment,
      endAdornment,
      className = "",
      containerClassName = "",
      inputSize = "md",
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const inputId = id || (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const hasLeft = Boolean(leftIcon || startAdornment);
    const hasRight = Boolean(rightElement || endAdornment);

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
          {hasLeft && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center justify-center">
              {leftIcon || startAdornment}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            className={`w-full border bg-slate-50/70 dark:bg-[#0B0D14] font-body text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] hover:border-slate-300 dark:hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
              sizeClasses[inputSize]
            } ${hasLeft ? "pl-10" : "pl-3.5"} ${hasRight ? "pr-10" : "pr-3.5"} ${
              error
                ? "border-red-500 focus:ring-red-500/30 focus:border-red-500"
                : "border-slate-200/80 dark:border-white/10"
            } ${className}`}
            {...props}
          />

          {hasRight && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
              {rightElement || endAdornment}
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
