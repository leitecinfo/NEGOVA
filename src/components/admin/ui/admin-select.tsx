"use client";

import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

export interface AdminSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface AdminSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  helperText?: string;
  error?: string;
  options?: AdminSelectOption[];
  onChange?: (value: string) => void;
  containerClassName?: string;
  placeholder?: string;
}

export const AdminSelect = forwardRef<HTMLSelectElement, AdminSelectProps>(
  (
    {
      label,
      helperText,
      error,
      options,
      onChange,
      children,
      className = "",
      containerClassName = "",
      id,
      disabled,
      required,
      placeholder,
      value,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (onChange) {
        onChange(e.target.value);
      }
    };

    return (
      <div className={`space-y-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 font-body"
          >
            {label}
            {required && <span className="text-[#ED500A] ml-1">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            required={required}
            value={value}
            onChange={handleChange}
            className={`w-full h-10 pl-3.5 pr-9 rounded-xl border bg-slate-50/50 dark:bg-white/[0.03] text-xs font-semibold font-body text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] transition-all disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer ${
              error
                ? "border-red-500 focus:ring-red-500/30 focus:border-red-500"
                : "border-slate-200 dark:border-white/10"
            } ${className}`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled className="text-slate-400 bg-white dark:bg-[#11131F]">
                {placeholder}
              </option>
            )}
            {options
              ? options.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="text-slate-800 dark:text-slate-200 bg-white dark:bg-[#11131F]"
                  >
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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

AdminSelect.displayName = "AdminSelect";
