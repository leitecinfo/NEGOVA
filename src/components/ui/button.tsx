"use client";

import React, { forwardRef } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "success";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  href?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#ED500A] text-white hover:bg-[#D44405] active:bg-[#B83B04] shadow-xs border border-transparent",
  secondary:
    "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/15 active:bg-slate-300 border border-transparent",
  outline:
    "border border-slate-200 dark:border-white/10 bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] active:bg-slate-100",
  ghost:
    "bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] border border-transparent",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-xs border border-transparent",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-xs border border-transparent",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[11px] gap-1.5 rounded-lg font-medium",
  md: "h-10 px-4 text-xs gap-2 rounded-xl font-semibold",
  lg: "h-12 px-5 text-sm gap-2.5 rounded-xl font-bold",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      href,
      children,
      disabled,
      className = "",
      type = "button",
      ...props
    },
    ref
  ) => {
    const baseClasses = `inline-flex items-center justify-center font-body transition-all select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

    if (href && !disabled) {
      return (
        <Link href={href} className={baseClasses}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            leftIcon && <span className="shrink-0 inline-flex items-center">{leftIcon}</span>
          )}
          <span className="inline-flex items-center gap-2">{children}</span>
          {!isLoading && rightIcon && <span className="shrink-0 inline-flex items-center">{rightIcon}</span>}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={baseClasses}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0 inline-flex items-center">{leftIcon}</span>
        )}
        <span className="inline-flex items-center gap-2">{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0 inline-flex items-center">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  href?: string;
  title: string;
}

const iconSizeStyles: Record<ButtonSize, string> = {
  sm: "w-8 h-8 rounded-lg",
  md: "w-10 h-10 rounded-xl",
  lg: "w-12 h-12 rounded-xl",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      variant = "ghost",
      size = "md",
      isLoading = false,
      href,
      title,
      disabled,
      className = "",
      type = "button",
      ...props
    },
    ref
  ) => {
    const baseClasses = `inline-flex items-center justify-center transition-all select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variantStyles[variant]} ${iconSizeStyles[size]} ${className}`;

    if (href && !disabled) {
      return (
        <Link href={href} title={title} aria-label={title} className={baseClasses}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        title={title}
        aria-label={title}
        className={baseClasses}
        {...props}
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";

export interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function ButtonGroup({
  children,
  className = "",
}: ButtonGroupProps) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {children}
    </div>
  );
}

// Aliases para retrocompatibilidad total dentro de imports directos
export const AdminButton = Button;
export const AdminIconButton = IconButton;
export const AdminButtonGroup = ButtonGroup;

export type AdminButtonProps = ButtonProps;
export type AdminIconButtonProps = IconButtonProps;
export type AdminButtonVariant = ButtonVariant;
export type AdminButtonSize = ButtonSize;
