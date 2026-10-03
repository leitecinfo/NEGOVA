"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Store,
  Building2,
  UtensilsCrossed,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  CreditCard,
  Sparkles,
  Info,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  BusinessType,
  BusinessCategory,
  BusinessStatus,
  generateSlug,
  BUSINESS_CATEGORIES,
  getCategoryFromBusinessType,
} from "@/lib/businesses/types";
import { createBusinessAction } from "../actions";
import {
  CommercialPlan,
  PlanId,
  calculatePeriodDates,
  calculateRemainingDays,
  getVigenciaStatusBadge,
  formatVigenciaDate,
  formatVigenciaDuration,
  NEGOVA_PLANS,
} from "@/config/plans";
import {
  AdminInput,
  AdminSelect,
  AdminSearchSelect,
  AdminButton,
} from "@/components/admin/ui";
import {
  getDepartmentOptions,
  getCitiesOptions,
} from "@/config/colombia-locations";

// Esquema Zod para creación del negocio
const createBusinessSchema = z.object({
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  slug: z
    .string()
    .min(2, "El slug debe tener al menos 2 caracteres")
    .max(100, "El slug no puede exceder 100 caracteres"),
  businessType: z.string().min(1, "Seleccione un tipo de negocio válido"),
  ownerUserId: z
    .string()
    .min(1, "Debes seleccionar un usuario propietario para el negocio"),
  description: z.string().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
  phone: z.string().max(25, "Máximo 25 caracteres").optional().or(z.literal("")),
  email: z.string().email("Correo electrónico inválido").optional().or(z.literal("")),
  address: z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
  city: z.string().min(1, "Debes seleccionar una ciudad o municipio"),
  department: z.string().min(1, "Debes seleccionar un departamento"),
  country: z.string().min(1, "País requerido"),
  status: z.enum(["trial", "active"]),
  planId: z.enum(["inicio", "crece", "negocio"], {
    message: "Debes seleccionar un plan comercial válido",
  }),
  billingInterval: z.enum(["monthly", "annual"]),
  contractDuration: z
    .number()
    .min(1, "La cantidad contratada debe ser al menos 1")
    .max(120, "Cantidad inválida"),
  startDate: z.string().min(1, "Debes indicar una fecha de inicio"),
});

type FormValues = z.infer<typeof createBusinessSchema>;

interface NuevoNegocioClientProps {
  plans: CommercialPlan[];
  candidateOwners: Array<{ id: string; fullName: string; email: string }>;
}

export function NuevoNegocioClient({ plans, candidateOwners }: NuevoNegocioClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const todayStr = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createBusinessSchema),
    defaultValues: {
      name: "",
      slug: "",
      businessType: "restaurant",
      ownerUserId: candidateOwners[0]?.id || "",
      description: "",
      phone: "",
      email: "",
      address: "",
      city: "Riohacha",
      department: "La Guajira",
      country: "CO",
      status: "trial",
      planId: "inicio",
      billingInterval: "monthly",
      contractDuration: 1,
      startDate: todayStr,
    },
  });

  const selectedSlug = watch("slug");
  const selectedType = (watch("businessType") || "restaurant") as BusinessType;
  const [selectedCategory, setSelectedCategory] = useState<BusinessCategory>(
    getCategoryFromBusinessType(selectedType)
  );

  const activeCategoryDef =
    BUSINESS_CATEGORIES.find((c) => c.id === selectedCategory) || BUSINESS_CATEGORIES[0];

  const handleCategoryChange = (catId: string) => {
    const category = catId as BusinessCategory;
    setSelectedCategory(category);
    const catDef = BUSINESS_CATEGORIES.find((c) => c.id === category);
    if (catDef && catDef.types.length > 0) {
      setValue("businessType", catDef.types[0].value, { shouldValidate: true });
    }
  };

  const selectedOwnerUserId = watch("ownerUserId");
  const selectedPlanId = watch("planId");
  const selectedBillingInterval = watch("billingInterval");
  const selectedContractDuration = watch("contractDuration") || 1;
  const selectedStartDate = watch("startDate") || todayStr;
  const selectedStatus = watch("status");
  const selectedDepartment = watch("department");
  const selectedCity = watch("city");

  const handleDepartmentChange = (dept: string) => {
    setValue("department", dept, { shouldValidate: true });
    const availableCities = getCitiesOptions(dept);
    const firstCity = availableCities[0]?.value || "";
    setValue("city", firstCity, { shouldValidate: true });
  };

  // Autogenerar slug al escribir el nombre si el usuario no lo ha personalizado
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue("name", val, { shouldValidate: true });
    setValue("slug", generateSlug(val), { shouldValidate: true });
  };

  const onSubmit = (formData: FormValues) => {
    startTransition(async () => {
      const res = await createBusinessAction({
        name: formData.name,
        slug: formData.slug || generateSlug(formData.name),
        businessType: formData.businessType as BusinessType,
        ownerUserId: formData.ownerUserId,
        description: formData.description,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        city: formData.city,
        department: formData.department,
        country: "CO",
        status: formData.status as BusinessStatus,
        planId: formData.planId as PlanId,
        billingInterval: formData.billingInterval as any,
        contractDuration: Number(formData.contractDuration),
        monthsContracted:
          formData.billingInterval === "annual"
            ? Number(formData.contractDuration) * 12
            : Number(formData.contractDuration),
        startDate: formData.startDate,
      });

      if (res.success && res.business) {
        toast.success(`Negocio '${res.business.name}' creado exitosamente.`);
        router.push(`/admin/negocios/${res.business.id}`);
      } else {
        toast.error(res.error || "No se pudo registrar el negocio.");
      }
    });
  };


  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 font-body">
      {/* BANNER INFORMATIVO */}
      <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-xs text-orange-700 dark:text-orange-300 flex items-start gap-3">
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-[#ED500A]" />
        <div className="space-y-0.5">
          <p className="font-semibold text-orange-900 dark:text-orange-200">
            Creación de entidad comercial y asignación de Propietario
          </p>
          <p className="leading-relaxed">
            El negocio se creará con los datos comerciales y el plan seleccionado, vinculando automáticamente al <strong>Usuario Propietario (Owner)</strong> seleccionado con rol de propietario en el equipo del negocio.
          </p>
        </div>
      </div>

      {/* 1. IDENTIDAD Y TIPO DE NEGOCIO */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold font-title text-slate-900 dark:text-white">
              1. Identidad y Tipo de Negocio
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Datos comerciales básicos y clasificación del establecimiento.
            </p>
          </div>
        </div>

        {/* 2 Niveles: Categoría Principal y Tipo de Negocio */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05]">
          {/* Nivel 1: Categoría Principal */}
          <div>
            <AdminSelect
              label="1. Categoría Principal / Sector"
              required
              value={selectedCategory}
              onChange={handleCategoryChange}
              options={BUSINESS_CATEGORIES.map((cat) => ({
                value: cat.id,
                label: cat.label,
              }))}
              helperText="Sector macro de la actividad comercial."
            />
          </div>

          {/* Nivel 2: Tipo de Negocio */}
          <div>
            <AdminSelect
              label="2. Tipo de Negocio / Formato"
              required
              value={selectedType}
              onChange={(val: string) =>
                setValue("businessType", val as BusinessType, { shouldValidate: true })
              }
              options={activeCategoryDef.types.map((type) => ({
                value: type.value,
                label: type.label,
              }))}
              helperText={`Opciones específicas de ${activeCategoryDef.label}.`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* Nombre */}
          <div>
            <AdminInput
              label="Nombre Comercial"
              required
              placeholder="Ej. Hamburguesas El Corral"
              {...register("name")}
              onChange={handleNameChange}
              error={errors.name?.message}
            />
          </div>

          {/* Slug */}
          <div>
            <AdminInput
              label="Identificador Slug"
              required
              placeholder="ej-hamburguesas-el-corral"
              value={selectedSlug}
              onChange={(e) => setValue("slug", e.target.value, { shouldValidate: true })}
              error={errors.slug?.message}
              helperText="URL de acceso: app.negova.co/[slug]"
            />
          </div>

          {/* Teléfono */}
          <div>
            <AdminInput
              label="Teléfono / WhatsApp de Contacto"
              placeholder="+57 300 123 4567"
              leftIcon={<Phone className="w-4 h-4 text-slate-400" />}
              {...register("phone")}
              error={errors.phone?.message}
            />
          </div>

          {/* Email Comercial */}
          <div>
            <AdminInput
              label="Correo Electrónico Comercial"
              type="email"
              placeholder="contacto@comercio.com"
              leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
              {...register("email")}
              error={errors.email?.message}
            />
          </div>

          {/* Descripción */}
          <div className="md:col-span-2">
            <AdminInput
              label="Descripción o Eslogan (Opcional)"
              placeholder="Breve reseña del comercio..."
              {...register("description")}
              error={errors.description?.message}
            />
          </div>
        </div>
      </div>

      {/* 2. PROPIETARIO DEL NEGOCIO (OWNER) */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] p-6 sm:p-8 shadow-xs space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold font-title text-slate-900 dark:text-white">
              2. Propietario del Negocio (Owner) <span className="text-red-500">*</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Selecciona el usuario de negocio existente que asumirá la titularidad y membresía de propietario.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {candidateOwners.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-bold">No hay usuarios de negocio registrados</p>
                <p className="text-slate-600 dark:text-slate-400">
                  Para crear un negocio, primero debes registrar al menos un usuario de tipo negocio que actuará como propietario.
                </p>
              </div>
              <Link
                href="/admin/usuarios/nuevo"
                className="shrink-0 px-3 py-1.5 rounded-lg bg-[#ED500A] text-white font-semibold text-xs hover:bg-[#d44505] transition-colors"
              >
                Crear Usuario
              </Link>
            </div>
          ) : (
            <AdminSearchSelect
              label="Seleccionar Usuario Propietario"
              required
              clearable={false}
              placeholder="Buscar usuario de negocio..."
              searchPlaceholder="Buscar por nombre o correo electrónico..."
              value={selectedOwnerUserId}
              onChange={(val) => setValue("ownerUserId", val || "", { shouldValidate: true })}
              options={candidateOwners.map((u) => ({
                value: u.id,
                label: u.fullName,
                description: u.email,
                icon: <User className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />,
              }))}
              error={errors.ownerUserId?.message}
              helperText="Solo se listan usuarios registrados con rol de negocio (excluyendo personal administrativo de NEGOVA)."
            />
          )}

          {selectedOwnerUserId && candidateOwners.length > 0 && (
            <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/15 flex items-center gap-3.5 text-xs text-purple-900 dark:text-purple-200">
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white font-bold flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-semibold block truncate">
                  {candidateOwners.find((u) => u.id === selectedOwnerUserId)?.fullName || "Usuario"}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono block truncate">
                  {candidateOwners.find((u) => u.id === selectedOwnerUserId)?.email}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. UBICACIÓN Y COBERTURA */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold font-title text-slate-900 dark:text-white">
              3. Ubicación y Localización
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dirección y sede principal del negocio en Colombia.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Dirección */}
          <div className="md:col-span-2">
            <AdminInput
              label="Dirección Física"
              placeholder="Ej. Calle 10 # 5-20, Centro"
              {...register("address")}
              error={errors.address?.message}
            />
          </div>

          {/* Departamento */}
          <div>
            <AdminSearchSelect
              label="Departamento"
              required
              placeholder="Seleccionar departamento..."
              searchPlaceholder="Buscar departamento..."
              options={getDepartmentOptions()}
              value={selectedDepartment}
              onChange={handleDepartmentChange}
              error={errors.department?.message}
            />
          </div>

          {/* Ciudad / Municipio filtrado */}
          <div>
            <AdminSearchSelect
              label="Ciudad / Municipio"
              required
              placeholder={
                selectedDepartment
                  ? "Seleccionar municipio..."
                  : "Primero selecciona un departamento"
              }
              searchPlaceholder="Buscar municipio..."
              options={getCitiesOptions(selectedDepartment)}
              value={selectedCity}
              onChange={(val) => setValue("city", val || "", { shouldValidate: true })}
              disabled={!selectedDepartment}
              error={errors.city?.message}
            />
          </div>
        </div>
      </div>

      {/* 3. PLAN Y ESTADO INICIAL */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold font-title text-slate-900 dark:text-white">
              4. Plan Comercial y Estado Inicial
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configura el tier comercial con límites canónicos de NEGOVA.
            </p>
          </div>
        </div>

        {/* SELECCIÓN DE PLAN */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Plan Comercial Asignado:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {plans.map((p) => {
              const isSelected = selectedPlanId === p.id;
              const priceFormatted = selectedBillingInterval === "annual"
                ? `${p.pricing.annualMonthlyFormatted} / mes`
                : `${p.pricing.monthlyFormatted} / mes`;

              return (
                <div
                  key={p.id}
                  onClick={() => setValue("planId", p.id as PlanId)}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative ${
                    isSelected
                      ? "bg-orange-50/70 dark:bg-[#ED500A]/10 border-[#ED500A] shadow-xs"
                      : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
                  }`}
                >
                  {p.isRecommended && (
                    <span className="absolute right-3 top-3 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#ED500A] text-white">
                      MÁS ELEGIDO
                    </span>
                  )}
                  <h3 className="text-sm font-bold font-title text-slate-900 dark:text-white">{p.name}</h3>
                  <p className="text-xs font-mono font-semibold text-[#ED500A] mt-1">{priceFormatted}</p>
                  <ul className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5 space-y-1">
                    <li>• Hasta {p.limits.maxUsers} usuario(s)</li>
                    <li>• Hasta {p.limits.maxProducts} productos</li>
                    <li>• {p.limits.canUseAiAssistant ? "Asistente IA incluido" : "Sin IA"}</li>
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* MODALIDAD DE FACTURACIÓN */}
        <div className="space-y-3 pt-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Modalidad de Facturación:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
            <button
              type="button"
              onClick={() => setValue("billingInterval", "monthly")}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedBillingInterval === "monthly"
                  ? "bg-orange-50 dark:bg-orange-500/10 border-[#ED500A] text-slate-900 dark:text-white"
                  : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Mensual</span>
                <span className="text-[11px] font-mono text-[#ED500A] font-semibold">Por meses</span>
              </div>
              <p className="text-[11px] opacity-75 mt-1">Contratación y liquidación en base mensual.</p>
            </button>

            <button
              type="button"
              onClick={() => setValue("billingInterval", "annual")}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedBillingInterval === "annual"
                  ? "bg-orange-50 dark:bg-orange-500/10 border-[#ED500A] text-slate-900 dark:text-white"
                  : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">Anual</span>
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">Por años</span>
              </div>
              <p className="text-[11px] opacity-75 mt-1">Contratación y liquidación en base anual.</p>
            </button>
          </div>
        </div>

        {/* CANTIDAD CONTRATADA Y FECHA DE INICIO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
          {/* Cantidad Contratada */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {selectedBillingInterval === "annual" ? "Cantidad de Años Contratados:" : "Cantidad de Meses Contratados:"}
              </label>
              <span className="text-xs font-mono font-bold text-[#ED500A]">
                {formatVigenciaDuration(
                  selectedBillingInterval,
                  selectedBillingInterval === "annual"
                    ? Number(selectedContractDuration) * 12
                    : Number(selectedContractDuration)
                )}
              </span>
            </div>
            <AdminInput
              type="number"
              min={1}
              max={120}
              {...register("contractDuration", { valueAsNumber: true })}
              error={errors.contractDuration?.message}
              placeholder={selectedBillingInterval === "annual" ? "Ej. 1, 2, 3..." : "Ej. 1, 2, 3, 6..."}
            />
            {/* Presets rápidos */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {selectedBillingInterval === "monthly" ? (
                [1, 2, 3, 6].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setValue("contractDuration", qty, { shouldValidate: true })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                      Number(selectedContractDuration) === qty
                        ? "bg-[#ED500A] text-white font-bold"
                        : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
                    }`}
                  >
                    {qty} {qty === 1 ? "mes" : "meses"}
                  </button>
                ))
              ) : (
                [1, 2, 3, 5].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setValue("contractDuration", qty, { shouldValidate: true })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                      Number(selectedContractDuration) === qty
                        ? "bg-[#ED500A] text-white font-bold"
                        : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
                    }`}
                  >
                    {qty} {qty === 1 ? "año" : "años"}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Fecha de Inicio */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Fecha de Inicio del Plan:
            </label>
            <AdminInput
              type="date"
              {...register("startDate")}
              error={errors.startDate?.message}
              helperText="Fecha a partir de la cual inicia la vigencia."
            />
          </div>
        </div>

        {/* ESTADO OPERACIONAL INICIAL */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Estado Operacional Inicial:
          </label>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <button
              type="button"
              onClick={() => setValue("status", "trial")}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedStatus === "trial"
                  ? "bg-amber-50 dark:bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400 font-semibold"
                  : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
              }`}
            >
              <p className="text-xs font-bold">En Prueba (Trial)</p>
              <p className="text-[10px] opacity-80 mt-0.5">30 días de evaluación gratuita</p>
            </button>
            <button
              type="button"
              onClick={() => setValue("status", "active")}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedStatus === "active"
                  ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-semibold"
                  : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
              }`}
            >
              <p className="text-xs font-bold">Activo Inmediato</p>
              <p className="text-[10px] opacity-80 mt-0.5">Operación contratada activa</p>
            </button>
          </div>
        </div>

        {/* PREVIEW EN VIVO DE VIGENCIA */}
        {(() => {
          const qty = Math.max(1, Number(selectedContractDuration) || 1);
          const { startDate: periodStartDate, endDate: periodEndDate, durationFormatted } = calculatePeriodDates(
            selectedStartDate || todayStr,
            selectedBillingInterval,
            qty
          );

          const trialDays = NEGOVA_PLANS[selectedPlanId]?.trialDays || 30;
          const trialEndDateObj = new Date(selectedStartDate || todayStr);
          trialEndDateObj.setDate(trialEndDateObj.getDate() + trialDays);
          const trialEndDate = trialEndDateObj.toISOString();

          const activeTargetDate = selectedStatus === "trial" ? trialEndDate : periodEndDate;
          const dynamicRemainingDays = calculateRemainingDays(activeTargetDate);
          const dynamicBadge = getVigenciaStatusBadge(dynamicRemainingDays, selectedStatus, selectedStatus === "trial");

          return (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.06] pb-2.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Resumen de Vigencia de la Suscripción
                </span>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#ED500A]/10 text-[#ED500A] font-bold">
                  {selectedStatus === "trial" ? `${trialDays} días de prueba` : durationFormatted}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Plan</span>
                  <span className="font-bold text-slate-900 dark:text-white capitalize">
                    {NEGOVA_PLANS[selectedPlanId]?.name || selectedPlanId}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Modalidad</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {selectedBillingInterval === "annual" ? "Anual" : "Mensual"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Fecha de Inicio</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                    {formatVigenciaDate(periodStartDate)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">
                    {selectedStatus === "trial" ? "Fin de Prueba" : "Fecha de Vencimiento"}
                  </span>
                  <span className="font-mono text-[#ED500A] font-bold">
                    {formatVigenciaDate(activeTargetDate)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Días Restantes</span>
                  <span className={`font-mono font-bold ${dynamicBadge.color}`}>
                    {dynamicRemainingDays > 0 ? `${dynamicRemainingDays} días` : "0 días (Hoy)"}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* BOTONES DE ACCIÓN */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
        <AdminButton
          variant="ghost"
          size="md"
          disabled={isPending}
          onClick={() => router.push("/admin/negocios")}
        >
          Cancelar
        </AdminButton>
        <AdminButton
          type="submit"
          variant="primary"
          size="md"
          isLoading={isPending}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          {isPending ? "Registrando Tenant..." : "Registrar Negocio"}
        </AdminButton>
      </div>
    </form>
  );
}
