import React from "react";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import { DocumentConfigClient } from "./document-config-client";
import { FileText, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function WorkspaceDocumentConfigPage({
  params,
}: {
  params: { businessId: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // TODO: Validar que el usuario pertenece al businessId (Workspace guard)
  
  const config = await getBusinessDocumentConfig(params.businessId);

  return (
    <main className="flex-1 p-6 lg:p-8 bg-slate-50 dark:bg-[#080B10] min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header de la Página */}
        <div className="space-y-1">
          <div className="flex items-center text-sm text-slate-500 dark:text-slate-400 gap-2 mb-2">
            <span>Workspace</span>
            <ChevronRight className="w-4 h-4" />
            <span>Configuración</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-slate-900 dark:text-white font-medium">Documentos</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Documentos Comerciales
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Personaliza cómo se ven tus recibos, cuentas de cobro y ventas.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cliente Interactivo */}
        <DocumentConfigClient businessId={params.businessId} initialConfig={config} />
        
      </div>
    </main>
  );
}
