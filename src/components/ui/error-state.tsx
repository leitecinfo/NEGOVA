"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  onSecondaryAction?: () => void;
  className?: string;
  isRetrying?: boolean;
}

export function ErrorState({
  title = "Ocurrió un error al cargar los datos",
  description = "No pudimos completar la operación en este momento. Por favor verifica tu conexión o intenta nuevamente.",
  onRetry,
  retryLabel = "Reintentar operación",
  secondaryActionLabel,
  secondaryActionHref,
  onSecondaryAction,
  className = "",
  isRetrying = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`p-8 rounded-3xl bg-red-50/50 dark:bg-red-950/10 border border-red-200 dark:border-red-500/20 text-center space-y-4 max-w-lg mx-auto my-8 ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
        <AlertTriangle className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-bold text-slate-900 dark:text-white font-title">
          {title}
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-body">
          {description}
        </p>
      </div>

      {(onRetry || secondaryActionLabel) && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              isLoading={isRetrying}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              {retryLabel}
            </Button>
          )}

          {secondaryActionLabel && secondaryActionHref && (
            <Button
              variant="secondary"
              size="sm"
              href={secondaryActionHref}
            >
              {secondaryActionLabel}
            </Button>
          )}

          {secondaryActionLabel && !secondaryActionHref && onSecondaryAction && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Aliases para retrocompatibilidad total
export const AdminErrorState = ErrorState;
export type AdminErrorStateProps = ErrorStateProps;
