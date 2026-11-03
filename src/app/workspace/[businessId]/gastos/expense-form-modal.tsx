"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  DollarSign,
  Calendar,
  Building2,
  Factory,
  Package,
  Layers,
  CreditCard,
  FileText,
  User,
  Plus,
  Info,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { toast } from "sonner";
import {
  ExpenseItem,
  ExpenseType,
  CreateExpenseInput,
  PRODUCTION_CATEGORIES,
  OPERATIONAL_CATEGORIES,
} from "@/lib/expenses/types";
import {
  createExpenseAction,
  updateExpenseAction,
  getSuppliersAndProductsForExpensesAction,
} from "./actions";

interface ExpenseFormModalProps {
  isOpen: boolean;
  businessId: string;
  expenseToEdit?: ExpenseItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ExpenseFormModal({
  isOpen,
  businessId,
  expenseToEdit,
  onClose,
  onSuccess,
}: ExpenseFormModalProps) {
  const isEditing = Boolean(expenseToEdit);

  const [expenseType, setExpenseType] = useState<ExpenseType>("operational");
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("Otros Operativos");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  // Opciones de producción
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [updateProductCost, setUpdateProductCost] = useState(false);

  // Listados auxiliares
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; cost?: number }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Cargar proveedores y productos
    getSuppliersAndProductsForExpensesAction(businessId).then((res) => {
      if (res.success) {
        setSuppliers(res.suppliers || []);
        setProducts(res.products || []);
      }
    });

    if (expenseToEdit) {
      setExpenseType(expenseToEdit.expenseType || "operational");
      setConcept(expenseToEdit.concept || "");
      setAmount(String(expenseToEdit.amount || ""));
      setCategory(expenseToEdit.category || "Otros Operativos");
      setExpenseDate(
        expenseToEdit.expenseDate
          ? new Date(expenseToEdit.expenseDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      setPaymentMethod(expenseToEdit.paymentMethod || "efectivo");
      setReceiptNumber(expenseToEdit.receiptNumber || "");
      setDescription(expenseToEdit.description || "");
      setNotes(expenseToEdit.notes || "");
      setSupplierId(expenseToEdit.supplierId || "");
      setProductId(expenseToEdit.productId || "");
      setQuantity(expenseToEdit.quantity ? String(expenseToEdit.quantity) : "");
      setUnitCost(expenseToEdit.unitCost ? String(expenseToEdit.unitCost) : "");
      setUpdateProductCost(Boolean(expenseToEdit.updateProductCost));
    } else {
      setExpenseType("operational");
      setConcept("");
      setAmount("");
      setCategory(OPERATIONAL_CATEGORIES[0]);
      setExpenseDate(new Date().toISOString().split("T")[0]);
      setPaymentMethod("efectivo");
      setReceiptNumber("");
      setDescription("");
      setNotes("");
      setSupplierId("");
      setProductId("");
      setQuantity("");
      setUnitCost("");
      setUpdateProductCost(false);
    }
  }, [isOpen, expenseToEdit, businessId]);

  // Al cambiar tipo de gasto, sincronizar categoría por defecto
  const handleTypeChange = (type: ExpenseType) => {
    setExpenseType(type);
    if (type === "production") {
      setCategory(PRODUCTION_CATEGORIES[0]);
    } else {
      setCategory(OPERATIONAL_CATEGORIES[0]);
      setProductId("");
      setUpdateProductCost(false);
    }
  };

  // Cálculo dinámico de costo unitario sugerido si cambia monto o cantidad
  const handleAmountOrQuantityChange = (newAmount: string, newQty: string) => {
    const numAmt = Number(newAmount);
    const numQty = Number(newQty);
    if (numAmt > 0 && numQty > 0) {
      setUnitCost(String(Math.round(numAmt / numQty)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanConcept = concept.trim();
    if (!cleanConcept) {
      toast.error("Por favor ingresa un concepto o descripción del gasto.");
      return;
    }

    const cleanAmount = Number(amount);
    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
      toast.error("Ingresa un monto de gasto válido mayor a $0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateExpenseInput = {
        concept: cleanConcept,
        amount: cleanAmount,
        category,
        expenseType,
        description: description.trim() || undefined,
        expenseDate: new Date(expenseDate).toISOString(),
        paymentMethod,
        receiptNumber: receiptNumber.trim() || undefined,
        supplierId: supplierId || null,
        productId: expenseType === "production" && productId ? productId : null,
        quantity: quantity ? Number(quantity) : null,
        unitCost: unitCost ? Number(unitCost) : null,
        updateProductCost: expenseType === "production" && Boolean(updateProductCost),
        notes: notes.trim() || undefined,
      };

      let res;
      if (isEditing && expenseToEdit) {
        res = await updateExpenseAction(businessId, expenseToEdit.id, payload);
      } else {
        res = await createExpenseAction(businessId, payload);
      }

      if (res.success) {
        toast.success(
          isEditing
            ? "Gasto actualizado exitosamente."
            : expenseType === "production"
            ? "Gasto de producción registrado y clasificado."
            : "Gasto operativo registrado exitosamente."
        );
        onSuccess();
        onClose();
      } else {
        toast.error(res.error || "No fue posible guardar el gasto.");
      }
    } catch {
      toast.error("Error al procesar la solicitud.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-body animate-in fade-in duration-150">
        <div
          className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Encabezado */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-white/[0.06]">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isEditing ? "Editar Registro de Gasto" : "Registrar Nuevo Gasto"}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Control de egresos operativos y compras de producción / insumos.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 text-xs">
            {/* 1. Selector Visual de Tipo de Gasto */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider font-mono">
                Tipo de Gasto *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleTypeChange("operational")}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                    expenseType === "operational"
                      ? "border-[#ED500A] bg-orange-500/5 ring-1 ring-[#ED500A]"
                      : "border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      expenseType === "operational"
                        ? "bg-[#ED500A] text-white"
                        : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white">Operativo</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      Servicios, arriendo, nómina
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeChange("production")}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                    expenseType === "production"
                      ? "border-blue-600 bg-blue-500/5 ring-1 ring-blue-600"
                      : "border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      expenseType === "production"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <Factory className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white">Producción</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      Materia prima, insumos, empaques
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Categoría y Concepto */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Categoría *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]"
                >
                  {expenseType === "production"
                    ? PRODUCTION_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat} className="dark:bg-[#0D0F16]">
                          {cat}
                        </option>
                      ))
                    : OPERATIONAL_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat} className="dark:bg-[#0D0F16]">
                          {cat}
                        </option>
                      ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Monto Total ($ COP) *
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="80000"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      handleAmountOrQuantityChange(e.target.value, quantity);
                    }}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Concepto / Nombre del Gasto *
              </label>
              <input
                type="text"
                required
                placeholder={expenseType === "production" ? "Ej. Compra de queso campesino" : "Ej. Factura servicio de energía"}
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
              />
            </div>

            {/* 3. Sección Específica de Producción: Materias Primas / Ingredientes [GAS-002] */}
            {expenseType === "production" && (
              <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 space-y-3">
                <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-semibold text-[11px]">
                  <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Vinculación con Inventario de Producción</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Ítem / Ingrediente del Catálogo (Opcional)
                    </label>
                    <select
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white text-xs"
                    >
                      <option value="">-- Ninguno (Gasto libre de producción) --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.cost ? `(Costo actual: $${p.cost.toLocaleString("es-CO")})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Cantidad
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Ej. 10"
                        value={quantity}
                        onChange={(e) => {
                          setQuantity(e.target.value);
                          handleAmountOrQuantityChange(amount, e.target.value);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Costo Unitario
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="Ej. 8000"
                        value={unitCost}
                        onChange={(e) => setUnitCost(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {productId && (
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={updateProductCost}
                      onChange={(e) => setUpdateProductCost(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-[11px] font-medium text-blue-900 dark:text-blue-200">
                      Actualizar automáticamente el costo unitario de este producto en el catálogo
                    </span>
                  </label>
                )}
              </div>
            )}

            {/* 4. Medio de Pago, Fecha y Proveedor */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Fecha *
                </label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Medio de Pago *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="tarjeta">Tarjeta Débito/Crédito</option>
                  <option value="nequi">Nequi</option>
                  <option value="daviplata">Daviplata</option>
                </select>
                {paymentMethod === "efectivo" && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-mono">
                    • Se registrará como salida de efectivo en el turno de caja activo [GAS-003].
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Proveedor (Opcional)
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
                >
                  <option value="">-- Sin proveedor --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  N° Comprobante / Recibo
                </label>
                <input
                  type="text"
                  placeholder="Ej. REC-00912"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Notas u Observaciones
                </label>
                <input
                  type="text"
                  placeholder="Detalles adicionales..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-[#ED500A] hover:bg-[#D44405] text-white font-semibold shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? "Guardando..." : isEditing ? "Actualizar Gasto" : "Registrar Gasto"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

