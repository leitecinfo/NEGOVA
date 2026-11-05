"use client";

import React from "react";
import { X, Briefcase } from "lucide-react";
import { getCargoBadgeStyles } from "@/lib/auth/cargos-service";

interface CargoBadgeProps {
  cargo: string;
  onRemove?: () => void;
  size?: "sm" | "md";
  className?: string;
}

export function CargoBadge({
  cargo,
  onRemove,
  size = "sm",
  className = "",
}: CargoBadgeProps) {
  const { badgeClass, dotColor } = getCargoBadgeStyles(cargo);

  const isSmall = size === "sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg border transition-colors ${badgeClass} ${
        isSmall ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      <span className="truncate max-w-[130px]">{cargo}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 -mr-0.5 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition cursor-pointer"
          title={`Remover cargo ${cargo}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

