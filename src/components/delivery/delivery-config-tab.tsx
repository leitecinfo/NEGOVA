"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  SlidersHorizontal,
  DollarSign,
  Users,
  Clock,
  Award,
  CheckCircle2,
  AlertCircle,
  Save,
  HelpCircle,
  Truck,
  RotateCcw,
  Sparkles,
  Zap,
  Moon,
  ShieldCheck,
  MapPin,
  Compass,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  DeliveryBusinessConfig,
  DEFAULT_DELIVERY_BUSINESS_CONFIG,
  DeliveryTariffMode,
  DeliveryPayer,
  DeliveryAssignmentMode,
} from "@/lib/delivery/types";
import {
  getDeliveryConfigAction,
  updateDeliveryConfigAction,
} from "@/app/workspace/[businessId]/pedidos/domicilios/actions";

interface DeliveryConfigTabProps {
  businessId: string;
  initialConfig?: DeliveryBusinessConfig;
}

export function DeliveryConfigTab({ businessId, initialConfig }: DeliveryConfigTabProps) {
  const [config, setConfig] = useState<DeliveryBusinessConfig>(
    initialConfig || DEFAULT_DELIVERY_BUSINESS_CONFIG
  );
  const [isLoading, setIsLoading] = useState(!initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [, startTransition] = useTransition();

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Cargar configuración si no vino provista inicialmente
  useEffect(() => {
    if (!initialConfig && businessId) {
      let isMounted = true;
      setIsLoading(true);
      getDeliveryConfigAction(businessId)
        .then((res: any) => {
          if (isMounted && res.success && res.config) {
            setConfig(res.config);
          }
        })
        .catch((err: any) => {
          console.error("Error al cargar configuración:", err);
          toast.error("No se pudo cargar la configuración de domicilios.");
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [businessId, initialConfig]);

  const handleChange = <K extends keyof DeliveryBusinessConfig>(
    key: K,
    value: DeliveryBusinessConfig[K]
  ) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
    setHasUnsavedChanges(true);
  };

  const handleTimingChange = (field: keyof DeliveryBusinessConfig["timing"], value: any) => {
    setConfig((prev) => ({
      ...prev,
      timing: {
        ...prev.timing,
        [field]: value,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleBonusesChange = (field: keyof DeliveryBusinessConfig["bonuses"], value: any) => {
    setConfig((prev) => ({
      ...prev,
      bonuses: {
        ...prev.bonuses,
        [field]: value,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleDistanceConfigChange = (
    field: keyof DeliveryBusinessConfig["distanceConfig"],
    value: number
  ) => {
    setConfig((prev) => ({
      ...prev,
      distanceConfig: {
        ...prev.distanceConfig,
        [field]: value,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const res = await updateDeliveryConfigAction(businessId, config);
      if (res.success && res.config) {
        setConfig(res.config);
        setHasUnsavedChanges(false);
        toast.success("Configuración de domicilios guardada exitosamente.");
      } else {
        toast.error(res.error || "No se pudo guardar la configuración.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar la configuración.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    setConfig({
      ...DEFAULT_DELIVERY_BUSINESS_CONFIG,
      updatedAt: new Date().toISOString(),
    });
    setHasUnsavedChanges(true);
    toast.info("Valores restablecidos a predeterminados. Presiona Guardar para confirmar.");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-8 h-8 border-3 border-[#ED500A] border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs text-slate-500 font-medium">
          Cargando configuración de domicilios...
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* BANNER SUPERIOR CON ESTADO Y ACCIONES */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#ED500A] shrink-0">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Reglas y Tarifas de Domicilios
              </h2>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  config.enabled
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {config.enabled ? "Servicio Activo" : "Servicio Pausado"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Configura cómo se calculan las tarifas, quién asume los costos, tiempos máximos y metas para repartidores.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1.5"
            title="Restablecer valores predeterminados"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Predeterminados</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
              hasUnsavedChanges
                ? "bg-[#ED500A] text-white hover:bg-[#d84606] ring-2 ring-[#ED500A]/30 animate-pulse"
                : "bg-[#ED500A] text-white hover:bg-[#d84606]"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{hasUnsavedChanges ? "Guardar cambios *" : "Guardar configuración"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* SECCIÓN 1: TARIFA POR DOMICILIO */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
          <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              1. Modalidad y Tarifa de Entrega
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Elige cómo se calcula el precio del domicilio al crear comandas o pedidos online.
            </p>
          </div>
        </div>

        {/* SELECTOR DE MODALIDAD: FIJA / DISTANCIA / ZONA */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* OPCIÓN A: FIJA */}
          <div
            onClick={() => handleChange("tariffMode", "fixed")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              config.tariffMode === "fixed"
                ? "border-[#ED500A] bg-orange-50/30 dark:bg-orange-950/20 ring-1 ring-[#ED500A]"
                : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 bg-slate-50/50 dark:bg-white/[0.01]"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#ED500A]" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Tarifa Fija por Entrega
                </span>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  config.tariffMode === "fixed"
                    ? "border-[#ED500A] bg-[#ED500A] text-white"
                    : "border-slate-300 dark:border-slate-700"
                }`}
              >
                {config.tariffMode === "fixed" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Se cobra siempre el mismo monto sin importar la dirección o distancia (ej. $5.000).
            </p>
            <div className="mt-3 font-mono font-bold text-sm text-[#ED500A]">
              {formatCOP(config.fixedFee)}
            </div>
          </div>

          {/* OPCIÓN B: POR DISTANCIA */}
          <div
            onClick={() => handleChange("tariffMode", "distance")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              config.tariffMode === "distance"
                ? "border-[#ED500A] bg-orange-50/30 dark:bg-orange-950/20 ring-1 ring-[#ED500A]"
                : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 bg-slate-50/50 dark:bg-white/[0.01]"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#ED500A]" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Por Distancia (Km)
                </span>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  config.tariffMode === "distance"
                    ? "border-[#ED500A] bg-[#ED500A] text-white"
                    : "border-slate-300 dark:border-slate-700"
                }`}
              >
                {config.tariffMode === "distance" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Tarifa base hasta X kilómetros + cobro por kilómetro adicional recorrido.
            </p>
            <div className="mt-3 font-mono font-bold text-xs text-slate-700 dark:text-slate-300">
              Base: {formatCOP(config.distanceConfig.baseTariff)} + {formatCOP(config.distanceConfig.additionalKmTariff)}/km
            </div>
          </div>

          {/* OPCIÓN C: POR ZONAS */}
          <div
            onClick={() => handleChange("tariffMode", "zone")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              config.tariffMode === "zone"
                ? "border-[#ED500A] bg-orange-50/30 dark:bg-orange-950/20 ring-1 ring-[#ED500A]"
                : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 bg-slate-50/50 dark:bg-white/[0.01]"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#ED500A]" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Por Zonas de Cobertura
                </span>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  config.tariffMode === "zone"
                    ? "border-[#ED500A] bg-[#ED500A] text-white"
                    : "border-slate-300 dark:border-slate-700"
                }`}
              >
                {config.tariffMode === "zone" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Aplica la tarifa definida en cada polígono o radio dibujado en el mapa de cobertura.
            </p>
            <div className="mt-3 font-mono font-bold text-xs text-slate-700 dark:text-slate-300">
              Fallback fuera de zona: {formatCOP(config.fallbackZoneFee)}
            </div>
          </div>
        </div>

        {/* SUBCONFIGURACIÓN SEGÚN MODALIDAD */}
        {config.tariffMode === "fixed" && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Tarifa fija por domicilio (COP) *
                </label>
                <span className="text-[11px] text-slate-500">
                  Monto estándar que se aplicará en cada entrega a domicilio.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={config.fixedFee}
                    onChange={(e) => handleChange("fixedFee", Math.max(0, Number(e.target.value) || 0))}
                    className="w-36 pl-7 pr-3 py-2 text-sm font-bold font-mono bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30"
                  />
                </div>
              </div>
            </div>

            {/* Accesos rápidos sugeridos */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] text-slate-400 font-semibold">Sugerencias:</span>
              {[3000, 4000, 5000, 6000, 8000, 10000].map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => handleChange("fixedFee", sug)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                    config.fixedFee === sug
                      ? "bg-[#ED500A] text-white"
                      : "bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {formatCOP(sug)}
                </button>
              ))}
            </div>
          </div>
        )}

        {config.tariffMode === "distance" && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Tarifa base (COP)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">$</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={config.distanceConfig.baseTariff}
                  onChange={(e) =>
                    handleDistanceConfigChange("baseTariff", Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-full pl-7 pr-3 py-1.5 text-xs font-bold font-mono bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Distancia base incluida (Km)
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={config.distanceConfig.baseDistanceKm}
                onChange={(e) =>
                  handleDistanceConfigChange("baseDistanceKm", Math.max(0.5, Number(e.target.value) || 1))
                }
                className="w-full px-3 py-1.5 text-xs font-bold font-mono bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Tarifa por Km adicional (COP/km)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">$</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={config.distanceConfig.additionalKmTariff}
                  onChange={(e) =>
                    handleDistanceConfigChange("additionalKmTariff", Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-full pl-7 pr-3 py-1.5 text-xs font-bold font-mono bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

        {config.tariffMode === "zone" && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Tarifa de respaldo fuera de zonas (COP)
                </label>
                <span className="text-[11px] text-slate-500">
                  Tarifa sugerida cuando el pedido esté fuera de las zonas delimitadas en el mapa.
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">$</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={config.fallbackZoneFee}
                  onChange={(e) => handleChange("fallbackZoneFee", Math.max(0, Number(e.target.value) || 0))}
                  className="w-32 pl-7 pr-3 py-1.5 text-xs font-bold font-mono bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

        {/* PARÁMETROS ADICIONALES: PEDIDO MÍNIMO Y ENVÍO GRATIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.01]">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-0.5">
              Pedido mínimo general (COP)
            </label>
            <span className="text-[10px] text-slate-400 block mb-2">
              Monto mínimo de compra para despachos ($0 para sin mínimo requerido).
            </span>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                value={config.minOrderAmount}
                onChange={(e) => handleChange("minOrderAmount", Math.max(0, Number(e.target.value) || 0))}
                placeholder="0"
                className="w-full pl-7 pr-3 py-1.5 text-xs font-mono font-bold bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.01]">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-0.5">
              Envío gratis a partir de (COP)
            </label>
            <span className="text-[10px] text-slate-400 block mb-2">
              Subtotal para bonificar el 100% del domicilio al cliente (opcional).
            </span>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">$</span>
              <input
                type="number"
                min="0"
                step="5000"
                value={config.freeDeliveryThreshold ?? ""}
                onChange={(e) => {
                  const val = e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0);
                  handleChange("freeDeliveryThreshold", val);
                }}
                placeholder="Desactivado (sin umbral)"
                className="w-full pl-7 pr-3 py-1.5 text-xs font-mono font-bold bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-xl placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: QUIÉN PAGA LA TARIFA */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              2. ¿Quién asume la tarifa de entrega?
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Define la distribución del costo entre el cliente y el comercio.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* CLIENTE */}
          <div
            onClick={() => handleChange("payer", "customer")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              config.payer === "customer"
                ? "border-blue-600 bg-blue-50/30 dark:bg-blue-950/20 ring-1 ring-blue-600"
                : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 bg-slate-50/50 dark:bg-white/[0.01]"
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                👤 El cliente paga el 100%
              </span>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  config.payer === "customer"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 dark:border-slate-700"
                }`}
              >
                {config.payer === "customer" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              La tarifa completa se adiciona a la factura / comanda y es pagada por el cliente.
            </p>
          </div>

          {/* NEGOCIO */}
          <div
            onClick={() => handleChange("payer", "business")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              config.payer === "business"
                ? "border-blue-600 bg-blue-50/30 dark:bg-blue-950/20 ring-1 ring-blue-600"
                : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 bg-slate-50/50 dark:bg-white/[0.01]"
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                🏪 El negocio asume el 100%
              </span>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  config.payer === "business"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 dark:border-slate-700"
                }`}
              >
                {config.payer === "business" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Envío gratis para el cliente ($0). El costo del domicilio es asumido como gasto por el negocio.
            </p>
          </div>

          {/* COMPARTIDO 50/50 */}
          <div
            onClick={() => handleChange("payer", "split_50_50")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              config.payer === "split_50_50"
                ? "border-blue-600 bg-blue-50/30 dark:bg-blue-950/20 ring-1 ring-blue-600"
                : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 bg-slate-50/50 dark:bg-white/[0.01]"
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                🤝 Compartido 50 / 50
              </span>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  config.payer === "split_50_50"
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-300 dark:border-slate-700"
                }`}
              >
                {config.payer === "split_50_50" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              El cliente paga el 50% de la tarifa en su cuenta y el negocio subsidia el otro 50%.
            </p>
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: ASIGNACIÓN DE REPARTIDORES */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              3. Modo de Asignación de Repartidores
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Estrategia operativa para vincular pedidos con domiciliarios disponibles.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* MANUAL */}
          <div
            onClick={() => handleChange("assignmentMode", "manual")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              config.assignmentMode === "manual"
                ? "border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 ring-1 ring-indigo-600"
                : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 bg-slate-50/50 dark:bg-white/[0.01]"
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                ✋ Asignación Manual
              </span>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  config.assignmentMode === "manual"
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 dark:border-slate-700"
                }`}
              >
                {config.assignmentMode === "manual" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              El despachador o cajero selecciona manualmente a qué domiciliario asignar cada pedido.
            </p>
          </div>

          {/* AUTOMÁTICA */}
          <div
            onClick={() => handleChange("assignmentMode", "auto_first")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              config.assignmentMode === "auto_first"
                ? "border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 ring-1 ring-indigo-600"
                : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 bg-slate-50/50 dark:bg-white/[0.01]"
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                ⚡ Automática Inmediata
              </span>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  config.assignmentMode === "auto_first"
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 dark:border-slate-700"
                }`}
              >
                {config.assignmentMode === "auto_first" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Se asigna automáticamente al primer domiciliario activo que tenga menor carga de pedidos en camino.
            </p>
          </div>

          {/* ROTATIVA */}
          <div
            onClick={() => handleChange("assignmentMode", "round_robin")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
              config.assignmentMode === "round_robin"
                ? "border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 ring-1 ring-indigo-600"
                : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 bg-slate-50/50 dark:bg-white/[0.01]"
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                🔄 Turno Rotativo Equitativo
              </span>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  config.assignmentMode === "round_robin"
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 dark:border-slate-700"
                }`}
              >
                {config.assignmentMode === "round_robin" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              Distribuye las entregas en orden secuencial entre todos los repartidores activos en el turno.
            </p>
          </div>
        </div>
      </div>

      {/* SECCIÓN 4: TIEMPOS Y ALERTAS OPERATIVAS */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
          <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              4. Tiempos y Alertas de Retraso
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Control de puntualidad, advertencias visuales y reasignación automática de pedidos demorados.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.01] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Tiempo máximo para aceptar (min)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={config.timing.maxAcceptTimeMinutes}
                onChange={(e) =>
                  handleTimingChange("maxAcceptTimeMinutes", Math.max(1, Number(e.target.value) || 1))
                }
                className="w-20 px-2 py-1 text-xs font-mono font-bold text-center bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Lapso en el que el repartidor debe confirmar que tomó el pedido desde su enlace seguro.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-amber-200/80 dark:border-amber-500/20 bg-amber-50/30 dark:bg-amber-950/10 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Alerta de retraso en pedidos (min) *
              </label>
              <input
                type="number"
                min="5"
                max="180"
                step="5"
                value={config.timing.delayAlertMinutes}
                onChange={(e) =>
                  handleTimingChange("delayAlertMinutes", Math.max(5, Number(e.target.value) || 30))
                }
                className="w-20 px-2 py-1 text-xs font-mono font-bold text-center bg-white dark:bg-black border border-amber-300 dark:border-amber-800 rounded-lg text-amber-900 dark:text-amber-200"
              />
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              Si un pedido lleva más de {config.timing.delayAlertMinutes} minutos sin entregarse, se resaltará con alerta visual en el panel operativo.
            </p>
          </div>
        </div>

        {/* AUTO-REASIGNACIÓN SI NO ACEPTA */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/30 dark:bg-white/[0.01] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="autoReassign"
              checked={config.timing.autoReassignIfNotAccepted}
              onChange={(e) => handleTimingChange("autoReassignIfNotAccepted", e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-[#ED500A] focus:ring-[#ED500A] cursor-pointer"
            />
            <label htmlFor="autoReassign" className="cursor-pointer">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Auto-reasignar comanda si el repartidor no la acepta
              </span>
              <span className="text-[11px] text-slate-500">
                Libera el pedido y busca otro repartidor disponible si se agota el tiempo de espera.
              </span>
            </label>
          </div>

          {config.timing.autoReassignIfNotAccepted && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Reasignar tras:</span>
              <input
                type="number"
                min="2"
                max="30"
                value={config.timing.reassignAfterMinutes}
                onChange={(e) =>
                  handleTimingChange("reassignAfterMinutes", Math.max(2, Number(e.target.value) || 5))
                }
                className="w-16 px-2 py-1 text-xs font-mono font-bold text-center bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg"
              />
              <span className="text-xs text-slate-500">min</span>
            </div>
          )}
        </div>
      </div>

      {/* SECCIÓN 5: METAS Y BONIFICACIONES */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
          <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              5. Metas y Bonificaciones para Repartidores
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Incentiva la puntualidad y productividad diaria de tu equipo de entrega.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* META DIARIA */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.01] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <TrendingUp className="w-4 h-4 text-purple-500" />
              <span>Meta diaria de entregas</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Meta (entregas/día)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={config.bonuses.dailyDeliveryGoal}
                  onChange={(e) =>
                    handleBonusesChange("dailyDeliveryGoal", Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Bono al cumplir (COP)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={config.bonuses.goalBonusAmount}
                    onChange={(e) =>
                      handleBonusesChange("goalBonusAmount", Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full pl-6 pr-2 py-1.5 text-xs font-mono font-bold bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Al alcanzar {config.bonuses.dailyDeliveryGoal} entregas verificadas en el día, el repartidor acumula {formatCOP(config.bonuses.goalBonusAmount)}.
            </p>
          </div>

          {/* BONIFICACIÓN NOCTURNA */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.01] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Moon className="w-4 h-4 text-indigo-500" />
                <span>Bonificación nocturna por entrega</span>
              </div>
              <input
                type="checkbox"
                id="nightBonusToggle"
                checked={config.bonuses.nightBonusEnabled}
                onChange={(e) => handleBonusesChange("nightBonusEnabled", e.target.checked)}
                className="rounded border-slate-300 text-[#ED500A] focus:ring-[#ED500A] cursor-pointer"
              />
            </div>

            {config.bonuses.nightBonusEnabled ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">Inicio</label>
                    <input
                      type="time"
                      value={config.bonuses.nightBonusStartTime}
                      onChange={(e) => handleBonusesChange("nightBonusStartTime", e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">Fin</label>
                    <input
                      type="time"
                      value={config.bonuses.nightBonusEndTime}
                      onChange={(e) => handleBonusesChange("nightBonusEndTime", e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">Bono (COP)</label>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={config.bonuses.nightBonusAmount}
                      onChange={(e) =>
                        handleBonusesChange("nightBonusAmount", Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-full px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-black border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Aplica +{formatCOP(config.bonuses.nightBonusAmount)} extra por cada entrega efectuada entre {config.bonuses.nightBonusStartTime} y {config.bonuses.nightBonusEndTime}.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                Activa la casilla para compensar entregas en horario nocturno o de alta demanda.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* BOTÓN INFERIOR DE GUARDADO */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#d84606] text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Guardando configuración...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Guardar configuración</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
