"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Plus,
  Minus,
  DollarSign,
  Calendar,
  Building2,
  FileText,
  User,
  CreditCard,
  Banknote,
  Landmark,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Receipt,
  Sparkles,
  Info,
  CircleDot,
  Check,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { toast } from "sonner";
import { formatCOP } from "@/config/plans";
import {
  MovementFlow,
  ExpenseType,
  UnifiedMovement,
  CreateMovementInput,
  OPERATIONAL_CATEGORIES,
  PRODUCTION_CATEGORIES,
  INCOME_TYPES,
  IncomeType,
  INCOME_CATEGORIES,
} from "@/lib/expenses/types";
import {
  createUnifiedMovementAction,
  getActiveCashSessionForMovementsAction,
} from "./actions";

interface Props {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (movement: UnifiedMovement) => void;
  suppliers?: Array<{ id: string; name: string }>;
  defaultFlow?: MovementFlow;
}

export function MovementFormModal({
  businessId,
  isOpen,
  onClose,
  onSuccess,
  suppliers = [],
  defaultFlow = "expense",
}: Props) {
  // 1. SELECTOR PRINCIPAL: [ 🔴 Registrar Egreso / Gasto ] vs [ 🟢 Registrar Ingreso Vario ]
  const [flow, setFlow] = useState<MovementFlow>(defaultFlow);

  // 2. CAMPOS COMUNES / DETALLE
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState<string>("");

  // Categorías personalizadas creadas al vuelo
  const [customOperationalCategories, setCustomOperationalCategories] = useState<string[]>([]);
  const [customProductionCategories, setCustomProductionCategories] = useState<string[]>([]);
  const [customIncomeCategories, setCustomIncomeCategories] = useState<string[]>([]);

  // Estado para creación de categoría al vuelo
  const [isCreatingCategory, setIsCreatingCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>("");

  // 3. CAMPOS ESPECÍFICOS DE EGRESO
  // Tipo de gasto: Operativo (arriendo, servicios, nómina, aseo) vs Producción (insumos menores)
  const [expenseType, setExpenseType] = useState<ExpenseType>("operational");
  const [paymentMethod, setPaymentMethod] = useState<string>("efectivo");
  const [thirdPartyType, setThirdPartyType] = useState<"supplier" | "manual">("manual");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [manualSupplierName, setManualSupplierName] = useState<string>("");
  const [receiptNumber, setReceiptNumber] = useState<string>("");
  const [deductFromCashRegister, setDeductFromCashRegister] = useState<boolean>(true);

  // 4. CAMPOS ESPECÍFICOS DE INGRESO
  // Tipo de ingreso: Aporte de capital, Préstamo, Venta extraordinaria, Devolución de proveedor, Otro ingreso
  const [incomeType, setIncomeType] = useState<IncomeType>("Aporte de capital");
  // Destino de fondos: Efectivo vs Cuenta bancaria / Transferencia vs Otro
  const [fundDestination, setFundDestination] = useState<"efectivo" | "transferencia" | "otro">("efectivo");
  const [incomeThirdParty, setIncomeThirdParty] = useState<string>("");
  const [incomeVoucherNumber, setIncomeVoucherNumber] = useState<string>("");
  const [addToCashRegister, setAddToCashRegister] = useState<boolean>(true);

  // 5. ESTADO DE TURNO DE CAJA ACTIVO Y SUBMIT
  const [activeSession, setActiveSession] = useState<{
    id: string;
    registerId?: string;
    status: string;
  } | null>(null);
  const [isCheckingCash, setIsCheckingCash] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Cargar si existe turno activo de caja al abrir el modal
  useEffect(() => {
    if (isOpen) {
      let isMounted = true;
      setIsCheckingCash(true);
      getActiveCashSessionForMovementsAction(businessId)
        .then((res) => {
          if (isMounted && res.success) {
            setActiveSession(
              res.session
                ? {
                    id: res.session.id,
                    registerId: res.session.registerId,
                    status: res.session.status,
                  }
                : null
            );
          }
        })
        .catch(() => {
          if (isMounted) setActiveSession(null);
        })
        .finally(() => {
          if (isMounted) setIsCheckingCash(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, businessId]);

  // Restablecer valores iniciales cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setFlow(defaultFlow);
      setAmount("");
      setDescription("");
      setDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setExpenseType("operational");
      setCategory("Arriendo");
      setPaymentMethod("efectivo");
      setThirdPartyType("manual");
      setSelectedSupplierId("");
      setManualSupplierName("");
      setReceiptNumber("");
      setDeductFromCashRegister(true);

      setIncomeType("Aporte de capital");
      setFundDestination("efectivo");
      setIncomeThirdParty("");
      setIncomeVoucherNumber("");
      setAddToCashRegister(true);
      setIsCreatingCategory(false);
      setNewCategoryName("");
    }
  }, [isOpen, defaultFlow]);

  // Actualizar categoría por defecto al cambiar flujo o tipo de gasto/ingreso
  useEffect(() => {
    if (flow === "expense") {
      if (expenseType === "operational") {
        setCategory(OPERATIONAL_CATEGORIES[0] || "Arriendo");
      } else {
        setCategory(PRODUCTION_CATEGORIES[0] || "Insumos Menores");
      }
    } else {
      // Si es ingreso, sincronizar la categoría recomendada con el tipo de ingreso
      switch (incomeType) {
        case "Aporte de capital":
          setCategory("Aportes de Capital");
          break;
        case "Préstamo":
          setCategory("Préstamos y Créditos");
          break;
        case "Venta extraordinaria (ej. aceite reciclado/chatarra)":
          setCategory("Venta Extraordinaria / Reciclaje");
          break;
        case "Devolución de proveedor":
          setCategory("Devoluciones de Proveedores");
          break;
        default:
          setCategory("Otros Ingresos");
          break;
      }
    }
  }, [flow, expenseType, incomeType]);

  // Lista combinada de categorías según el flujo actual
  const currentCategories = useMemo(() => {
    if (flow === "expense") {
      return expenseType === "operational"
        ? [...OPERATIONAL_CATEGORIES, ...customOperationalCategories]
        : [...PRODUCTION_CATEGORIES, ...customProductionCategories];
    }
    return [...INCOME_CATEGORIES, ...customIncomeCategories];
  }, [
    flow,
    expenseType,
    customOperationalCategories,
    customProductionCategories,
    customIncomeCategories,
  ]);

  if (!isOpen) return null;

  // Manejo de creación de categoría al vuelo
  const handleAddCustomCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCategoryName.trim();
    if (!cleanName) {
      toast.error("Ingresa el nombre de la categoría.");
      return;
    }

    if (currentCategories.some((c) => c.toLowerCase() === cleanName.toLowerCase())) {
      toast.info("Esta categoría ya existe en la lista.");
      setCategory(cleanName);
      setIsCreatingCategory(false);
      setNewCategoryName("");
      return;
    }

    if (flow === "expense") {
      if (expenseType === "operational") {
        setCustomOperationalCategories((prev) => [...prev, cleanName]);
      } else {
        setCustomProductionCategories((prev) => [...prev, cleanName]);
      }
    } else {
      setCustomIncomeCategories((prev) => [...prev, cleanName]);
    }

    setCategory(cleanName);
    setIsCreatingCategory(false);
    setNewCategoryName("");
    toast.success(`Categoría "${cleanName}" agregada.`);
  };

  // Cálculo del monto numérico para el resumen
  const numericAmount = parseFloat(amount) || 0;

  // Validación y envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      toast.error("La descripción del movimiento es obligatoria.");
      return;
    }

    if (numericAmount <= 0) {
      toast.error("El monto debe ser un valor positivo mayor a $0.");
      return;
    }

    if (!category.trim()) {
      toast.error("Debes seleccionar o crear una categoría.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (flow === "expense") {
        // EGRESO
        let finalThirdParty = manualSupplierName.trim();
        let finalSupplierId: string | null = null;

        if (thirdPartyType === "supplier" && selectedSupplierId) {
          finalSupplierId = selectedSupplierId;
          const found = suppliers.find((s) => s.id === selectedSupplierId);
          if (found) finalThirdParty = found.name;
        }

        const isCashExpense = paymentMethod === "efectivo" || paymentMethod === "cash";

        const payload: CreateMovementInput = {
          flow: "expense",
          concept: description.trim(),
          description: description.trim(),
          amount: numericAmount,
          category,
          expenseType,
          date: new Date(date).toISOString(),
          paymentMethod,
          receiptNumber: receiptNumber.trim() || undefined,
          thirdPartyName: finalThirdParty || undefined,
          supplierId: finalSupplierId || undefined,
          notes: notes.trim() || undefined,
          deductFromCashRegister: isCashExpense ? deductFromCashRegister : false,
        };

        const res = await createUnifiedMovementAction(businessId, payload);
        if (!res.success || !res.data) {
          toast.error("Error al registrar egreso", {
            description: res.error || "Verifica los datos e intenta de nuevo.",
          });
          return;
        }

        toast.success(`Egreso registrado: -${formatCOP(numericAmount)}`, {
          description: isCashExpense && deductFromCashRegister
            ? "Monto descontado de la caja activa para cuadre de arqueo."
            : "Movimiento contable guardado exitosamente.",
        });

        onSuccess(res.data);
        onClose();
      } else {
        // INGRESO
        const isCashIncome = fundDestination === "efectivo";

        const payload: CreateMovementInput = {
          flow: "income",
          concept: description.trim(),
          description: description.trim(),
          amount: numericAmount,
          category,
          incomeType,
          date: new Date(date).toISOString(),
          paymentMethod: isCashIncome ? "efectivo" : fundDestination,
          receiptNumber: incomeVoucherNumber.trim() || undefined,
          thirdPartyName: incomeThirdParty.trim() || undefined,
          notes: notes.trim() || undefined,
          deductFromCashRegister: isCashIncome ? addToCashRegister : false,
        };

        const res = await createUnifiedMovementAction(businessId, payload);
        if (!res.success || !res.data) {
          toast.error("Error al registrar ingreso", {
            description: res.error || "Verifica los datos e intenta de nuevo.",
          });
          return;
        }

        toast.success(`Ingreso registrado: +${formatCOP(numericAmount)}`, {
          description: isCashIncome && addToCashRegister
            ? "Monto sumado al efectivo de la caja activa para arqueo."
            : "Ingreso bancario/digital registrado exitosamente.",
        });

        onSuccess(res.data);
        onClose();
      }
    } catch (err: any) {
      toast.error("Error inesperado al guardar el movimiento.", {
        description: err?.message || "Ocurrió un error en el servidor.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
          {/* ================================================================= */}
          {/* CABECERA DEL MODAL                                                */}
          {/* ================================================================= */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl border ${
                  flow === "expense"
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                }`}
              >
                {flow === "expense" ? (
                  <ArrowUpRight className="w-5 h-5" />
                ) : (
                  <ArrowDownLeft className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {flow === "expense"
                    ? "Registrar Egreso / Gasto"
                    : "Registrar Ingreso Vario"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Gestiona movimientos de dinero con impacto en caja activa y reportes financieros.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ================================================================= */}
          {/* SELECTOR PRINCIPAL: PESTAÑAS DESTACADAS                          */}
          {/* [ 🔴 Registrar Egreso / Gasto ] vs [ 🟢 Registrar Ingreso Vario ] */}
          {/* ================================================================= */}
          <div className="px-6 pt-4 pb-2 border-b border-border/60 bg-muted/10">
            <div className="grid grid-cols-2 gap-3 p-1 bg-muted/50 rounded-xl border border-border">
              {/* Pestaña: Registrar Egreso / Gasto */}
              <button
                type="button"
                onClick={() => setFlow("expense")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  flow === "expense"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/20 ring-1 ring-rose-500"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                }`}
              >
                <span className="text-sm">🔴</span>
                <span>Registrar Egreso / Gasto</span>
              </button>

              {/* Pestaña: Registrar Ingreso Vario */}
              <button
                type="button"
                onClick={() => setFlow("income")}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  flow === "income"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 ring-1 ring-emerald-500"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                }`}
              >
                <span className="text-sm">🟢</span>
                <span>Registrar Ingreso Vario</span>
              </button>
            </div>
          </div>

          {/* ================================================================= */}
          {/* CUERPO DEL FORMULARIO                                             */}
          {/* ================================================================= */}
          <form
            onSubmit={handleSubmit}
            className="p-6 space-y-4 overflow-y-auto flex-1 text-xs"
          >
            {/* ------------------------------------------------------------- */}
            {/* FLUJO EGRESO: TIPO DE GASTO (OPERATIVO vs PRODUCCIÓN)          */}
            {/* ------------------------------------------------------------- */}
            {flow === "expense" && (
              <div className="space-y-1.5 p-3.5 rounded-xl bg-muted/20 border border-border">
                <label className="block text-xs font-bold text-foreground">
                  Tipo de Gasto <span className="text-rose-500 font-bold">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Tarjeta: Operativo */}
                  <button
                    type="button"
                    onClick={() => setExpenseType("operational")}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      expenseType === "operational"
                        ? "bg-rose-500/10 border-rose-500 text-foreground ring-1 ring-rose-500/30 shadow-xs"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-rose-500" />
                        Gasto Operativo
                      </span>
                      {expenseType === "operational" && (
                        <Check className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Arriendo, servicios públicos, nómina, aseo, marketing y mantenimiento.
                    </p>
                  </button>

                  {/* Tarjeta: Producción */}
                  <button
                    type="button"
                    onClick={() => setExpenseType("production")}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      expenseType === "production"
                        ? "bg-amber-500/10 border-amber-500 text-foreground ring-1 ring-amber-500/30 shadow-xs"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Costo de Producción
                      </span>
                      {expenseType === "production" && (
                        <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Insumos menores, compras imprevistas de cocina, materia prima o empaques.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* FLUJO INGRESO: TIPO DE INGRESO (PILLS / BOTONES SELECCIONABLES)*/}
            {/* ------------------------------------------------------------- */}
            {flow === "income" && (
              <div className="space-y-1.5 p-3.5 rounded-xl bg-muted/20 border border-border">
                <label className="block text-xs font-bold text-foreground">
                  Tipo de Ingreso <span className="text-emerald-500 font-bold">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {INCOME_TYPES.map((type) => {
                    const isSelected = incomeType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setIncomeType(type)}
                        className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/40 shadow-xs"
                            : "border-border text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        <span className="line-clamp-2 leading-tight">{type}</span>
                        {isSelected && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Seleccionado
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* SECCIÓN DETALLE: MONTO (*), DESCRIPCIÓN (*), CATEGORÍA (*), FECHA (*) */}
            {/* ------------------------------------------------------------- */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Monto (*) */}
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Monto ($ COP) <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">
                    $
                  </span>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono text-right font-bold shadow-xs"
                  />
                </div>
              </div>

              {/* Fecha (*) */}
              <div className="sm:col-span-7">
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Fecha del Movimiento <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* Descripción (*) */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Descripción / Concepto <span className="text-red-500 font-bold">*</span>
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  flow === "expense"
                    ? expenseType === "operational"
                      ? "Ej: Pago de recibo de energía de la sede principal, arriendo de local..."
                      : "Ej: Compra de cilantro de urgencia en la tienda de barrio, bolsas plásticas..."
                    : incomeType === "Aporte de capital"
                    ? "Ej: Aporte inicial de capital socio Carlos para remodelación..."
                    : incomeType === "Préstamo"
                    ? "Ej: Desembolso crédito de tesorería Banco de Bogotá..."
                    : incomeType === "Venta extraordinaria (ej. aceite reciclado/chatarra)"
                    ? "Ej: Venta de 15 canecas de aceite vegetal usado a empresa recolectora..."
                    : incomeType === "Devolución de proveedor"
                    ? "Ej: Reembolso en efectivo por insumos devueltos defectuosos..."
                    : "Ej: Ingreso por arriendo temporal de espacio publicitario en fachada..."
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
              />
            </div>

            {/* Categoría (*) con botón '+' para crear categorías al vuelo */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  Categoría <span className="text-red-500 font-bold">*</span>
                </label>
                {!isCreatingCategory && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingCategory(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    title="Crear categoría al vuelo"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nueva categoría al vuelo</span>
                  </button>
                )}
              </div>

              {/* Sub-formulario en línea para crear categoría al vuelo */}
              {isCreatingCategory ? (
                <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-[11px] font-bold text-primary">
                    <span>Crear nueva categoría para {flow === "expense" ? "egresos" : "ingresos"}</span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingCategory(false)}
                      className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Ej: Suscripciones de Software, Aseo y Cafetería..."
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCustomCategory(e);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomCategory}
                      className="px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
                  >
                    {currentCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setIsCreatingCategory(true)}
                    className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Crear categoría al vuelo"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* SI ES EGRESO: PAGO (MEDIO, PROVEEDOR, N° RECIBO, CAJA ACTIVA)  */}
            {/* ------------------------------------------------------------- */}
            {flow === "expense" && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Medio de Pago */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Medio de Pago <span className="text-red-500 font-bold">*</span>
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPaymentMethod(val);
                        if (val === "efectivo") {
                          setDeductFromCashRegister(true);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
                    >
                      <option value="efectivo">💵 Efectivo (Caja Registradora)</option>
                      <option value="transferencia">🏦 Transferencia Bancaria</option>
                      <option value="tarjeta">💳 Tarjeta Débito / Crédito</option>
                      <option value="otro">📄 Otro medio</option>
                    </select>
                  </div>

                  {/* N° de Recibo opcional */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      N° de Recibo / Factura <span className="text-muted-foreground font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={receiptNumber}
                      onChange={(e) => setReceiptNumber(e.target.value)}
                      placeholder="Ej: REC-00921, FAC-102"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs font-mono"
                    />
                  </div>
                </div>

                {/* Proveedor Opcional */}
                <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">
                      Proveedor / Beneficiario <span className="text-muted-foreground font-normal">(Opcional)</span>
                    </label>
                    {suppliers.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setThirdPartyType("manual")}
                          className={`px-2 py-0.5 rounded cursor-pointer ${
                            thirdPartyType === "manual"
                              ? "bg-primary text-primary-foreground font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Texto libre
                        </button>
                        <button
                          type="button"
                          onClick={() => setThirdPartyType("supplier")}
                          className={`px-2 py-0.5 rounded cursor-pointer ${
                            thirdPartyType === "supplier"
                              ? "bg-primary text-primary-foreground font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Proveedor registrado
                        </button>
                      </div>
                    )}
                  </div>

                  {thirdPartyType === "supplier" && suppliers.length > 0 ? (
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
                    >
                      <option value="">-- Seleccionar proveedor del catálogo --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={manualSupplierName}
                        onChange={(e) => setManualSupplierName(e.target.value)}
                        placeholder="Ej: EPM, Claro, Distribuidora San Juan, Doña María..."
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                      />
                    </div>
                  )}
                </div>

                {/* Si es Efectivo: Descuenta automáticamente del saldo de la caja activa */}
                {paymentMethod === "efectivo" && (
                  <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-2">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={deductFromCashRegister}
                        onChange={(e) => setDeductFromCashRegister(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-rose-600 focus:ring-rose-500 border-border"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-foreground block">
                          Descontar automáticamente del saldo de la caja activa en el turno para el arqueo
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          Genera un movimiento de salida de efectivo vinculado al turno abierto para que el conteo de dinero físico coincida exactamente al momento del cierre de caja.
                        </p>
                      </div>
                    </label>

                    {/* Estado de detección del turno */}
                    <div className="pt-1.5 border-t border-rose-500/10 flex items-center gap-2 text-[11px]">
                      {isCheckingCash ? (
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" /> Verificando turnos de caja...
                        </span>
                      ) : activeSession ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Turno de caja abierto detectado. Se descontará automáticamente.
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5" />
                          No hay turnos de caja abiertos actualmente. El egreso se registrará contablemente.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* SI ES INGRESO: DESTINO DE FONDOS, TERCERO Y COMPROBANTE       */}
            {/* ------------------------------------------------------------- */}
            {flow === "income" && (
              <div className="space-y-3 pt-2">
                {/* Destino de fondos: Efectivo vs Cuenta bancaria */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Destino de los Fondos <span className="text-red-500 font-bold">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Efectivo */}
                    <button
                      type="button"
                      onClick={() => setFundDestination("efectivo")}
                      className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        fundDestination === "efectivo"
                          ? "bg-emerald-500/10 border-emerald-500 text-foreground ring-1 ring-emerald-500/30 shadow-xs"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                          <Wallet className="w-3.5 h-3.5 text-emerald-500" />
                          Efectivo (Caja Física)
                        </span>
                        {fundDestination === "efectivo" && (
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        Suma directamente al saldo físico de la caja activa en el turno para el arqueo.
                      </p>
                    </button>

                    {/* Cuenta Bancaria / Transferencia */}
                    <button
                      type="button"
                      onClick={() => setFundDestination("transferencia")}
                      className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        fundDestination === "transferencia"
                          ? "bg-blue-500/10 border-blue-500 text-foreground ring-1 ring-blue-500/30 shadow-xs"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                          <Landmark className="w-3.5 h-3.5 text-blue-500" />
                          Cuenta Bancaria / Transferencia
                        </span>
                        {fundDestination === "transferencia" && (
                          <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        Ingresa a la cuenta financiera de la empresa sin alterar el efectivo físico de la caja.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Si destino es Efectivo: Banner verde con checkbox de suma a caja */}
                {fundDestination === "efectivo" && (
                  <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={addToCashRegister}
                        onChange={(e) => setAddToCashRegister(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-border"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-foreground block">
                          Suma automáticamente al saldo físico de la caja activa en el turno para el arqueo
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          Registra una entrada de efectivo en el turno abierto para que el cajero rinda cuentas de este ingreso al cerrar turno.
                        </p>
                      </div>
                    </label>

                    {/* Estado de detección del turno */}
                    <div className="pt-1.5 border-t border-emerald-500/10 flex items-center gap-2 text-[11px]">
                      {isCheckingCash ? (
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" /> Verificando turnos de caja...
                        </span>
                      ) : activeSession ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          Turno de caja abierto detectado. Se sumará al arqueo del turno.
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5" />
                          No hay turnos de caja abiertos actualmente. El ingreso se registrará contablemente.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Tercero Asociado y N° de Comprobante */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Tercero Asociado <span className="text-muted-foreground font-normal">(Opcional)</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={incomeThirdParty}
                        onChange={(e) => setIncomeThirdParty(e.target.value)}
                        placeholder="Ej: Socio Pedro, Banco, Comprador de chatarra..."
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      N° Comprobante / Recibo <span className="text-muted-foreground font-normal">(Opcional)</span>
                    </label>
                    <div className="relative">
                      <Receipt className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={incomeVoucherNumber}
                        onChange={(e) => setIncomeVoucherNumber(e.target.value)}
                        placeholder="Ej: COMP-0012, TRANS-991"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notas opcionales */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Notas y Justificación <span className="text-muted-foreground font-normal">(Opcional)</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Soporte físico archivado en carpeta contable, aprobado por administración..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none shadow-xs"
              />
            </div>

            {/* ============================================================= */}
            {/* RESUMEN AL PIE                                                */}
            {/* ============================================================= */}
            <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Resumen del Movimiento:
                </span>
                <span
                  className={`font-mono font-bold text-sm ${
                    flow === "expense"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {flow === "expense" ? "-" : "+"}
                  {formatCOP(numericAmount)}
                </span>
              </div>

              <div className="text-[11px] text-muted-foreground space-y-1">
                <div className="flex items-center justify-between">
                  <span>Clasificación:</span>
                  <span className="font-semibold text-foreground">
                    {flow === "expense"
                      ? `${expenseType === "operational" ? "Operativo" : "Producción"} • ${category || "Sin categoría"}`
                      : `${incomeType} • ${category || "Sin categoría"}`}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Impacto en Caja Activa:</span>
                  <span
                    className={`font-semibold ${
                      flow === "expense"
                        ? paymentMethod === "efectivo" && deductFromCashRegister
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-muted-foreground"
                        : fundDestination === "efectivo" && addToCashRegister
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {flow === "expense"
                      ? paymentMethod === "efectivo" && deductFromCashRegister
                        ? `Descuenta ${formatCOP(numericAmount)} de la caja activa (afecta arqueo)`
                        : `No afecta efectivo físico (${paymentMethod})`
                      : fundDestination === "efectivo" && addToCashRegister
                      ? `Suma ${formatCOP(numericAmount)} al efectivo de la caja activa (afecta arqueo)`
                      : "Registrado en bancos (no altera el saldo físico de caja)"}
                  </span>
                </div>
              </div>
            </div>

            {/* ============================================================= */}
            {/* BOTONES: CANCELAR Y REGISTRAR MOVIMIENTO                       */}
            {/* ============================================================= */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !description.trim() || numericAmount <= 0}
                className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl text-white transition-all shadow-md disabled:opacity-50 cursor-pointer ${
                  flow === "expense"
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando movimiento...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Registrar movimiento</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
