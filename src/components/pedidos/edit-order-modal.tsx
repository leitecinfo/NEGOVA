"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  X,
  Plus,
  Minus,
  Trash2,
  Search,
  User,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShoppingBag,
  Store,
  Bike,
  Sparkles,
  Clock,
  FileText,
  Layers,
  ArrowRight,
  Receipt,
  UserCheck,
  ChevronDown,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { RestaurantOrderWithDetails } from "@/lib/restaurant/types";
import { formatCOP } from "@/config/plans";
import {
  updateRestaurantOrderAction,
  getAvailableProductsForOrderAction,
  cancelRestaurantOrderAction,
} from "@/app/workspace/[businessId]/pedidos/actions";
import { getWorkspaceStaffAction } from "@/app/workspace/[businessId]/ventas/order-actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface EditOrderModalProps {
  businessId: string;
  isOpen: boolean;
  order: RestaurantOrderWithDetails | null;
  onClose: () => void;
  onSuccess?: (updatedOrder: RestaurantOrderWithDetails) => void;
  onSave?: (updatedOrder: RestaurantOrderWithDetails) => void;
}

interface EditableItem {
  id?: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string | null;
  modifiers?: any[];
  variantId?: string | null;
  variantName?: string | null;
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
  categoryId?: string | null;
  categoryName?: string | null;
}

interface StaffOption {
  id: string;
  name: string;
  roles: string[];
}

export function EditOrderModal({
  businessId,
  isOpen,
  order,
  onClose,
  onSuccess,
  onSave,
}: EditOrderModalProps) {
  // Ítems editables
  const [items, setItems] = useState<EditableItem[]>([]);
  const [orderNotes, setOrderNotes] = useState("");

  // Responsable
  const [assignedStaffId, setAssignedStaffId] = useState<string | null>(null);
  const [assignedStaffName, setAssignedStaffName] = useState<string | null>(null);
  const [assignedStaffRole, setAssignedStaffRole] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  // Catálogo de productos para agregar
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [showAddProductSection, setShowAddProductSection] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Ítem libre
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");
  const [showCustomItemForm, setShowCustomItemForm] = useState(false);

  // Estados de envío
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // Inicializar estado al abrir o cambiar de comanda
  useEffect(() => {
    if (order && isOpen) {
      const initialItems: EditableItem[] = (order.items || []).map((it: any) => ({
        id: it.id,
        productId: it.product_id || it.productId || null,
        productName: it.product_name || it.name || "Producto",
        quantity: Math.max(1, Number(it.quantity || 1)),
        unitPrice: Number(it.unit_price || it.price || 0),
        subtotal: Number(it.subtotal || Number(it.unit_price || 0) * Number(it.quantity || 1)),
        notes: it.notes || null,
        modifiers: it.modifiers || [],
        variantId: it.variant_id || null,
        variantName: it.variant_name || null,
      }));

      setItems(initialItems.length > 0 ? initialItems : []);
      setOrderNotes(order.notes || "");
      setAssignedStaffId(order.assigned_staff_id || null);
      setAssignedStaffName(order.assigned_staff_name || null);
      setAssignedStaffRole(order.assigned_staff_role || null);
      setShowAddProductSection(false);
      setShowCustomItemForm(false);
      setProductSearch("");
    }
  }, [order, isOpen]);

  // Cargar personal y catálogo al abrir
  useEffect(() => {
    if (isOpen) {
      // Cargar personal
      setIsLoadingStaff(true);
      getWorkspaceStaffAction(businessId)
        .then((res) => {
          if (res.success && res.data) {
            setStaffList(
              res.data.map((m) => ({
                id: m.id,
                name: m.name,
                roles: m.roles || [],
              }))
            );
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingStaff(false));

      // Cargar productos vendibles
      setIsLoadingProducts(true);
      getAvailableProductsForOrderAction(businessId)
        .then((res) => {
          if (res.success && res.data) {
            setProducts(res.data);
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingProducts(false));
    }
  }, [businessId, isOpen]);

  // Totales calculados en tiempo real
  const currentSubtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.unitPrice * it.quantity), 0);
  }, [items]);

  const deliveryFee = Number(order?.delivery_fee || 0);
  const currentTotal = currentSubtotal + deliveryFee;
  const previousTotal = Number(order?.total || 0);
  const priceDifference = currentTotal - previousTotal;

  // Categorías de productos únicas
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (p.categoryId && p.categoryName) {
        map.set(p.categoryId, p.categoryName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  // Productos filtrados para agregar
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !productSearch.trim() ||
        p.name.toLowerCase().includes(productSearch.toLowerCase().trim());
      const matchCat =
        selectedCategory === "all" || p.categoryId === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [products, productSearch, selectedCategory]);

  if (!isOpen || !order) return null;

  // Manipulación de cantidades
  const handleQuantityChange = (index: number, delta: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index] };
      const newQty = target.quantity + delta;
      if (newQty < 1) return prev;
      target.quantity = newQty;
      target.subtotal = target.unitPrice * newQty;
      copy[index] = target;
      return copy;
    });
  };

  // Eliminar ítem
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.warning("El pedido debe conservar al menos un producto.", {
        description: "Si deseas cancelar la orden completa, utiliza el botón de 'Cancelar comanda'.",
      });
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    toast.info("Producto retirado de la comanda");
  };

  // Agregar producto desde el catálogo
  const handleAddProduct = (prod: ProductOption) => {
    setItems((prev) => {
      // Si ya está en la comanda, incrementar cantidad
      const existingIdx = prev.findIndex(
        (it) => it.productId === prod.id && !it.variantId && (!it.modifiers || it.modifiers.length === 0)
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        const existing = { ...copy[existingIdx] };
        existing.quantity += 1;
        existing.subtotal = existing.unitPrice * existing.quantity;
        copy[existingIdx] = existing;
        return copy;
      }

      // Nuevo ítem
      const newItem: EditableItem = {
        productId: prod.id,
        productName: prod.name,
        quantity: 1,
        unitPrice: prod.price,
        subtotal: prod.price,
        modifiers: [],
        notes: null,
      };
      return [...prev, newItem];
    });

    toast.success(`«${prod.name}» agregado a la comanda`);
  };

  // Agregar ítem libre manual
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemName.trim()) {
      toast.error("Ingresa el nombre del producto o concepto.");
      return;
    }
    const priceNum = Math.max(0, parseInt(customItemPrice.replace(/[^\d]/g, ""), 10) || 0);

    const newItem: EditableItem = {
      productId: null,
      productName: customItemName.trim(),
      quantity: 1,
      unitPrice: priceNum,
      subtotal: priceNum,
      modifiers: [],
      notes: "Ítem libre agregado manualmente",
    };

    setItems((prev) => [...prev, newItem]);
    setCustomItemName("");
    setCustomItemPrice("");
    setShowCustomItemForm(false);
    toast.success(`«${newItem.productName}» agregado`);
  };

  // Guardar cambios
  const handleSave = async () => {
    if (items.length === 0) {
      toast.error("El pedido no puede quedar vacío.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateRestaurantOrderAction(businessId, order.id, {
        items: items.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          subtotal: it.unitPrice * it.quantity,
          notes: it.notes,
          modifiers: it.modifiers,
          variantId: it.variantId,
          variantName: it.variantName,
        })),
        assignedStaffId,
        assignedStaffName,
        assignedStaffRole,
        notes: orderNotes,
      });

      if (!res.success || !res.order) {
        toast.error("Error al actualizar pedido", {
          description: res.error || "No se pudieron guardar los cambios.",
        });
        return;
      }

      toast.success(`Pedido #${order.order_number} actualizado correctamente`, {
        description: res.paymentNotice || "Los cambios han sido guardados.",
        duration: 6000,
      });

      onSuccess?.(res.order);
      onSave?.(res.order);
      onClose();
    } catch (err: any) {
      toast.error("Error inesperado", { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Cancelar comanda
  const handleConfirmCancel = async () => {
    setIsCancelling(true);
    try {
      const res = await cancelRestaurantOrderAction(
        businessId,
        order.id,
        cancelReason.trim() || "Cancelado desde edición de comanda"
      );

      if (!res.success) {
        toast.error("Error al cancelar pedido", {
          description: res.error || "No se pudo cancelar la orden.",
        });
        return;
      }

      if (res.refundNotice) {
        toast.warning(`Pedido #${order.order_number} cancelado`, {
          description: res.refundNotice,
          duration: 9000,
        });
      } else {
        toast.success(`Pedido #${order.order_number} cancelado exitosamente`);
      }

      setIsCancelConfirmOpen(false);
      const cancelledOrder: RestaurantOrderWithDetails = {
        ...order,
        status: "cancelled",
      };
      onSuccess?.(cancelledOrder);
      onSave?.(cancelledOrder);
      onClose();
    } catch (err: any) {
      toast.error("Error inesperado al cancelar", { description: err.message });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-black/70 backdrop-blur-xs">
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-3xl rounded-3xl bg-white dark:bg-[#0D0F16] border border-slate-200/90 dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* ========================================================= */}
          {/* CABECERA */}
          {/* ========================================================= */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-white/[0.01]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-black text-sm shrink-0 border border-[#ED500A]/20">
                #{order.order_number}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                    Editar Comanda #{order.order_number}
                  </h2>
                  {order.tableName && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      {order.tableName}
                    </span>
                  )}
                  {order.payment_status === "paid" && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Pagado
                    </span>
                  )}
                  {order.payment_status === "pending" && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Pago Pendiente
                    </span>
                  )}
                  {order.payment_status === "partial" && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      Pago Parcial
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Agrega o quita productos, reajusta cantidades o reasigna el responsable.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ========================================================= */}
          {/* CUERPO CON SCROLL */}
          {/* ========================================================= */}
          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            {/* 1. SECCIÓN: RESPONSABLE / ATENDIDO POR */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#ED500A]" />
                  <span>Responsable de Atención / Mesero</span>
                </label>
                {order.tableName && (
                  <span className="text-[11px] text-slate-400">
                    Sincronizado con la mesa
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={assignedStaffId || ""}
                  onChange={(e) => {
                    const selId = e.target.value;
                    if (!selId) {
                      setAssignedStaffId(null);
                      setAssignedStaffName(null);
                      setAssignedStaffRole(null);
                      return;
                    }
                    const member = staffList.find((s) => s.id === selId);
                    if (member) {
                      setAssignedStaffId(member.id);
                      setAssignedStaffName(member.name);
                      setAssignedStaffRole(member.roles[0] || "Mesero");
                    }
                  }}
                  disabled={isLoadingStaff}
                  className="flex-1 px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#13151D] text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 cursor-pointer"
                >
                  <option value="">Sin responsable específico</option>
                  {staffList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.roles.length > 0 ? `(${m.roles.join(", ")})` : ""}
                    </option>
                  ))}
                </select>

                {assignedStaffName && (
                  <button
                    type="button"
                    onClick={() => {
                      setAssignedStaffId(null);
                      setAssignedStaffName(null);
                      setAssignedStaffRole(null);
                    }}
                    className="p-2 rounded-xl text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                    title="Quitar responsable"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. SECCIÓN: ÍTEMS DE LA COMANDA */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-[#ED500A]" />
                  <span>Productos en la Comanda ({items.length})</span>
                </h3>

                <button
                  type="button"
                  onClick={() => setShowAddProductSection((v) => !v)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-xl bg-[#ED500A]/10 text-[#ED500A] hover:bg-[#ED500A] hover:text-white transition-all cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showAddProductSection ? "Ocultar catálogo" : "+ Agregar Producto"}</span>
                </button>
              </div>

              {/* CATÁLOGO DESPLEGABLE PARA AGREGAR PRODUCTOS */}
              {showAddProductSection && (
                <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/70 dark:border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                      Catálogo del Comercio
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCustomItemForm((v) => !v)}
                      className="text-2xs text-[#ED500A] hover:underline font-bold"
                    >
                      {showCustomItemForm ? "Ver productos" : "+ Crear ítem libre"}
                    </button>
                  </div>

                  {/* FORMULARIO ÍTEM LIBRE */}
                  {showCustomItemForm ? (
                    <form onSubmit={handleAddCustomItem} className="flex gap-2 items-center flex-wrap">
                      <input
                        type="text"
                        value={customItemName}
                        onChange={(e) => setCustomItemName(e.target.value)}
                        placeholder="Nombre del producto o adicional..."
                        className="flex-1 min-w-[160px] px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#13151D] text-slate-900 dark:text-white"
                      />
                      <input
                        type="text"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(e.target.value)}
                        placeholder="Precio COP ($)"
                        className="w-28 px-3 py-1.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#13151D] text-slate-900 dark:text-white"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-xl bg-[#ED500A] text-white text-xs font-bold hover:bg-[#ED500A]/90 transition"
                      >
                        Agregar
                      </button>
                    </form>
                  ) : (
                    <>
                      {/* BUSCADOR Y FILTRO DE CATEGORÍAS */}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="text"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            placeholder="Buscar producto por nombre..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#13151D] text-slate-900 dark:text-white placeholder:text-slate-400"
                          />
                        </div>

                        {categories.length > 0 && (
                          <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#13151D] text-slate-800 dark:text-slate-200 cursor-pointer"
                          >
                            <option value="all">Todas</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* LISTA COMPACTA DE PRODUCTOS RESULTANTES */}
                      <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.04] rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-[#10131B]">
                        {isLoadingProducts ? (
                          <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Cargando catálogo...</span>
                          </div>
                        ) : filteredProducts.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400">
                            No se encontraron productos en el catálogo.
                          </div>
                        ) : (
                          filteredProducts.slice(0, 15).map((p) => (
                            <div
                              key={p.id}
                              className="p-2.5 px-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.03] transition"
                            >
                              <div className="min-w-0 pr-2">
                                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block truncate">
                                  {p.name}
                                </span>
                                {p.categoryName && (
                                  <span className="text-[10px] text-slate-400">
                                    {p.categoryName}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                                  {formatCOP(p.price)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleAddProduct(p)}
                                  className="p-1 px-2 rounded-lg bg-[#ED500A] text-white hover:bg-[#ED500A]/90 text-2xs font-extrabold flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Añadir</span>
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TABLA DE ÍTEMS EN LA COMANDA */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] overflow-hidden bg-white dark:bg-[#0E1018]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06] text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-3.5 py-2.5">Producto</th>
                      <th className="px-3 py-2.5 text-center">Cantidad</th>
                      <th className="px-3 py-2.5 text-right">Precio Unit.</th>
                      <th className="px-3.5 py-2.5 text-right">Subtotal</th>
                      <th className="px-2.5 py-2.5 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.015]">
                        <td className="px-3.5 py-2.5">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {it.productName}
                          </span>
                          {it.notes && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 italic block">
                              Nota: {it.notes}
                            </span>
                          )}
                          {it.modifiers && it.modifiers.length > 0 && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-[200px]">
                              {it.modifiers.map((m: any) => m.optionName || m.name).join(", ")}
                            </span>
                          )}
                        </td>

                        {/* Controles de cantidad */}
                        <td className="px-3 py-2.5 text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-white/[0.04] rounded-xl p-0.5 border border-slate-200/80 dark:border-white/[0.08]">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(idx, -1)}
                              disabled={it.quantity <= 1}
                              className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                              title="Reducir cantidad"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-mono font-bold text-xs text-slate-900 dark:text-white">
                              {it.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(idx, 1)}
                              className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 cursor-pointer"
                              title="Aumentar cantidad"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                          {formatCOP(it.unitPrice)}
                        </td>

                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatCOP(it.unitPrice * it.quantity)}
                        </td>

                        <td className="px-2.5 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer"
                            title="Quitar producto de la orden"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. SECCIÓN: OBSERVACIONES / NOTAS GENERALES */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#ED500A]" />
                <span>Notas generales de preparación / servicio</span>
              </label>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Observaciones de cocina, mesa o entrega..."
                rows={2}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#13151D] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#ED500A]/30 resize-none"
              />
            </div>

            {/* 4. SECCIÓN: RESUMEN FINANCIERO Y DIFERENCIA DE PAGO */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Subtotal Nuevo
                  </span>
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                    {formatCOP(currentSubtotal)}
                  </span>
                </div>

                {deliveryFee > 0 && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Domicilio
                    </span>
                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                      {formatCOP(deliveryFee)}
                    </span>
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total Anterior
                  </span>
                  <span className="text-sm font-mono text-slate-500 line-through">
                    {formatCOP(previousTotal)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#ED500A] block">
                    Nuevo Total
                  </span>
                  <span className="text-base font-extrabold font-mono text-[#ED500A]">
                    {formatCOP(currentTotal)}
                  </span>
                </div>
              </div>

              {/* AVISO REACTIVO SOBRE EL PAGO */}
              {order.payment_status === "paid" && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                    priceDifference > 0
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
                      : priceDifference < 0
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300"
                      : "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                  }`}
                >
                  {priceDifference > 0 ? (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  ) : priceDifference < 0 ? (
                    <Info className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  )}

                  <div className="space-y-0.5">
                    <p className="font-bold">
                      {priceDifference > 0
                        ? `Diferencia pendiente por cobrar: +${formatCOP(priceDifference)}`
                        : priceDifference < 0
                        ? `Diferencia a devolver al cliente: ${formatCOP(Math.abs(priceDifference))}`
                        : "El total es idéntico al monto ya cobrado"}
                    </p>
                    <p className="text-[11px] opacity-90">
                      {priceDifference > 0
                        ? "Este pedido ya cuenta con un pago previo. Al guardar, el estado pasará a 'Pago Parcial' para que registres el saldo faltante al entregar o cerrar mesa."
                        : priceDifference < 0
                        ? "Al reducir productos o cantidades, se genera una devolución/vuelto en efectivo o saldo a favor del cliente. El pedido permanecerá como Pagado."
                        : "El pedido se conserva como Pagado sin saldos pendientes."}
                    </p>
                  </div>
                </div>
              )}

              {order.payment_status === "pending" && (
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.04] text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    El pedido está pendiente de pago. Al cobrar, se solicitará el nuevo total ({formatCOP(currentTotal)}).
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* PIE DE ACCIONES */}
          {/* ========================================================= */}
          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-2.5 bg-slate-50/50 dark:bg-white/[0.01]">
            {/* Botón peligro: Cancelar comanda */}
            <button
              type="button"
              onClick={() => setIsCancelConfirmOpen(true)}
              disabled={isSaving || isCancelling}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Cancelar comanda</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08] transition cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || items.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#ED500A] text-white hover:bg-[#ED500A]/90 transition shadow-md shadow-[#ED500A]/20 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando cambios...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN DE CANCELACIÓN */}
      <ConfirmDialog
        isOpen={isCancelConfirmOpen}
        onClose={() => setIsCancelConfirmOpen(false)}
        onConfirm={handleConfirmCancel}
        title={`¿Deseas cancelar el Pedido #${order.order_number}?`}
        description={
          order.payment_status === "paid" || order.payment_status === "partial"
            ? `⚠️ ATENCIÓN: Este pedido cuenta con pago registrado de ${formatCOP(order.total)}. Al cancelarlo, recuerda realizar la DEVOLUCIÓN FÍSICA O ELECTRÓNICA del dinero al cliente.`
            : `El pedido será cancelado y saldrá de la línea de cocina y entrega. Si estaba en una mesa, la mesa será liberada.`
        }
        confirmText="Sí, cancelar pedido"
        cancelText="Conservar pedido"
        variant="danger"
        isLoading={isCancelling}
      />
    </ModalPortal>
  );
}
