"use client";

import React, { forwardRef } from "react";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  helperText?: string;
  error?: string;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      helperText,
      error,
      className = "",
      containerClassName = "",
      id,
      disabled,
      required,
      rows = 3,
      ...props
    },
    ref
  ) => {
    const textareaId = id || (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className={`space-y-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 font-body"
          >
            {label}
            {required && <span className="text-[#ED500A] ml-1">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          required={required}
          rows={rows}
          className={`w-full p-3 border bg-slate-50/70 dark:bg-[#0B0D14] font-body text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] hover:border-slate-300 dark:hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed resize-none ${
            error
              ? "border-red-500 focus:ring-red-500/30 focus:border-red-500"
              : "border-slate-200/80 dark:border-white/10"
          } ${className}`}
          {...props}
        />

        {error ? (
          <p className="text-[11px] text-red-500 font-medium font-body">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-slate-400 font-body">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

