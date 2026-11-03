"use client";

import React, { useEffect } from "react";
import { useParams } from "next/navigation";
import { ErrorState } from "@/components/ui/error-state";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const businessId = params?.businessId as string | undefined;

  useEffect(() => {
    // Registrar error para monitoreo técnico sin bloquear la interfaz
    console.error("[Workspace Navigation/Module Error]:", error);
  }, [error]);

  return (
    <div className="w-full max-w-2xl mx-auto p-4 sm:p-8 my-12 animate-in fade-in-50 duration-200">
      <ErrorState
        title="No fue posible cargar este módulo"
        description={
          error.message && !error.message.includes("digest")
            ? error.message
            : "Ocurrió un problema al recuperar la información. Puedes reintentar la acción o volver al inicio del espacio de trabajo."
        }
        onRetry={() => reset()}
        retryLabel="Reintentar carga"
        secondaryActionLabel={businessId ? "Ir al Inicio" : undefined}
        secondaryActionHref={businessId ? `/workspace/${businessId}` : undefined}
      />
    </div>
  );
}
