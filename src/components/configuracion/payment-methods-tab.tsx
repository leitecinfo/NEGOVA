"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Edit2,
  Upload,
  Trash2,
  QrCode,
  Info,
  ShieldAlert,
  Loader2,
  X,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { PaymentMethodCode, BusinessPaymentMethodConfig, BreBKeyType, PaymentDestinationType } from "@/lib/payments/types";
import {
  PAYMENT_METHOD_CODES,
  PAYMENT_METHODS_CATALOG,
  getDestinationTypeLabel,
  isPaymentMethodComplete,
} from "@/lib/payments/payment-methods-catalog";
import { PaymentMethodLogo } from "@/components/payments/payment-method-logo";
import {
  getPaymentMethodsAction,
  savePaymentMethodAction,
  togglePaymentMethodAction,
  uploadPaymentQrAction,
  removePaymentQrAction,
} from "@/app/workspace/[businessId]/configuracion/payment-actions";

interface PaymentMethodsTabProps {
  businessId: string;
  isOwner: boolean;
}

export function PaymentMethodsTab({ businessId, isOwner }: PaymentMethodsTabProps) {
  const [methods, setMethods] = useState<Record<PaymentMethodCode, BusinessPaymentMethodConfig> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCode, setEditingCode] = useState<PaymentMethodCode | null>(null);
  const [isPending, startTransition] = useTransition();

  // Cargar métodos al montar
  const loadMethods = async () => {
    setIsLoading(true);
    const res = await getPaymentMethodsAction(businessId);
    if (res.success && res.methods) {
      setMethods(res.methods);
    } else {
      toast.error("Error al cargar métodos de pago", { description: res.error });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadMethods();
  }, [businessId]);

  const handleToggle = (code: PaymentMethodCode) => {
    if (!isOwner) {
      toast.error("Solo el propietario del negocio puede activar o desactivar métodos de pago.");
      return;
    }

    if (code === "cash") {
      toast.info("Efectivo es el medio base y siempre se encuentra activo.");
      return;
    }

    const current = methods?.[code];
    if (!current) return;

    // Si está intentando activar pero faltan datos
    if (!current.isEnabled && !current.isConfigured) {
      toast.error(`Completa los datos de cobro de ${PAYMENT_METHODS_CATALOG[code].name} antes de activarlo.`);
      setEditingCode(code);
      return;
    }

    const nextState = !current.isEnabled;

    startTransition(async () => {
      const res = await togglePaymentMethodAction(businessId, code, nextState);
      if (res.success && res.config) {
        setMethods((prev) => (prev ? { ...prev, [code]: res.config! } : prev));
        toast.success(
          nextState
            ? `${PAYMENT_METHODS_CATALOG[code].name} activado para el Menú Digital y POS.`
            : `${PAYMENT_METHODS_CATALOG[code].name} desactivado.`
        );
      } else {
        toast.error("No se pudo cambiar el estado", { description: res.error });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#ED500A] animate-spin" />
        <p className="text-sm text-slate-500">Cargando métodos de pago configurados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER EXPLICATIVO */}
      <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-200/60 dark:border-blue-500/10 flex flex-col sm:flex-row items-start gap-3.5">
        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
          <Info className="w-5 h-5" />
        </div>
        <div className="space-y-1 text-xs sm:text-sm">
          <h4 className="font-bold text-slate-900 dark:text-white">
            Configuración de Cobro y Transferencias
          </h4>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-xs">
            Activa las entidades bancarias y billeteras por las que tu negocio recibe transferencias.
            Los métodos activos aparecerán en tu <strong>Menú Digital</strong> y en el <strong>Módulo Vender (POS)</strong>.
            Las transferencias son estrictamente informativas: tú o tu personal verifican el dinero en su app antes de entregar el pedido.
          </p>
        </div>
      </div>

      {!isOwner && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Modo solo lectura: únicamente el propietario de este comercio puede modificar los datos bancarios y de cobro.</span>
        </div>
      )}

      {/* LISTA DE MÉTODOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {PAYMENT_METHOD_CODES.map((code) => {
          const meta = PAYMENT_METHODS_CATALOG[code];
          const config = methods?.[code];
          const isCash = code === "cash";
          const isBreB = code === "bre_b";

          return (
            <div
              key={code}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                config?.isEnabled
                  ? "bg-white dark:bg-[#0D0F16] border-slate-300 dark:border-white/15 shadow-xs"
                  : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.06] opacity-85"
              }`}
            >
              <div>
                {/* CABECERA DE LA ENTIDAD */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <PaymentMethodLogo code={code} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {meta.name}
                        </h4>
                        {isBreB && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Interoperable
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {meta.categoryLabel}
                      </p>
                    </div>
                  </div>

                  {/* TOGGLE / ESTADO */}
                  <div className="flex items-center gap-2">
                    {isCash ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Siempre activo
                      </span>
                    ) : (
                      <label className="relative inline-flex items-center cursor-pointer min-h-[44px] min-w-[44px] justify-center">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={config?.isEnabled || false}
                          disabled={!isOwner || isPending}
                          onChange={() => handleToggle(code)}
                          aria-label={`Activar o desactivar ${meta.name}`}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[12px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ED500A]" />
                      </label>
                    )}
                  </div>
                </div>

                {/* DETALLES DE CONFIGURACIÓN */}
                {!isCash && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 text-[11px]">Estado:</span>
                      {config?.isConfigured ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> Configurado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          <AlertCircle className="w-3 h-3" /> Pendiente de datos
                        </span>
                      )}
                    </div>

                    {config?.isConfigured && config.destinationValue ? (
                      <div className="p-2.5 rounded-xl bg-slate-100/60 dark:bg-white/5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">
                            {getDestinationTypeLabel(config.destinationType, config.breBKeyType)}
                          </span>
                          {config.qrUrl && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                              <QrCode className="w-3 h-3" /> QR Activo
                            </span>
                          )}
                        </div>
                        <div className="font-mono font-bold text-slate-900 dark:text-white truncate">
                          {config.destinationValue}
                        </div>
                        {config.accountHolder && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                            Titular: {config.accountHolder}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">
                        Sin datos registrados. Los clientes no podrán usar este método hasta que completes su configuración.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* BOTÓN EDITAR */}
              {!isCash && (
                <div className="mt-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingCode(code)}
                    disabled={!isOwner}
                    className="w-full min-h-[44px] py-2 px-3 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{config?.isConfigured ? "Modificar datos de cobro" : "Configurar datos de cobro"}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL DE EDICIÓN */}
      {editingCode && (
        <EditPaymentMethodModal
          businessId={businessId}
          code={editingCode}
          initialConfig={methods?.[editingCode] || null}
          isOpen={true}
          onClose={() => setEditingCode(null)}
          onSaved={(newConfig) => {
            setMethods((prev) => (prev ? { ...prev, [editingCode]: newConfig } : prev));
            setEditingCode(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Modal de Edición Específica por Entidad ──────────────────────────────────
interface EditModalProps {
  businessId: string;
  code: PaymentMethodCode;
  initialConfig: BusinessPaymentMethodConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (config: BusinessPaymentMethodConfig) => void;
}

function EditPaymentMethodModal({
  businessId,
  code,
  initialConfig,
  isOpen,
  onClose,
  onSaved,
}: EditModalProps) {
  const meta = PAYMENT_METHODS_CATALOG[code];
  const isBreB = code === "bre_b";

  const [destinationValue, setDestinationValue] = useState(initialConfig?.destinationValue || "");
  const [destinationType, setDestinationType] = useState<PaymentDestinationType>(
    initialConfig?.destinationType || meta.defaultDestinationType
  );
  const [breBKeyType, setBreBKeyType] = useState<BreBKeyType>(initialConfig?.breBKeyType || "phone");
  const [accountHolder, setAccountHolder] = useState(initialConfig?.accountHolder || "");
  const [instructions, setInstructions] = useState(initialConfig?.instructions || "");
  const [isEnabled, setIsEnabled] = useState(initialConfig?.isEnabled || false);
  const [qrUrl, setQrUrl] = useState(initialConfig?.qrUrl || null);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona un archivo de imagen (PNG, JPG o WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo no debe exceder 5MB.");
      return;
    }

    setIsUploadingQr(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await uploadPaymentQrAction(businessId, code, formData);
    if (res.success && res.url) {
      setQrUrl(res.url);
      toast.success("Código QR actualizado.");
    } else {
      toast.error("Error al subir código QR", { description: res.error });
    }
    setIsUploadingQr(false);
  };

  const handleRemoveQr = async () => {
    setIsUploadingQr(true);
    const res = await removePaymentQrAction(businessId, code);
    if (res.success) {
      setQrUrl(null);
      toast.success("Código QR eliminado.");
    } else {
      toast.error("Error al eliminar QR", { description: res.error });
    }
    setIsUploadingQr(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!destinationValue.trim()) {
      toast.error(
        isBreB
          ? "Debes ingresar el valor de la llave Bre-B."
          : `Debes ingresar ${meta.destinationValueLabel.toLowerCase()}.`
      );
      return;
    }

    if (meta.requiresAccountHolder && !accountHolder.trim()) {
      toast.error("El nombre del titular o beneficiario es obligatorio para cuentas bancarias.");
      return;
    }

    setIsSubmitting(true);

    const res = await savePaymentMethodAction(businessId, code, {
      destinationValue: destinationValue.trim(),
      destinationType: isBreB ? (breBKeyType as PaymentDestinationType) : destinationType,
      breBKeyType: isBreB ? breBKeyType : null,
      accountHolder: accountHolder.trim() || null,
      instructions: instructions.trim() || null,
      isEnabled,
      qrUrl,
    });

    if (res.success && res.config) {
      toast.success(`Datos de ${meta.name} guardados correctamente.`);
      onSaved(res.config);
    } else {
      toast.error("No se pudieron guardar los datos", { description: res.error });
    }

    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* ENCABEZADO */}
        <div className="sticky top-0 bg-white dark:bg-[#0D0F16] p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <PaymentMethodLogo code={code} size="md" />
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Configurar {meta.name}
              </h3>
              <p className="text-xs text-slate-500">{meta.categoryLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* CASO BRE-B: TIPO DE LLAVE */}
          {isBreB ? (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Tipo de Llave Bre-B <span className="text-red-500">*</span>
              </label>
              <select
                value={breBKeyType}
                onChange={(e) => setBreBKeyType(e.target.value as BreBKeyType)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/20 focus:border-[#ED500A] text-slate-900 dark:text-white min-h-[44px] dark:[color-scheme:dark] cursor-pointer"
              >
                <option value="phone" className="bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white py-1">
                  Número de celular
                </option>
                <option value="email" className="bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white py-1">
                  Correo electrónico
                </option>
                <option value="alphanumeric" className="bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white py-1">
                  Llave alfanumérica
                </option>
                <option value="merchant_code" className="bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white py-1">
                  Código de comercio
                </option>
              </select>
              <p className="text-[11px] text-slate-500">
                Selecciona la forma en que tu cuenta bancaria o billetera recibe transferencias Bre-B.
              </p>
            </div>
          ) : meta.allowedDestinationTypes.length > 1 ? (
            /* CASO BANCOS: TIPO DE CUENTA */
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Tipo de Cuenta <span className="text-red-500">*</span>
              </label>
              <select
                value={destinationType}
                onChange={(e) => setDestinationType(e.target.value as PaymentDestinationType)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/20 focus:border-[#ED500A] text-slate-900 dark:text-white min-h-[44px] dark:[color-scheme:dark] cursor-pointer"
              >
                {meta.allowedDestinationTypes.map((t) => (
                  <option key={t.value} value={t.value} className="bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white py-1">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* VALOR DE DESTINO / LLAVE / NÚMERO */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {isBreB ? "Valor de la Llave" : meta.destinationValueLabel}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={destinationValue}
              onChange={(e) => setDestinationValue(e.target.value)}
              placeholder={meta.destinationValuePlaceholder}
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/20 focus:border-[#ED500A] text-slate-900 dark:text-white min-h-[44px]"
            />
          </div>

          {/* BENEFICIARIO / TITULAR */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Nombre del Titular o Beneficiario{" "}
              {meta.requiresAccountHolder ? (
                <span className="text-red-500">*</span>
              ) : (
                <span className="text-slate-400 font-normal">(Opcional)</span>
              )}
            </label>
            <input
              type="text"
              required={meta.requiresAccountHolder}
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              placeholder="Ej. Juan Pérez / Inversiones ABC SAS"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/20 focus:border-[#ED500A] text-slate-900 dark:text-white min-h-[44px]"
            />
          </div>

          {/* INSTRUCCIONES OPCIONALES */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Instrucciones adicionales para el cliente <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Ej. Por favor enviar captura del comprobante al WhatsApp indicando tu número de pedido."
              className="w-full px-3.5 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/20 focus:border-[#ED500A] text-slate-900 dark:text-white resize-none"
            />
          </div>

          {/* QR OPCIONAL PARA BRE-B */}
          {meta.supportsQr && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Código QR de cobro <span className="text-slate-400 font-normal">(Opcional para Bre-B)</span>
              </label>

              {qrUrl ? (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={qrUrl}
                      alt="QR Bre-B"
                      className="w-14 h-14 object-contain bg-white rounded-lg border p-1"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">QR Activo</p>
                      <p className="text-[11px] text-slate-500">Se mostrará al cliente al elegir Bre-B.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1 min-h-[44px]">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Reemplazar</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={handleQrUpload}
                        disabled={isUploadingQr}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveQr}
                      disabled={isUploadingQr}
                      className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Quitar QR"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-slate-200 dark:border-white/10 hover:border-[#ED500A] p-4 rounded-xl flex flex-col items-center justify-center gap-2 text-center transition-colors cursor-pointer min-h-[90px]">
                  <QrCode className="w-6 h-6 text-slate-400" />
                  <div className="text-xs">
                    <span className="font-bold text-[#ED500A]">Haz clic para subir imagen de QR</span>
                    <span className="text-slate-400 block text-[10px]">PNG, JPG o WEBP (Máx. 5MB)</span>
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={handleQrUpload}
                    disabled={isUploadingQr}
                  />
                </label>
              )}
            </div>
          )}

          {/* TOGGLE ACTIVAR TRAS GUARDAR */}
          <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Activar para clientes
              </span>
              <span className="text-[11px] text-slate-500 block">
                Estará visible en el Menú Digital y POS una vez guardes.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer min-h-[44px] min-w-[44px] justify-center">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-white/10 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[12px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ED500A]" />
            </label>
          </div>

          {/* ACCIONES */}
          <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#ED500A] hover:bg-[#d04508] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer min-h-[44px] flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Guardar configuración</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
