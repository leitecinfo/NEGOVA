"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Banknote, Landmark, Wallet, KeyRound, CreditCard } from "lucide-react";
import { PaymentMethodCode } from "@/lib/payments/types";
import { PAYMENT_METHODS_CATALOG } from "@/lib/payments/payment-methods-catalog";

interface PaymentMethodLogoProps {
  code: PaymentMethodCode | string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function PaymentMethodLogo({
  code,
  size = "md",
  className = "",
}: PaymentMethodLogoProps) {
  const [hasError, setHasError] = useState(false);
  const meta = PAYMENT_METHODS_CATALOG[code as PaymentMethodCode];

  const sizeClasses = {
    sm: "w-6 h-6 p-0.5",
    md: "w-9 h-9 p-1",
    lg: "w-12 h-12 p-1.5",
    xl: "w-16 h-16 p-2",
  }[size];

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-5 h-5",
    lg: "w-7 h-7",
    xl: "w-9 h-9",
  }[size];

  // Si es efectivo
  if (code === "cash") {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0 ${sizeClasses} ${className}`}
        aria-label="Efectivo"
        role="img"
      >
        <Banknote className={iconSizes} />
      </div>
    );
  }

  // Si tiene logoPath en catálogo y no ha fallado la carga
  if (meta?.logoPath && !hasError) {
    return (
      <div
        className={`relative flex items-center justify-center rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 shadow-2xs overflow-hidden shrink-0 ${sizeClasses} ${className}`}
        aria-label={meta.name}
        role="img"
      >
        <Image
          src={meta.logoPath}
          alt={`Logo de ${meta.name}`}
          fill
          sizes="(max-width: 768px) 48px, 64px"
          className="object-contain p-1"
          onError={() => setHasError(true)}
          priority={false}
        />
      </div>
    );
  }

  // Fallback visual neutro y accesible (ej. Davivienda o fallo de carga)
  const getFallbackIcon = () => {
    switch (meta?.category) {
      case "bank":
        return <Landmark className={iconSizes} />;
      case "wallet":
        return <Wallet className={iconSizes} />;
      case "key":
        return <KeyRound className={iconSizes} />;
      default:
        return <CreditCard className={iconSizes} />;
    }
  };

  const getFallbackStyle = () => {
    if (code === "davivienda") {
      return "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400";
    }
    return "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300";
  };

  return (
    <div
      className={`flex items-center justify-center rounded-xl border shrink-0 ${getFallbackStyle()} ${sizeClasses} ${className}`}
      aria-label={meta?.name || code}
      title={meta?.name || code}
      role="img"
    >
      {getFallbackIcon()}
    </div>
  );
}
