"use client";

import React, { useState, useEffect, useTransition, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BusinessDocumentConfig } from "@/lib/documents/types";
import {
  updateWorkspaceConfigAction,
  uploadWorkspaceLogoAction,
  removeWorkspaceLogoAction,
  updateCommercialActivitiesAction,
  updateBusinessSettingsAction,
  updateHeaderQuickAccessAction,
  updateDeliverySettingsAction,
} from "./actions";
import { toast } from "sonner";
import {
  Building2,
  Palette,
  Upload,
  Image as ImageIcon,
  Type,
  FileText,
  Save,
  Globe,
  Lock,
  Sparkles,
  DollarSign,
  Clock,
  Trash2,
  Package,
  Briefcase,
  Calendar,
  CheckCircle2,
  XCircle,
  Users,
  LayoutGrid,
  Printer,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
  Bike,
} from "lucide-react";
import { AdminTabs } from "@/components/admin/ui/admin-tabs";
import { AdminKpiGrid, AdminKpiCard } from "@/components/admin/ui/admin-kpi-card";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { AdminInput } from "@/components/admin/ui/admin-input";
import { AdminBadge } from "@/components/admin/ui/admin-badge";
import { ImageCropperModal } from "@/components/ui/image-cropper-modal";
import { CommercialActivity, PlanFeatureKey, COMMERCIAL_ACTIVITIES, PLAN_FEATURES } from "@/config/commercial-activities";
import { CommercialPlan, PlanLimits, PlanId } from "@/config/plans";
import { BUSINESS_TYPE_LABELS, BusinessType } from "@/lib/businesses/types";
import {
  buildWorkspaceNavSections,
  getDefaultQuickAccessModuleId,
} from "@/config/workspace-navigation";

import { PaymentMethodsTab } from "@/components/configuracion/payment-methods-tab";
import { formatNumberWithDots, parseNumberFromDots } from "@/lib/pos/types";

type ConfigTabId = "general" | "branding" | "comprobantes" | "mi-negocio" | "regional" | "pagos";

// ─── Tipos de POS Settings ───────────────────────────────────────────────────
interface PosSettings {
  printReceipt: boolean;
  receiptCopies: number;
  defaultPaymentMethod: "cash" | "transfer" | "card";
  askCustomerName: boolean;
}

const DEFAULT_POS_SETTINGS: PosSettings = {
  printReceipt: true,
  receiptCopies: 1,
  defaultPaymentMethod: "cash",
  askCustomerName: false,
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface WorkspaceConfiguracionClientProps {
  businessId: string;
  businessName: string;
  userRole: string;
  isOwner: boolean;
  initialConfig: BusinessDocumentConfig;
  businessType: string;
  commercialActivities: CommercialActivity[];
  planId: string;
  planDef: CommercialPlan;
  planLimits: PlanLimits;
  enabledFeatures: PlanFeatureKey[];
  activeUserCount: number;
  activeProductCount: number;
  businessSettings: Record<string, unknown>;
  businessCurrency: string;
  businessTimezone: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ProgressBar({ value, max, label }: { value: number; max?: number | null; label?: string }) {
  if (max === undefined || max === null) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500 dark:text-slate-400">{label}</span>
          <span className="font-mono text-xs text-slate-400">No disponible</span>
        </div>
      </div>
    );
  }

  const isInfinite = max === Infinity;
  const pct = isInfinite ? 0 : max === 0 ? 100 : Math.min(100, Math.round((value / max) * 100));
  const isWarning = !isInfinite && pct >= 80;
  const isCritical = !isInfinite && pct >= 95;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
        <span className={`font-semibold font-mono ${isCritical ? "text-red-500" : isWarning ? "text-amber-500" : "text-slate-700 dark:text-slate-300"}`}>
          {value} / {isInfinite ? "Ilimitado (∞)" : max}
        </span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isCritical ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-indigo-500"}`}
          style={{ width: `${isInfinite ? 10 : pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function WorkspaceConfiguracionClient({
  businessId,
  businessName,
  userRole,
  isOwner,
  initialConfig,
  businessType,
  commercialActivities: initialActivities,
  planId,
  planDef,
  planLimits,
  enabledFeatures,
  activeUserCount,
  activeProductCount,
  businessSettings,
  businessCurrency,
  businessTimezone,
}: WorkspaceConfiguracionClientProps) {
  // ─── Estado ─────────────────────────────────────────────────────────────
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab") as ConfigTabId | null;
  const validTabs: ConfigTabId[] = ["general", "branding", "pagos", "comprobantes", "mi-negocio", "regional"];
  const [activeTab, setActiveTab] = useState<ConfigTabId>(
    tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : "general"
  );

  // Sincronizar pestaña activa cuando cambia el parámetro de URL (ej. ?tab=comprobantes o volver a Configuración)
  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    } else if (!tabFromUrl) {
      setActiveTab("general");
    }
  }, [tabFromUrl]);
  const [config, setConfig] = useState<BusinessDocumentConfig>(initialConfig);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState<string>("logo.png");
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [activities, setActivities] = useState<CommercialActivity[]>(initialActivities);
  const [isSavingActivities, startActivitiesTransition] = useTransition();
  const [posSettings, setPosSettings] = useState<PosSettings>({
    ...DEFAULT_POS_SETTINGS,
    ...((businessSettings.pos as Partial<PosSettings>) || {}),
  });
  const [isSavingSettings, startSettingsTransition] = useTransition();
  const router = useRouter();
  const defaultQuickAccess = getDefaultQuickAccessModuleId(businessType, activities);
  const [headerQuickAccess, setHeaderQuickAccess] = useState<string>(
    (businessSettings.headerQuickAccess as string) || defaultQuickAccess
  );
  const [isSavingQuickAccess, startQuickAccessTransition] = useTransition();

  const availableNavSections = useMemo(() => {
    return buildWorkspaceNavSections(businessId, {
      businessType,
      commercialActivities: activities,
      isOwner,
      roleCode: userRole,
    });
  }, [businessId, businessType, activities, isOwner, userRole]);

  const availableModules = useMemo(() => {
    return availableNavSections.flatMap((s) => s.items);
  }, [availableNavSections]);

  const handleSaveHeaderQuickAccess = () => {
    if (!isOwner) {
      toast.error("Solo el propietario puede modificar el acceso rápido del encabezado.");
      return;
    }
    startQuickAccessTransition(async () => {
      const res = await updateHeaderQuickAccessAction(businessId, headerQuickAccess);
      if (res.success) {
        toast.success("Acceso rápido del encabezado actualizado correctamente.");
        window.dispatchEvent(
          new CustomEvent("negova:header-quick-access-updated", {
            detail: headerQuickAccess,
          })
        );
        router.refresh();
      } else {
        toast.error("Error al actualizar acceso rápido", { description: res.error });
      }
    });
  };

  // ─── Configuración de Domicilios (Tarifa y Activación) ─────────────────────
  const initialDelivery = (businessSettings.delivery as { enabled?: boolean; fee?: number } | undefined) || {};
  const [deliveryEnabled, setDeliveryEnabled] = useState<boolean>(
    initialDelivery.enabled !== false
  );
  const initialDeliveryFeeNum =
    typeof initialDelivery.fee === "number" && !isNaN(initialDelivery.fee) && initialDelivery.fee >= 0
      ? initialDelivery.fee
      : 0;
  const [deliveryFee, setDeliveryFee] = useState<number>(initialDeliveryFeeNum);
  const [deliveryFeeInput, setDeliveryFeeInput] = useState<string>(
    initialDeliveryFeeNum > 0 ? formatNumberWithDots(initialDeliveryFeeNum) : "0"
  );
  const [isSavingDelivery, startDeliveryTransition] = useTransition();

  const handleSaveDeliverySettings = () => {
    if (!isOwner) {
      toast.error("Solo el propietario puede modificar la configuración de domicilios.");
      return;
    }
    if (deliveryFee < 0 || isNaN(deliveryFee)) {
      toast.error("La tarifa de domicilio debe ser un número válido mayor o igual a 0.");
      return;
    }
    startDeliveryTransition(async () => {
      const res = await updateDeliverySettingsAction(businessId, {
        enabled: deliveryEnabled,
        fee: deliveryFee,
      });
      if (res.success) {
        toast.success("Configuración de domicilios guardada correctamente.");
        router.refresh();
      } else {
        toast.error("Error al actualizar domicilios", { description: res.error });
      }
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Handlers generales ──────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    if (!isOwner) {
      toast.error("Solo el propietario puede modificar la configuración.");
      return;
    }
    startTransition(async () => {
      const res = await updateWorkspaceConfigAction(businessId, config);
      if (res.success) {
        toast.success("Configuración actualizada correctamente.");
      } else {
        toast.error("Error al guardar", { description: res.error });
      }
    });
  };

  // ─── Logo handlers con recorte interactivo ──────────────────────────────
  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isOwner) {
      toast.error("Solo el propietario puede cambiar el logotipo.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Formato inválido", { description: "Debe ser una imagen PNG, JPG o WEBP." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Archivo muy pesado", { description: "El tamaño máximo permitido es 10 MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCropFileName(file.name);
      setIsCropModalOpen(true);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCroppedUpload = async (croppedFile: File) => {
    setIsCropModalOpen(false);
    setIsUploading(true);
    const formData = new FormData();
    formData.append("logo", croppedFile);
    const res = await uploadWorkspaceLogoAction(businessId, formData);
    if (res.success && res.url) {
      setConfig((prev) => ({ ...prev, logoUrl: res.url }));
      toast.success("Logotipo actualizado con éxito.");
    } else {
      toast.error("Error al subir logotipo", { description: res.error });
    }
    setIsUploading(false);
  };

  const handleRemoveLogo = async () => {
    if (!isOwner) { toast.error("Solo el propietario puede eliminar el logotipo."); return; }
    setIsRemovingLogo(true);
    const res = await removeWorkspaceLogoAction(businessId);
    if (res.success) {
      setConfig({ ...config, logoUrl: null });
      toast.success("Logotipo eliminado.");
    } else {
      toast.error("Error al eliminar logotipo", { description: res.error });
    }
    setIsRemovingLogo(false);
  };

  // ─── Actividades comerciales ─────────────────────────────────────────────
  const toggleActivity = (activity: CommercialActivity) => {
    if (!isOwner) { toast.error("Solo el propietario puede cambiar las actividades comerciales."); return; }
    let next: CommercialActivity[];
    if (activities.includes(activity)) {
      // Desactivar
      if (activities.length === 1) {
        toast.error("El negocio debe tener al menos una actividad activa.");
        return;
      }
      next = activities.filter((a) => a !== activity);
      // Coherencia: desactivar servicios también desactiva citas
      if (activity === "provide_services") {
        next = next.filter((a) => a !== "manage_appointments");
      }
    } else {
      next = [...activities, activity];
      // Coherencia: activar citas activa servicios automáticamente
      if (activity === "manage_appointments" && !next.includes("provide_services")) {
        next = [...next, "provide_services"];
      }
    }
    setActivities(next);
  };

  const saveActivities = () => {
    startActivitiesTransition(async () => {
      const res = await updateCommercialActivitiesAction(businessId, activities);
      if (res.success) {
        toast.success("Actividades comerciales actualizadas.", {
          description: "Los módulos del negocio se actualizarán al recargar la página.",
        });
      } else {
        toast.error("Error al guardar actividades", { description: res.error });
        setActivities(initialActivities); // Revertir
      }
    });
  };

  const activitiesChanged =
    JSON.stringify([...activities].sort()) !== JSON.stringify([...initialActivities].sort());

  // ─── Preferencias POS ────────────────────────────────────────────────────
  const handlePosChange = (key: keyof PosSettings, value: unknown) => {
    setPosSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    startSettingsTransition(async () => {
      const res = await updateBusinessSettingsAction(businessId, { pos: posSettings as unknown as Record<string, unknown> });
      if (res.success) {
        toast.success("Preferencias del POS guardadas correctamente.");
      } else {
        toast.error("Error al guardar preferencias", { description: res.error });
      }
    });
  };

  // ─── Tipo de negocio ─────────────────────────────────────────────────────
  const businessTypeInfo = BUSINESS_TYPE_LABELS[businessType as BusinessType] || {
    label: businessType,
    categoryLabel: "Negocio",
    iconName: "Building2",
    badgeColor: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400",
  };

  // ─── Tabs ────────────────────────────────────────────────────────────────
  const TABS = [
    { id: "general", label: "Datos del negocio" },
    { id: "branding", label: "Identidad visual" },
    { id: "pagos", label: "Métodos de pago" },
    { id: "comprobantes", label: "Comprobantes" },
    { id: "mi-negocio", label: "Mi negocio" },
    { id: "regional", label: "Regional y preferencias" },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 font-body">
      {/* ── KPI CARDS ─────────────────────────────────────────────────────── */}
      <AdminKpiGrid cols={4}>
        <AdminKpiCard
          title="Nombre Comercial"
          value={config.tradeName || businessName}
          subtext="Identidad activa del negocio"
          icon={<Building2 className="w-4 h-4" />}
          variant="default"
          isSelected={activeTab === "general"}
          onClick={() => setActiveTab("general")}
        />
        <AdminKpiCard
          title="Color de Marca"
          value={config.primaryColor?.toUpperCase() || "#ED500A"}
          subtext="Superficies comerciales y PDF"
          icon={<Palette className="w-4 h-4" />}
          variant="orange"
          isSelected={activeTab === "branding"}
          onClick={() => setActiveTab("branding")}
        />
        <AdminKpiCard
          title="Plan activo"
          value={planDef.name}
          subtext={`${activeUserCount}/${planLimits.maxUsers} usuarios · ${activeProductCount}/${planLimits.maxProducts === Infinity ? "∞" : planLimits.maxProducts} productos`}
          icon={<LayoutGrid className="w-4 h-4" />}
          variant="blue"
          isSelected={activeTab === "mi-negocio"}
          onClick={() => setActiveTab("mi-negocio")}
        />
        <AdminKpiCard
          title="Actividades"
          value={activities.length === 1 ? "1 actividad" : `${activities.length} actividades`}
          subtext={activities.map((a) => COMMERCIAL_ACTIVITIES[a]?.label).join(", ")}
          icon={<Sparkles className="w-4 h-4" />}
          variant="emerald"
          isSelected={activeTab === "mi-negocio"}
          onClick={() => setActiveTab("mi-negocio")}
        />
      </AdminKpiGrid>

      {/* ── TABS NAV ──────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <AdminTabs
            activeTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as ConfigTabId)}
            tabs={TABS}
          />
          {!isOwner && (
            <AdminBadge variant="amber">
              <Lock className="w-3 h-3 mr-1" />
              Modo Consulta (Solo Propietario puede editar)
            </AdminBadge>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
           TAB 1: DATOS DEL NEGOCIO
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "general" && (
        <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">Datos del Negocio y Canales de Contacto</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Información comercial, fiscal y de ubicación que identifica a tu negocio.</p>
              </div>
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">
                Nombre comercial <span className="text-rose-500">*</span>
              </label>
              <AdminInput name="tradeName" value={config.tradeName || ""} onChange={handleChange} placeholder="Ej. Comercializadora San Mateo" disabled={!isOwner} />
              <p className="text-[11px] text-slate-400">Nombre público con el que te conocen tus clientes.</p>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">Razón social / titular legal</label>
              <AdminInput name="legalName" value={config.legalName || ""} onChange={handleChange} placeholder="Ej. Inversiones Comerciales SAS" disabled={!isOwner} />
              <p className="text-[11px] text-slate-400">Razón social o nombre legal registrado ante las autoridades.</p>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">NIT / identificación tributaria</label>
              <AdminInput name="taxId" value={config.taxId || ""} onChange={handleChange} placeholder="Ej. 900.123.456-7" disabled={!isOwner} />
              <p className="text-[11px] text-slate-400">Número de identificación tributaria para documentos comerciales.</p>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">Teléfono de contacto</label>
              <AdminInput name="phone" value={config.phone || ""} onChange={handleChange} placeholder="Ej. +57 300 123 4567" disabled={!isOwner} />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">WhatsApp de atención</label>
              <AdminInput name="whatsapp" value={config.whatsapp || ""} onChange={handleChange} placeholder="Ej. +57 311 456 7890" disabled={!isOwner} />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">Correo electrónico comercial</label>
              <AdminInput type="email" name="email" value={config.email || ""} onChange={handleChange} placeholder="Ej. contacto@minegocio.com" disabled={!isOwner} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">Dirección física</label>
              <AdminInput name="address" value={config.address || ""} onChange={handleChange} placeholder="Ej. Calle 10 # 4-20 Centro" disabled={!isOwner} />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">Ciudad / municipio</label>
              <AdminInput name="city" value={config.city || ""} onChange={handleChange} placeholder="Ej. Bogotá" disabled={!isOwner} />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">Departamento</label>
              <AdminInput name="department" value={config.department || ""} onChange={handleChange} placeholder="Ej. Cundinamarca" disabled={!isOwner} />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">
                Código postal <span className="text-slate-400 font-normal lowercase">(opcional)</span>
              </label>
              <AdminInput name="postalCode" value={config.postalCode || ""} onChange={handleChange} placeholder="Ej. 110111" disabled={!isOwner} className="max-w-xs" />
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           TAB 2: IDENTIDAD VISUAL
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "branding" && (
        <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center border border-orange-500/20">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">Identidad Visual del Negocio</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Logotipo y color de marca para comprobantes y superficies comerciales.</p>
              </div>
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Logotipo */}
            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">Logotipo del negocio</label>
              <div className="flex items-start gap-6">
                <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/[0.08] flex items-center justify-center bg-slate-50 dark:bg-white/[0.02] overflow-hidden shrink-0 relative shadow-inner">
                  {config.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={config.logoUrl} alt="Logotipo del negocio" className="w-full h-full object-contain p-2" />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  )}
                  {(isUploading || isRemovingLogo) && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-black/80 flex items-center justify-center backdrop-blur-xs">
                      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleLogoFileSelect}
                    disabled={isUploading || !isOwner}
                  />
                  <AdminButton
                    variant="outline"
                    leftIcon={<Upload className="w-4 h-4" />}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || !isOwner}
                  >
                    {config.logoUrl ? "Cambiar logotipo" : "Subir logotipo"}
                  </AdminButton>
                  {config.logoUrl && isOwner && (
                    <AdminButton
                      variant="outline"
                      leftIcon={<Trash2 className="w-4 h-4" />}
                      onClick={handleRemoveLogo}
                      disabled={isRemovingLogo}
                      className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-500/20 dark:hover:bg-rose-500/10"
                    >
                      Eliminar logotipo
                    </AdminButton>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    PNG, JPG o WEBP · Máximo 5 MB.<br />
                    Se usa en comprobantes PDF y vistas públicas del negocio.
                  </p>
                </div>
              </div>
            </div>

            {/* Color de marca */}
            <div className="space-y-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">Color de marca</label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    type="color"
                    name="primaryColor"
                    value={config.primaryColor || "#ED500A"}
                    onChange={handleChange}
                    disabled={!isOwner}
                    className="w-14 h-14 rounded-xl cursor-pointer border-0 p-0 bg-transparent disabled:opacity-50"
                  />
                  <div
                    className="absolute inset-0 rounded-xl pointer-events-none shadow-sm ring-1 ring-inset ring-black/10 dark:ring-white/10"
                    style={{ backgroundColor: config.primaryColor || "#ED500A" }}
                  />
                </div>
                <AdminInput
                  type="text"
                  name="primaryColor"
                  value={config.primaryColor?.toUpperCase() || "#ED500A"}
                  onChange={handleChange}
                  placeholder="#HEX"
                  disabled={!isOwner}
                  className="w-36 uppercase font-mono"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Color propio de tu negocio para encabezados de comprobantes.</p>
              <div className="pt-2 space-y-2">
                <span className="text-[11px] text-slate-400 font-mono block">Colores sugeridos:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { name: "Naranja NEGOVA", color: "#ED500A" },
                    { name: "Azul Real", color: "#2563EB" },
                    { name: "Esmeralda", color: "#059669" },
                    { name: "Índigo", color: "#4F46E5" },
                    { name: "Púrpura", color: "#7C3AED" },
                  ].map((preset) => (
                    <button
                      key={preset.color}
                      type="button"
                      disabled={!isOwner}
                      onClick={() => setConfig({ ...config, primaryColor: preset.color })}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/5 text-[11px] font-mono transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.color }} />
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           TAB 3: COMPROBANTES Y DOCUMENTOS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "comprobantes" && (
        <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Type className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">Personalización de Comprobantes</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Configura títulos, mensajes y políticas impresos en los comprobantes de venta.</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">Título del documento</label>
                <AdminInput name="documentTitleDefault" value={config.documentTitleDefault || ""} onChange={handleChange} placeholder="Ej. COMPROBANTE DE VENTA" disabled={!isOwner} />
                <p className="text-[11px] text-slate-400">Título principal impreso en el encabezado del comprobante.</p>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">Subtítulo / leyenda</label>
                <AdminInput name="headerText" value={config.headerText || ""} onChange={handleChange} placeholder="Ej. No responsable de IVA — Régimen Simple" disabled={!isOwner} />
                <p className="text-[11px] text-slate-400">Texto secundario o régimen legal debajo del título.</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">Mensaje de agradecimiento</label>
              <AdminInput name="thankYouNote" value={config.thankYouNote || ""} onChange={handleChange} placeholder="Ej. ¡Gracias por su compra! Esperamos atenderle nuevamente." disabled={!isOwner} />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">Observaciones</label>
              <textarea name="documentObservations" value={config.documentObservations || ""} onChange={handleChange} placeholder="Ej. Conserve este documento como constancia de su compra..." rows={3} disabled={!isOwner} className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none dark:text-white transition-all disabled:opacity-50" />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">Términos y condiciones</label>
              <textarea name="termsAndConditions" value={config.termsAndConditions || ""} onChange={handleChange} placeholder="Ej. Condiciones generales aplicables a las transacciones..." rows={3} disabled={!isOwner} className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none dark:text-white transition-all disabled:opacity-50" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">Política de cambios y devoluciones</label>
                <textarea name="returnPolicy" value={config.returnPolicy || ""} onChange={handleChange} placeholder="Ej. Cambios dentro de los 30 días posteriores a la compra..." rows={3} disabled={!isOwner} className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none dark:text-white transition-all disabled:opacity-50" />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">Política de garantía</label>
                <textarea name="warrantyPolicy" value={config.warrantyPolicy || ""} onChange={handleChange} placeholder="Ej. Garantía de 90 días por defectos de fabricación..." rows={3} disabled={!isOwner} className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none dark:text-white transition-all disabled:opacity-50" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">Pie de página</label>
              <textarea name="footerText" value={config.footerText || ""} onChange={handleChange} placeholder="Ej. Comprobante comercial de control interno." rows={2} disabled={!isOwner} className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none dark:text-white transition-all disabled:opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           TAB 4: MI NEGOCIO (TIPO, ACTIVIDADES, PLAN)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "mi-negocio" && (
        <div className="space-y-6">
          {/* ─── Tipo de negocio ─────────────────────────────────────────── */}
          <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center border border-slate-500/20">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">Tipo de negocio</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sector y categoría con la que está registrado tu negocio en NEGOVA.</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-4">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${businessTypeInfo.badgeColor}`}>
                  {businessTypeInfo.categoryLabel}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{businessTypeInfo.label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-md">
                    El tipo de negocio fue definido al registrar tu comercio en NEGOVA. Determina los módulos disponibles y el comportamiento predeterminado de la plataforma.
                    Si necesitas modificarlo, comunícate con soporte.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Actividades comerciales ──────────────────────────────────── */}
          <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">Actividades comerciales</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Define qué hace tu negocio. Cada actividad activa módulos y funcionalidades específicas.</p>
                  </div>
                </div>
                {activitiesChanged && isOwner && (
                  <AdminButton
                    size="sm"
                    leftIcon={<Save className="w-4 h-4" />}
                    onClick={saveActivities}
                    isLoading={isSavingActivities}
                  >
                    Guardar cambios
                  </AdminButton>
                )}
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* Venta de productos */}
              <ActivityCard
                activity="sell_products"
                icon={<Package className="w-5 h-5" />}
                iconColor="text-orange-500"
                iconBg="bg-orange-500/10 border-orange-500/20"
                isActive={activities.includes("sell_products")}
                isOwner={isOwner}
                onToggle={() => toggleActivity("sell_products")}
                isLastActive={activities.length === 1 && activities.includes("sell_products")}
              >
                <div className="mt-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Protección de datos:</span> Al desactivar esta actividad, se ocultan el catálogo y el POS en la navegación. Tus productos registrados y el historial de ventas previas se conservan intactos en la base de datos sin borrarse.
                </div>
              </ActivityCard>

              {/* Prestación de servicios */}
              <ActivityCard
                activity="provide_services"
                icon={<Briefcase className="w-5 h-5" />}
                iconColor="text-emerald-500"
                iconBg="bg-emerald-500/10 border-emerald-500/20"
                isActive={activities.includes("provide_services")}
                isOwner={isOwner}
                onToggle={() => toggleActivity("provide_services")}
                isLastActive={activities.length === 1 && activities.includes("provide_services")}
              >
                {/* Citas: sub-opción de servicios */}
                {activities.includes("provide_services") && (
                  <div className="mt-3 ml-6 pl-4 border-l-2 border-slate-100 dark:border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">Gestión de citas y agenda</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Programación de turnos vinculada a los servicios ofrecidos.</p>
                        </div>
                      </div>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => toggleActivity("manage_appointments")}
                          className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 focus:outline-none ${activities.includes("manage_appointments") ? "bg-blue-500" : "bg-slate-200 dark:bg-white/10"}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200 ${activities.includes("manage_appointments") ? "translate-x-4.5" : "translate-x-0"}`} />
                        </button>
                      )}
                      {!isOwner && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${activities.includes("manage_appointments") ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400"}`}>
                          {activities.includes("manage_appointments") ? "Activa" : "Inactiva"}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </ActivityCard>

              {activitiesChanged && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Tienes cambios sin guardar. Los módulos del negocio se actualizarán al recargar la página después de guardar.</span>
                </div>
              )}
            </div>
          </div>

          {/* ─── Mi plan ─────────────────────────────────────────────────── */}
          <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">Mi plan y funcionalidades</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Capacidades disponibles según tu suscripción activa con NEGOVA.</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Plan badge */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-bold" style={{ backgroundColor: planDef.color }}>
                  {planDef.name[0]}
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white font-title">Plan {planDef.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{planDef.tagline}</p>
                </div>
              </div>

              {/* Uso de recursos */}
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">Uso de recursos</p>
                <ProgressBar value={activeUserCount} max={planLimits.maxUsers} label="Usuarios" />
                <ProgressBar value={activeProductCount} max={planLimits.maxProducts} label="Productos" />
              </div>

              {/* Funcionalidades */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">Funcionalidades de tu plan</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(PLAN_FEATURES) as PlanFeatureKey[]).map((key) => {
                    const feat = PLAN_FEATURES[key];
                    const isEnabled = enabledFeatures.includes(key);
                    return (
                      <div
                        key={key}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs transition-colors ${isEnabled ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/15" : "bg-slate-50 dark:bg-white/[0.02] border-slate-100 dark:border-white/5 opacity-60"}`}
                      >
                        {isEnabled ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className={`font-semibold ${isEnabled ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-500"}`}>{feat.name}</p>
                          <p className="text-slate-400 dark:text-slate-500 leading-relaxed">{feat.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Soporte */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20">
                <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  <p className="font-semibold mb-0.5">¿Quieres cambiar de plan?</p>
                  <p className="text-blue-600/80 dark:text-blue-400/80">
                    Comunícate con nuestro equipo de soporte para conocer las opciones disponibles.
                    El soporte de tu plan actual es <span className="font-semibold capitalize">{planLimits.supportLevel}</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           TAB 5: REGIONAL Y PREFERENCIAS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "regional" && (
        <div className="space-y-6">
          {/* ─── Configuración regional ───────────────────────────────────── */}
          <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">Configuración Regional</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Parámetros de moneda y zona horaria para la operación comercial.</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase text-slate-400 font-semibold">Moneda</span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 border border-slate-200 dark:border-white/[0.08]">Estándar Activo</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                    {businessCurrency} — Peso colombiano
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Moneda base para ventas, precios y arqueos de caja.</p>
                </div>
                <div className="p-5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase text-slate-400 font-semibold">Zona Horaria</span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 border border-slate-200 dark:border-white/[0.08]">Estándar Activo</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                    {businessTimezone} (UTC-5)
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Zona horaria de registros cronológicos de ventas y cierres.</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-4 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Configuración estándar para Colombia. Si operas en otra zona, comunícate con soporte.
              </p>
            </div>
          </div>

          {/* ─── Acceso Rápido del Encabezado ─────────────────────────── */}
          <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">
                      Acceso rápido del encabezado
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Personaliza el módulo prioritario visible en la barra superior para acceder a él con un solo clic.
                    </p>
                  </div>
                </div>

                {isOwner ? (
                  <AdminButton
                    variant="primary"
                    size="sm"
                    onClick={handleSaveHeaderQuickAccess}
                    disabled={isSavingQuickAccess}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    {isSavingQuickAccess ? "Guardando..." : "Guardar acceso rápido"}
                  </AdminButton>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    <Lock className="w-3.5 h-3.5" />
                    Solo Propietario
                  </span>
                )}
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Vista previa en tiempo real */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
                <div>
                  <span className="text-[11px] font-mono uppercase text-slate-400 font-semibold">
                    Vista previa activa
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Así se mostrará el botón en la barra superior junto al reloj y notificaciones.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const previewItem = availableModules.find((m) => m.id === headerQuickAccess) || availableModules[0];
                    if (!previewItem) return null;
                    const PreviewIcon = previewItem.icon;
                    return (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.1] text-slate-800 dark:text-white text-xs font-semibold shadow-2xs">
                        <PreviewIcon className="w-4 h-4 text-[#ED500A]" />
                        <span>{previewItem.label}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Selector interactivo de módulos disponibles */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-mono">
                  Selecciona el módulo de destino
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availableModules.map((mod) => {
                    const ModIcon = mod.icon;
                    const isSelected = headerQuickAccess === mod.id;
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => {
                          if (!isOwner) return;
                          setHeaderQuickAccess(mod.id);
                        }}
                        disabled={!isOwner || isSavingQuickAccess}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "bg-orange-50/50 dark:bg-[#ED500A]/10 border-[#ED500A] shadow-xs ring-1 ring-[#ED500A]/20"
                            : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200/70 dark:border-white/[0.06] hover:bg-slate-100/60 dark:hover:bg-white/[0.04]"
                        } ${!isOwner ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-[#ED500A] text-white shadow-xs"
                              : "bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          <ModIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {mod.label}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-[#ED500A] shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {mod.description || "Módulo disponible"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ─── Configuración de Domicilios ───────────────────────────── */}
          <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
                    <Bike className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">
                      Configuración de domicilios
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Define la disponibilidad del servicio y la tarifa fija cobrada en los pedidos a domicilio del menú digital.
                    </p>
                  </div>
                </div>

                {isOwner ? (
                  <AdminButton
                    variant="primary"
                    size="sm"
                    onClick={handleSaveDeliverySettings}
                    disabled={isSavingDelivery}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    {isSavingDelivery ? "Guardando..." : "Guardar domicilios"}
                  </AdminButton>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    <Lock className="w-3.5 h-3.5" />
                    Solo Propietario
                  </span>
                )}
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Activar/Desactivar servicio de domicilio */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Habilitar servicio de domicilio
                    </p>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      deliveryEnabled
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-slate-200/70 dark:bg-white/10 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5"
                    }`}>
                      {deliveryEnabled ? "Servicio Activo" : "Servicio Inactivo"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Permite a los comensales seleccionar entrega a domicilio en el menú digital. Si se desactiva, solo podrán pedir para recoger o en mesa.
                  </p>
                </div>
                <ToggleSwitch
                  value={deliveryEnabled}
                  onChange={(v) => isOwner && setDeliveryEnabled(v)}
                  disabled={!isOwner || isSavingDelivery}
                />
              </div>

              {/* Tarifa fija de domicilio */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Tarifa fija de entrega a domicilio ({businessCurrency || "COP"})
                      </p>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                        Tarifa Única por Pedido
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Este importe se sumará exactamente una vez al subtotal cuando el cliente elija la modalidad «Domicilio». No se suma a pedidos para recoger ni en mesa.
                    </p>
                  </div>
                  <div className="text-right sm:shrink-0">
                    <span className="text-xs text-slate-400 block font-mono">Valor actual</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                      {new Intl.NumberFormat("es-CO", {
                        style: "currency",
                        currency: businessCurrency || "COP",
                        maximumFractionDigits: 0,
                      }).format(deliveryFee)}
                    </span>
                  </div>
                </div>

                <div className="pt-1">
                  <div className="relative max-w-xs">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={deliveryFeeInput}
                      onChange={(e) => {
                        if (!isOwner) return;
                        const inputVal = e.target.value;
                        if (!inputVal.trim()) {
                          setDeliveryFeeInput("");
                          setDeliveryFee(0);
                          return;
                        }
                        const raw = parseNumberFromDots(inputVal);
                        setDeliveryFee(raw);
                        setDeliveryFeeInput(formatNumberWithDots(raw));
                      }}
                      onBlur={() => {
                        if (!deliveryFeeInput.trim()) {
                          setDeliveryFeeInput("0");
                          setDeliveryFee(0);
                        } else {
                          setDeliveryFeeInput(formatNumberWithDots(deliveryFee));
                        }
                      }}
                      disabled={!isOwner || isSavingDelivery || !deliveryEnabled}
                      placeholder="Ej. 5.000"
                      className="w-full pl-7 pr-3 py-2 rounded-xl text-sm font-mono border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none disabled:opacity-50"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                    <Info className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Ingresa 0 para ofrecer entregas a domicilio gratuitas o sin recargo adicional.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Preferencias del POS ─────────────────────────────────────── */}
          <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-title text-slate-900 dark:text-white">Preferencias del Punto de Venta</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Ajustes operativos que aplican al registrar cada venta en el POS.</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Imprimir comprobante */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Imprimir comprobante al cerrar venta</p>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                      Preferencia guardada
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Prepara el comprobante de venta al finalizar cada cobro.</p>
                </div>
                <ToggleSwitch
                  value={posSettings.printReceipt}
                  onChange={(v) => handlePosChange("printReceipt", v)}
                  disabled={!isOwner}
                />
              </div>

              {/* Número de copias */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Número de copias del comprobante</p>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                      Preferencia guardada
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cantidad de copias configuradas para la emisión de comprobantes.</p>
                </div>
                <select
                  value={posSettings.receiptCopies}
                  onChange={(e) => handlePosChange("receiptCopies", Number(e.target.value))}
                  disabled={!isOwner}
                  className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg px-3 py-1.5 text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none disabled:opacity-50"
                >
                  <option value={1}>1 copia</option>
                  <option value={2}>2 copias</option>
                  <option value={3}>3 copias</option>
                </select>
              </div>

              {/* Método de pago predeterminado */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Método de pago predeterminado</p>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Integrado con Ventas
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Preselecciona el método de cobro en el formulario de ventas.</p>
                </div>
                <select
                  value={posSettings.defaultPaymentMethod}
                  onChange={(e) => handlePosChange("defaultPaymentMethod", e.target.value)}
                  disabled={!isOwner}
                  className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta / Datáfono</option>
                </select>
              </div>

              {/* Solicitar nombre del cliente */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Solicitar nombre del cliente</p>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Integrado con Ventas
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Exige el ingreso del nombre del cliente en lugar de asumir «Consumidor Final».</p>
                </div>
                <ToggleSwitch
                  value={posSettings.askCustomerName}
                  onChange={(v) => handlePosChange("askCustomerName", v)}
                  disabled={!isOwner}
                />
              </div>

              {isOwner && (
                <div className="flex justify-end pt-2">
                  <AdminButton
                    leftIcon={<Save className="w-4 h-4" />}
                    onClick={saveSettings}
                    isLoading={isSavingSettings}
                  >
                    Guardar preferencias del POS
                  </AdminButton>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
           TAB MÉTODOS DE PAGO Y COBRO
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "pagos" && (
        <PaymentMethodsTab businessId={businessId} isOwner={isOwner} />
      )}

      {/* ── BARRA DE GUARDAR (tabs 1-3) ──────────────────────────────────── */}
      {isOwner && ["general", "branding", "comprobantes"].includes(activeTab) && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Sparkles className="w-4 h-4 text-orange-500" />
            <span>Los cambios guardados se aplican de inmediato a los datos y comprobantes del negocio.</span>
          </div>
          <AdminButton
            size="lg"
            leftIcon={<Save className="w-4 h-4" />}
            onClick={handleSave}
            isLoading={isPending}
            className="cursor-pointer"
          >
            Guardar Configuración
          </AdminButton>
        </div>
      )}

      {/* Modal interactivo de recorte de logotipo */}
      <ImageCropperModal
        isOpen={isCropModalOpen}
        imageSrc={cropImageSrc}
        fileName={cropFileName}
        onClose={() => setIsCropModalOpen(false)}
        onCropComplete={handleCroppedUpload}
        initialAspectRatio="1:1"
      />
    </div>
  );
}

// ─── Sub-componente: ActivityCard ─────────────────────────────────────────────
interface ActivityCardProps {
  activity: CommercialActivity;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  isActive: boolean;
  isOwner: boolean;
  isLastActive: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

function ActivityCard({ activity, icon, iconColor, iconBg, isActive, isOwner, isLastActive, onToggle, children }: ActivityCardProps) {
  const def = COMMERCIAL_ACTIVITIES[activity];
  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 ${isActive ? "bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.08]" : "bg-slate-50 dark:bg-white/[0.01] border-slate-100 dark:border-white/5 opacity-70"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${iconBg} ${iconColor} shrink-0`}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{def.label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-sm">{def.description}</p>
          </div>
        </div>
        {isOwner ? (
          <button
            type="button"
            onClick={onToggle}
            disabled={isLastActive}
            title={isLastActive ? "Debe haber al menos una actividad activa" : undefined}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ${isActive ? "bg-indigo-500" : "bg-slate-200 dark:bg-white/10"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${isActive ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        ) : (
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${isActive ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400"}`}>
            {isActive ? "Activa" : "Inactiva"}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Sub-componente: ToggleSwitch ─────────────────────────────────────────────
function ToggleSwitch({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${value ? "bg-indigo-500" : "bg-slate-200 dark:bg-white/10"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${value ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}
