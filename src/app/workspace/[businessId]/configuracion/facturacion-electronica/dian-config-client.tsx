"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  FileText,
  Building2,
  Calendar,
  KeyRound,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Save,
  ShieldCheck,
  Server,
  Hash,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  DianBillingConfig,
  DianProvider,
  DianEnvironment,
  TaxRegime,
  FiscalResponsibility,
  ElectronicInvoiceRecord,
} from "@/lib/dian/types";
import {
  saveDianBillingConfigAction,
  sendTestInvoiceToDianAction,
} from "./actions";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";

interface DianConfigClientProps {
  initialConfig: DianBillingConfig;
  initialDocuments: ElectronicInvoiceRecord[];
  businessId: string;
}

export function DianConfigClient({
  initialConfig,
  initialDocuments,
  businessId,
}: DianConfigClientProps) {
  const [isPending, startTransition] = useTransition();
  const [isSendingTest, startTestTransition] = useTransition();

  // Estado del Emisor
  const [issuer, setIssuer] = useState(initialConfig.issuer);

  // Estado de Resolución
  const [resolution, setResolution] = useState(initialConfig.resolution);

  // Estado de Proveedor
  const [providerConfig, setProviderConfig] = useState(initialConfig.providerConfig);

  const [activeTab, setActiveTab] = useState<"issuer" | "resolution" | "provider" | "documents">("issuer");
  const [documents, setDocuments] = useState<ElectronicInvoiceRecord[]>(initialDocuments);
  const [lastTestInvoice, setLastTestInvoice] = useState<ElectronicInvoiceRecord | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [copiedCufeId, setCopiedCufeId] = useState<string | null>(null);

  // Guardar configuración general
  const handleSaveConfig = () => {
    startTransition(async () => {
      const res = await saveDianBillingConfigAction(businessId, {
        issuer,
        resolution,
        providerConfig,
        isTestMode: providerConfig.environment === "test",
      });

      if (res.success && res.data) {
        toast.success("Configuración de facturación electrónica DIAN guardada correctamente.");
      } else {
        toast.error(res.error || "No fue posible guardar la configuración DIAN.");
      }
    });
  };

  // Enviar factura de prueba
  const handleSendTestInvoice = () => {
    startTestTransition(async () => {
      const res = await sendTestInvoiceToDianAction(businessId);
      if (res.success && res.invoice) {
        toast.success(res.message || "Factura de prueba validada exitosamente por la DIAN.");
        setLastTestInvoice(res.invoice);
        setDocuments((prev) => [res.invoice!, ...prev]);
        setTestModalOpen(false);
      } else {
        toast.error(res.error || "Error al enviar la factura de prueba.");
      }
    });
  };

  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCufeId(id);
      toast.success("Copiado al portapapeles.");
      setTimeout(() => setCopiedCufeId(null), 2000);
    } catch {
      toast.error("No fue posible copiar al portapapeles.");
    }
  };

  return (
    <div className="space-y-6 font-body">
      {/* 1. BARRA SUPERIOR: RESUMEN DE ESTADO Y ACCIONES PRINCIPALES */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
              Estado Facturación Electrónica:
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {issuer.legalName} ({issuer.nit}-{issuer.dv})
              </span>
              {providerConfig.environment === "test" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  <Clock className="w-3 h-3" /> Modo Habilitación / Pruebas
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" /> Producción en Vivo
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTestModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 text-xs font-semibold shadow-xs transition-colors cursor-pointer active:scale-95"
          >
            <Send className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Enviar Factura de Prueba</span>
          </button>

          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isPending ? "Guardando..." : "Guardar Cambios"}</span>
          </button>
        </div>
      </div>

      {/* 2. ULTIMO DOCUMENTO DE PRUEBA GENERADO (SI EXISTE) */}
      {lastTestInvoice && (
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Factura de Prueba Validada: {lastTestInvoice.documentNumber}
            </span>
            <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
              {lastTestInvoice.dianResponseDescription}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-emerald-200/60 dark:border-emerald-500/20">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="font-mono text-[10px] text-slate-500 shrink-0">CUFE:</span>
              <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate max-w-sm sm:max-w-md">
                {lastTestInvoice.cufe}
              </span>
              <button
                type="button"
                onClick={() => handleCopyText(lastTestInvoice.cufe, "test-cufe")}
                className="p-1 rounded text-slate-500 hover:text-emerald-700 cursor-pointer"
                title="Copiar CUFE"
              >
                {copiedCufeId === "test-cufe" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <Link
              href={lastTestInvoice.qrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
            >
              <span>Verificar en Catálogo DIAN</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* 3. TABS DE CONFIGURACIÓN */}
      <Tabs<"issuer" | "resolution" | "provider" | "documents">
        variant="underline"
        tabs={[
          { id: "issuer", label: "1. Datos del Emisor" },
          { id: "resolution", label: "2. Resolución DIAN y Prefijo" },
          { id: "provider", label: "3. Conexión con Proveedor" },
          { id: "documents", label: "4. Historial de Documentos", count: documents.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: DATOS DEL EMISOR */}
      {activeTab === "issuer" && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              Datos Fiscales del Emisor (Contribuyente)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Información tributaria registrada en el RUT ante la Dirección de Impuestos y Aduanas Nacionales.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                NIT (Sin DV) *
              </label>
              <input
                type="text"
                required
                value={issuer.nit}
                onChange={(e) => setIssuer({ ...issuer, nit: e.target.value.replace(/\D/g, "") })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-mono text-slate-900 dark:text-white"
                placeholder="900123456"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Dígito de Verificación (DV) *
              </label>
              <input
                type="text"
                maxLength={1}
                value={issuer.dv}
                onChange={(e) => setIssuer({ ...issuer, dv: e.target.value.replace(/\D/g, "") })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-mono text-slate-900 dark:text-white"
                placeholder="1"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Razón Social *
              </label>
              <input
                type="text"
                required
                value={issuer.legalName}
                onChange={(e) => setIssuer({ ...issuer, legalName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-medium"
                placeholder="Mi Negocio S.A.S."
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Nombre Comercial
              </label>
              <input
                type="text"
                value={issuer.tradeName}
                onChange={(e) => setIssuer({ ...issuer, tradeName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Correo Electrónico para Facturas *
              </label>
              <input
                type="email"
                required
                value={issuer.email}
                onChange={(e) => setIssuer({ ...issuer, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Teléfono de Contacto
              </label>
              <input
                type="text"
                value={issuer.phone}
                onChange={(e) => setIssuer({ ...issuer, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Régimen Tributario *
              </label>
              <Select
                value={issuer.taxRegime}
                onChange={(e) => setIssuer({ ...issuer, taxRegime: e.target.value as TaxRegime })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="responsable_iva">Responsable de IVA (Régimen Común)</option>
                <option value="no_responsable_iva">No Responsable de IVA (Régimen Simplificado)</option>
                <option value="simple">Régimen Simple de Tributación (RST)</option>
              </Select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Responsabilidad Fiscal *
              </label>
              <Select
                value={issuer.fiscalResponsibility}
                onChange={(e) => setIssuer({ ...issuer, fiscalResponsibility: e.target.value as FiscalResponsibility })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="R-99-PN">R-99-PN (No responsable / Ordinario)</option>
                <option value="O-13">O-13 (Gran Contribuyente)</option>
                <option value="O-15">O-15 (Autorretenedor)</option>
                <option value="O-23">O-23 (Agente de retención IVA)</option>
                <option value="O-47">O-47 (Régimen Simple)</option>
              </Select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Dirección Fiscal *
              </label>
              <input
                type="text"
                value={issuer.address}
                onChange={(e) => setIssuer({ ...issuer, address: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Ciudad / Municipio *
              </label>
              <input
                type="text"
                value={issuer.city}
                onChange={(e) => setIssuer({ ...issuer, city: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Departamento *
              </label>
              <input
                type="text"
                value={issuer.department}
                onChange={(e) => setIssuer({ ...issuer, department: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESOLUCIÓN DIAN */}
      {activeTab === "resolution" && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-500" />
              Resolución y Numeración Autorizada DIAN (Formulario 1876)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Parámetros otorgados por la DIAN para la expedición de facturas electrónicas de venta.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Número de Resolución *
              </label>
              <input
                type="text"
                required
                value={resolution.resolutionNumber}
                onChange={(e) => setResolution({ ...resolution, resolutionNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-mono text-slate-900 dark:text-white"
                placeholder="18764000001"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Prefijo Autorizado *
              </label>
              <input
                type="text"
                required
                value={resolution.prefix}
                onChange={(e) => setResolution({ ...resolution, prefix: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-mono text-slate-900 dark:text-white"
                placeholder="FE"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Consecutivo Actual a Emitir *
              </label>
              <input
                type="number"
                required
                value={resolution.currentNumber}
                onChange={(e) => setResolution({ ...resolution, currentNumber: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-mono text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Rango Inicial (Desde) *
              </label>
              <input
                type="number"
                required
                value={resolution.fromNumber}
                onChange={(e) => setResolution({ ...resolution, fromNumber: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-mono text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Rango Final (Hasta) *
              </label>
              <input
                type="number"
                required
                value={resolution.toNumber}
                onChange={(e) => setResolution({ ...resolution, toNumber: parseInt(e.target.value) || 5000 })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-mono text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Fecha Inicio Vigencia
              </label>
              <input
                type="date"
                value={resolution.validFrom}
                onChange={(e) => setResolution({ ...resolution, validFrom: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-mono text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Fecha Fin Vigencia
              </label>
              <input
                type="date"
                value={resolution.validTo}
                onChange={(e) => setResolution({ ...resolution, validTo: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-mono text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Clave Técnica DIAN *
              </label>
              <input
                type="text"
                required
                value={resolution.technicalKey}
                onChange={(e) => setResolution({ ...resolution, technicalKey: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-mono text-slate-900 dark:text-white text-xs"
                placeholder="fc8eac422eba16e22ffd8c6f94b3f40a6e38162c"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROVEEDOR TECNOLÓGICO */}
      {activeTab === "provider" && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-500" />
              Conexión con Proveedor Tecnológico (DEC-007)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Selecciona y parametriza el motor de emisión de facturación electrónica.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Proveedor de Facturación Electrónica *
              </label>
              <Select
                value={providerConfig.provider}
                onChange={(e) => setProviderConfig({ ...providerConfig, provider: e.target.value as DianProvider })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white cursor-pointer font-semibold"
              >
                <option value="negova_dian">NEGOVA DIAN Core (Motor Integrado Directo) — Recomendado</option>
                <option value="alegra">Alegra (API)</option>
                <option value="siigo">Siigo Nube (API)</option>
                <option value="facturapi">FacturAPI</option>
              </Select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Ambiente de Conexión *
              </label>
              <Select
                value={providerConfig.environment}
                onChange={(e) => setProviderConfig({ ...providerConfig, environment: e.target.value as DianEnvironment })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white cursor-pointer font-semibold"
              >
                <option value="test">Habilitación / Set de Pruebas DIAN (Sandbox)</option>
                <option value="production">Producción en Vivo (Validez Fiscal Oficial)</option>
              </Select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                API Key / Token del Proveedor
              </label>
              <input
                type="password"
                value={providerConfig.apiKey}
                onChange={(e) => setProviderConfig({ ...providerConfig, apiKey: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-mono text-slate-900 dark:text-white"
                placeholder="••••••••••••••••"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                ID de Software DIAN
              </label>
              <input
                type="text"
                value={providerConfig.softwareId || ""}
                onChange={(e) => setProviderConfig({ ...providerConfig, softwareId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-mono text-slate-900 dark:text-white"
                placeholder="software-id-dian-xxxx"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                PIN de Software DIAN
              </label>
              <input
                type="password"
                maxLength={5}
                value={providerConfig.softwarePin || ""}
                onChange={(e) => setProviderConfig({ ...providerConfig, softwarePin: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-mono text-slate-900 dark:text-white"
                placeholder="12345"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                TestSetId (Habilitación)
              </label>
              <input
                type="text"
                value={providerConfig.testSetId || ""}
                onChange={(e) => setProviderConfig({ ...providerConfig, testSetId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 font-mono text-slate-900 dark:text-white"
                placeholder="test-set-id-dian-2026"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Activar Facturación Electrónica en este comercio
                </span>
                <span className="text-[11px] text-slate-400">
                  Habilita la emisión y validación de comprobantes fiscales electrónicos ante la DIAN.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setProviderConfig({ ...providerConfig, isEnabled: !providerConfig.isEnabled })}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  providerConfig.isEnabled ? "bg-blue-600 justify-end" : "bg-slate-300 dark:bg-white/20 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Emitir factura electrónica automáticamente en cada venta
                </span>
                <span className="text-[11px] text-slate-400">
                  Genera el CUFE y transmite a la DIAN de inmediato al cobrar cualquier comanda o ticket.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setProviderConfig({ ...providerConfig, autoSendOnSale: !providerConfig.autoSendOnSale })}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  providerConfig.autoSendOnSale ? "bg-emerald-600 justify-end" : "bg-slate-300 dark:bg-white/20 justify-start"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HISTORIAL DE DOCUMENTOS ELECTRÓNICOS */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              Documentos Electrónicos DIAN ({documents.length})
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              Facturas Electrónicas (FEV) y Notas Crédito (NC)
            </span>
          </div>

          {documents.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-[#0D0F16] border border-dashed border-slate-200 dark:border-white/[0.08] space-y-3">
              <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Aún no hay documentos electrónicos emitidos
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Realiza una venta con factura electrónica o envía una factura de prueba en modo habilitación para iniciar.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06] text-[11px] font-semibold text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Documento</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Total</th>
                      <th className="py-3 px-4">Estado DIAN</th>
                      <th className="py-3 px-4">CUFE / CUDE</th>
                      <th className="py-3 px-4 text-right">Verificación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {doc.documentNumber}
                        </td>
                        <td className="py-3 px-4">
                          {doc.documentType === "credit_note" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600">
                              Nota Crédito (NC)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600">
                              Factura Venta (FEV)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate max-w-[140px]">
                            {doc.customerName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {doc.customerIdentification}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          $ {doc.total.toLocaleString("es-CO")}
                        </td>
                        <td className="py-3 px-4">
                          {doc.status === "accepted" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Aceptada DIAN
                            </span>
                          ) : doc.status === "cancelled" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-600">
                              Anulada por NC
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600">
                              En Proceso
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-slate-500 truncate max-w-[130px]" title={doc.cufe}>
                              {doc.cufe}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(doc.cufe, doc.id)}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                              title="Copiar CUFE"
                            >
                              {copiedCufeId === doc.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={doc.qrUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                          >
                            <span>DIAN</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: CONFIRMACIÓN DE ENVÍO DE FACTURA DE PRUEBA */}
      <ConfirmModal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        onConfirm={handleSendTestInvoice}
        title="Enviar Factura de Prueba a la DIAN"
        description={`Se generará una factura electrónica de prueba en modo Habilitación/Sandbox bajo el prefijo "${resolution.prefix}" con cálculo de CUFE normativo. Esta operación validará la conectividad y parámetros de tu resolución.`}
        confirmText="Sí, enviar prueba"
        cancelText="Cancelar"
        variant="default"
        isLoading={isSendingTest}
      />
    </div>
  );
}
