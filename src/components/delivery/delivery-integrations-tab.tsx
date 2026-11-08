"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Play,
  Save,
  ShieldCheck,
  Zap,
  Globe,
  Store,
  Layers,
  ArrowRight,
  Info,
  Building,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  DeliveryProvider,
  DeliveryProviderConfig,
  DeliveryIntegrationsState,
  FinancialComparisonItem,
} from "@/lib/delivery/integration-types";
import {
  calculateFinancialComparison,
  getIntegrationGuideSteps,
  getDefaultProviderConfig,
} from "@/lib/delivery/delivery-integrations-utils";
import {
  getDeliveryIntegrationsAction,
  saveDeliveryIntegrationCredentialsAction,
  simulateDeliveryWebhookAction,
} from "@/app/workspace/[businessId]/pedidos/domicilios/actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface DeliveryIntegrationsTabProps {
  businessId: string;
}

export function DeliveryIntegrationsTab({ businessId }: DeliveryIntegrationsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"evaluation" | "providers">("evaluation");
  const [selectedProvider, setSelectedProvider] = useState<DeliveryProvider>("rappi");
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Integrations state
  const [integrations, setIntegrations] = useState<DeliveryIntegrationsState>({
    rappi: getDefaultProviderConfig(businessId, "rappi"),
    justo: getDefaultProviderConfig(businessId, "justo"),
  });

  // Financial simulation state
  const [sampleTicket, setSampleTicket] = useState<number>(50000);
  const [cogsPercent, setCogsPercent] = useState<number>(35);
  const [financialData, setFinancialData] = useState<FinancialComparisonItem[]>([]);

  // Form state for current selected provider
  const currentConfig: DeliveryProviderConfig = integrations[selectedProvider] || getDefaultProviderConfig(businessId, selectedProvider);
  const [formEnabled, setFormEnabled] = useState(false);
  const [formAutoAccept, setFormAutoAccept] = useState(true);
  const [formEnvironment, setFormEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [formAppId, setFormAppId] = useState("");
  const [formClientSecret, setFormClientSecret] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formStoreId, setFormStoreId] = useState("");
  const [formWebhookSecret, setFormWebhookSecret] = useState("");

  // Sync form when selected provider or state changes
  useEffect(() => {
    const p = integrations[selectedProvider];
    if (p) {
      setFormEnabled(p.enabled);
      setFormAutoAccept(p.autoAcceptOrders);
      setFormEnvironment(p.credentials.environment || "sandbox");
      setFormAppId(p.credentials.appId || "");
      setFormClientSecret(p.credentials.clientSecret || "");
      setFormApiKey(p.credentials.apiKey || "");
      setFormStoreId(p.credentials.storeId || "");
      setFormWebhookSecret(p.credentials.webhookSecret || "");
    }
  }, [selectedProvider, integrations]);

  // Recalculate financial comparison whenever slider/inputs change
  useEffect(() => {
    const data = calculateFinancialComparison(sampleTicket, cogsPercent / 100);
    setFinancialData(data);
  }, [sampleTicket, cogsPercent]);

  // Fetch initial configuration
  const loadConfig = async () => {
    setIsLoading(true);
    const res = await getDeliveryIntegrationsAction(businessId);
    if (res.success && res.data) {
      setIntegrations(res.data);
    } else {
      toast.error(res.error || "No se pudo cargar la configuración de integraciones.");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadConfig();
  }, [businessId]);

  // Copy to clipboard with toast notification
  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(`${label} copiada al portapapeles`);
    }
  };

  // Save credentials handler
  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const credentials =
        selectedProvider === "rappi"
          ? {
              appId: formAppId.trim(),
              clientSecret: formClientSecret.trim(),
              storeId: formStoreId.trim(),
              environment: formEnvironment,
            }
          : {
              apiKey: formApiKey.trim(),
              storeId: formStoreId.trim(),
              webhookSecret: formWebhookSecret.trim(),
              environment: formEnvironment,
            };

      const res = await saveDeliveryIntegrationCredentialsAction(
        businessId,
        selectedProvider,
        credentials,
        formEnabled,
        formAutoAccept
      );

      if (res.success && res.config) {
        toast.success(`Configuración de ${selectedProvider.toUpperCase()} guardada con éxito.`);
        setIntegrations((prev) => ({
          ...prev,
          [selectedProvider]: res.config!,
        }));
      } else {
        toast.error(res.error || "Error al guardar credenciales de integración.");
      }
    });
  };

  // Simulate test order webhook
  const handleSimulateWebhook = () => {
    startTransition(async () => {
      const res = await simulateDeliveryWebhookAction(businessId, selectedProvider);
      if (res.success) {
        toast.success(
          `¡Pedido de prueba #${res.orderNumber} recibido desde ${selectedProvider.toUpperCase()}!`,
          {
            description: "Puedes verlo inmediatamente en la pestaña 'Lista de Pedidos' y despacharlo.",
          }
        );
      } else {
        toast.error(res.error || "No se pudo simular el pedido de prueba.");
      }
    });
  };

  const steps = getIntegrationGuideSteps(selectedProvider);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-[#ED500A] mb-3" />
        <p className="text-sm font-medium">Cargando evaluación e integraciones de delivery...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#0D0F16] p-6 rounded-3xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ED500A]/10 text-[#ED500A] text-xs font-bold mb-2">
            <Zap className="w-3.5 h-3.5" />
            Integraciones & Rentabilidad [DOM-005]
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Canales de Delivery Externo (Rappi & Justo)
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Evalúa el margen de ganancia real frente a agregadores, configura credenciales de conexión por API/Webhook e ingesta pedidos directamente a tu pantalla de despacho.
          </p>
        </div>

        {/* NAVEGACIÓN SUB-PESTAÑAS */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200/60 dark:border-white/5">
          <button
            type="button"
            onClick={() => setActiveSubTab("evaluation")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === "evaluation"
                ? "bg-white dark:bg-[#0D0F16] text-[#ED500A] shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Evaluación Financiera
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("providers")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === "providers"
                ? "bg-white dark:bg-[#0D0F16] text-[#ED500A] shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Layers className="w-4 h-4" />
            Configurar Conexión
          </button>
        </div>
      </div>

      {/* SECCIÓN 1: EVALUACIÓN FINANCIERA & CALCULADORA */}
      {activeSubTab === "evaluation" && (
        <div className="space-y-6">
          {/* SIMULADOR DE TICKET Y COSTO */}
          <div className="bg-white dark:bg-[#0D0F16] p-6 rounded-3xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#ED500A]" />
              Simulador Dinámico de Rentabilidad por Canal
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  <span>Ticket Promedio por Pedido:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ${sampleTicket.toLocaleString("es-CO")} COP
                  </span>
                </div>
                <input
                  type="range"
                  min="15000"
                  max="150000"
                  step="5000"
                  value={sampleTicket}
                  onChange={(e) => setSampleTicket(Number(e.target.value))}
                  className="w-full accent-[#ED500A] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>$15.000 COP</span>
                  <span>$75.000 COP</span>
                  <span>$150.000 COP</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  <span>Costo de Materia Prima / Ingredientes (COGS):</span>
                  <span className="font-bold text-slate-900 dark:text-white">{cogsPercent}% del ticket</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="50"
                  step="1"
                  value={cogsPercent}
                  onChange={(e) => setCogsPercent(Number(e.target.value))}
                  className="w-full accent-[#ED500A] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>20% (Alta rentabilidad)</span>
                  <span>35% (Estándar gastronómico)</span>
                  <span>50% (Costo elevado)</span>
                </div>
              </div>
            </div>

            {/* COMPARADOR EN 3 COLUMNAS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {financialData.map((item) => {
                const isDirect = item.channel === "negova_direct";
                const isRappi = item.channel === "rappi";

                return (
                  <div
                    key={item.channel}
                    className={`p-5 rounded-2xl border transition-all ${
                      isDirect
                        ? "bg-emerald-500/[0.04] border-emerald-500/30 dark:border-emerald-500/20"
                        : isRappi
                        ? "bg-red-500/[0.03] border-red-500/20"
                        : "bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isDirect
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : isRappi
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {item.badge}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {item.commissionRate === 0
                          ? "0% Comisión"
                          : `${item.commissionRate * 100}% + IVA`}
                      </span>
                    </div>

                    <h4 className="text-base font-black text-slate-900 dark:text-white mb-4">
                      {item.label}
                    </h4>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>Venta Bruta:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          ${item.sampleTicket.toLocaleString("es-CO")}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Costo Ingredientes:</span>
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                          -${item.cogsAmount.toLocaleString("es-CO")}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Comisión de Plataforma:</span>
                        <span
                          className={`font-semibold ${
                            item.commissionAmount > 0
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {item.commissionAmount > 0
                            ? `-$${item.commissionAmount.toLocaleString("es-CO")}`
                            : "$0"}
                        </span>
                      </div>
                      {item.commissionVat > 0 && (
                        <div className="flex justify-between text-slate-500">
                          <span>IVA sobre comisión (19%):</span>
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            -${item.commissionVat.toLocaleString("es-CO")}
                          </span>
                        </div>
                      )}

                      <div className="pt-3 border-t border-slate-200 dark:border-white/[0.08] flex justify-between items-baseline">
                        <span className="font-bold text-slate-900 dark:text-white">Ganancia Neta:</span>
                        <span
                          className={`text-lg font-black ${
                            isDirect
                              ? "text-emerald-600 dark:text-emerald-400"
                              : isRappi
                              ? "text-slate-800 dark:text-slate-100"
                              : "text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          ${item.netProfit.toLocaleString("es-CO")}
                        </span>
                      </div>

                      <div className="flex justify-between text-xs font-semibold pt-1">
                        <span className="text-slate-500">Margen Neto:</span>
                        <span
                          className={`${
                            item.netMarginPercent >= 55
                              ? "text-emerald-600 dark:text-emerald-400"
                              : item.netMarginPercent >= 45
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {item.netMarginPercent}%
                        </span>
                      </div>

                      {/* DETALLES DE RETENCIÓN DE CLIENTES */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 space-y-1.5 text-[11px]">
                        <div>
                          <span className="text-slate-400">Datos de clientes: </span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {item.customerDataOwnership}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Liquidación fondos: </span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {item.settlementDays}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MATRIZ ESTRATÉGICA RECOMENDADA */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl relative overflow-hidden">
            <div className="max-w-2xl relative z-10">
              <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md bg-[#ED500A] text-white">
                Recomendación de Arquitectura [DEC-007 Resuelta]
              </span>
              <h3 className="text-lg font-black mt-3 mb-2">
                Estrategia Híbrida: Canal Directo Primero + Agregadores Centralizados
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Utiliza <strong>NEGOVA Domicilios Directos (0% comisión)</strong> con tu menú QR y WhatsApp para fidelizar a tus clientes habituales y maximizar el margen por pedido. Activa las integraciones de <strong>Rappi o Justo</strong> como canales complementarios de adquisición de clientes nuevos, recibiendo todos los pedidos en una única pantalla de comandas de NEGOVA.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 2: CONFIGURACIÓN DE CONEXIÓN */}
      {activeSubTab === "providers" && (
        <div className="space-y-6">
          {/* SELECTOR DE PROVEEDOR */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedProvider("rappi")}
              className={`flex-1 p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                selectedProvider === "rappi"
                  ? "bg-white dark:bg-[#0D0F16] border-[#ED500A] shadow-md ring-2 ring-[#ED500A]/10"
                  : "bg-white/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-black text-sm text-slate-900 dark:text-white">Rappi Partners</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    integrations.rappi.status === "active"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : integrations.rappi.status === "testing"
                      ? "bg-amber-500/10 text-amber-600"
                      : "bg-slate-100 dark:bg-white/5 text-slate-500"
                  }`}
                >
                  {integrations.rappi.status === "active"
                    ? "En Producción"
                    : integrations.rappi.status === "testing"
                    ? "Modo Pruebas"
                    : "No configurado"}
                </span>
              </div>
              <p className="text-xs text-slate-500">API OAuth 2.0 & Webhooks con autenticación HMAC</p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedProvider("justo")}
              className={`flex-1 p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                selectedProvider === "justo"
                  ? "bg-white dark:bg-[#0D0F16] border-[#ED500A] shadow-md ring-2 ring-[#ED500A]/10"
                  : "bg-white/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-black text-sm text-slate-900 dark:text-white">Justo DTC</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    integrations.justo.status === "active"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : integrations.justo.status === "testing"
                      ? "bg-amber-500/10 text-amber-600"
                      : "bg-slate-100 dark:bg-white/5 text-slate-500"
                  }`}
                >
                  {integrations.justo.status === "active"
                    ? "En Producción"
                    : integrations.justo.status === "testing"
                    ? "Modo Pruebas"
                    : "No configurado"}
                </span>
              </div>
              <p className="text-xs text-slate-500">API Key directa & Webhooks de tienda virtual</p>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* FORMULARIO DE CREDENCIALES & AJUSTES */}
            <div className="lg:col-span-2 bg-white dark:bg-[#0D0F16] p-6 rounded-3xl border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Credenciales de {selectedProvider === "rappi" ? "Rappi Partners" : "Justo"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Establece la conexión para sincronizar órdenes automáticamente.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Habilitar:
                  </label>
                  <input
                    type="checkbox"
                    checked={formEnabled}
                    onChange={(e) => setFormEnabled(e.target.checked)}
                    className="w-4 h-4 text-[#ED500A] accent-[#ED500A] rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* URL DE WEBHOOK DE NEGOVA */}
              <div className="bg-slate-50 dark:bg-white/[0.02] p-4 rounded-2xl border border-slate-200 dark:border-white/[0.08]">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#ED500A]" />
                    URL de Webhook para registrar en {selectedProvider.toUpperCase()}:
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopy(currentConfig.webhookUrl, "URL de Webhook")}
                    className="text-xs text-[#ED500A] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    Copiar
                  </button>
                </div>
                <div className="font-mono text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-[#0D0F16] p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] break-all select-all">
                  {currentConfig.webhookUrl}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Ingresa esta URL en la configuración de webhooks de tu panel de {selectedProvider.toUpperCase()} para recibir notificaciones automáticas cuando un cliente compre.
                </p>
              </div>

              {/* FORMULARIO */}
              <form onSubmit={handleSaveCredentials} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Select
                      label="Entorno de Ejecución"
                      value={formEnvironment}
                      onChange={(e) => setFormEnvironment(e.target.value as any)}
                    >
                      <option value="sandbox">Sandbox / Modo Pruebas</option>
                      <option value="production">Producción (En Vivo)</option>
                    </Select>
                  </div>

                  <Input
                      label="Store ID (Identificador de Sucursal)"
                      placeholder="Ej: STORE-BOG-01"
                      value={formStoreId}
                      onChange={(e) => setFormStoreId(e.target.value)}
                    />
                </div>

                {selectedProvider === "rappi" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Client ID / App ID"
                        placeholder="ID de aplicación provisto por Rappi"
                        value={formAppId}
                        onChange={(e) => setFormAppId(e.target.value)}
                        className="font-mono"
                      />
                    <Input
                        label="Client Secret"
                        type="password"
                        placeholder="••••••••••••••••••••••••"
                        value={formClientSecret}
                        onChange={(e) => setFormClientSecret(e.target.value)}
                        className="font-mono"
                      />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="API Key de Justo"
                        type="password"
                        placeholder="jst_live_••••••••••••••••"
                        value={formApiKey}
                        onChange={(e) => setFormApiKey(e.target.value)}
                        className="font-mono"
                      />
                    <Input
                        label="Webhook Secret (Opcional)"
                        type="password"
                        placeholder="Clave de firma para validar webhook"
                        value={formWebhookSecret}
                        onChange={(e) => setFormWebhookSecret(e.target.value)}
                        className="font-mono"
                      />
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <label className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAutoAccept}
                      onChange={(e) => setFormAutoAccept(e.target.checked)}
                      className="w-4 h-4 text-[#ED500A] accent-[#ED500A] rounded"
                    />
                    Aceptar automáticamente pedidos entrantes y enviarlos a cocina
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                  <button
                    type="button"
                    onClick={handleSimulateWebhook}
                    disabled={isPending}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#ED500A]/30 text-[#ED500A] hover:bg-[#ED500A]/10 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Simular Pedido de Prueba
                  </button>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#ED500A]/90 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {isPending ? "Guardando..." : "Guardar Credenciales"}
                  </button>
                </div>
              </form>
            </div>

            {/* GUÍA PASO A PASO */}
            <div className="bg-white dark:bg-[#0D0F16] p-6 rounded-3xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#ED500A]" />
                Guía de Integración Paso a Paso
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Sigue estos pasos para conectar tu cuenta de {selectedProvider.toUpperCase()}:
              </p>

              <div className="space-y-4">
                {steps.map((st, index) => (
                  <div key={st.id} className="flex gap-3 text-xs">
                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[11px] shrink-0 border border-slate-200 dark:border-white/10">
                      {index + 1}
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{st.title}</div>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                        {st.description}
                      </p>
                      {st.docLink && (
                        <a
                          href={st.docLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#ED500A] font-semibold hover:underline mt-1"
                        >
                          Documentación oficial
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
