"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Search,
  X,
  Plus,
  Minus,
  Trash2,
  Layers,
  Receipt,
  FileText,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Filter,
  Info,
  ArrowRight,
  ArrowLeft,
  Landmark,
  DollarSign,
  Barcode,
  LayoutGrid,
  Grid,
  Rows,
  SlidersHorizontal,
  HelpCircle,
  Star,
  Copy,
  Tag,
  Percent,
  Edit2,
  UserPlus,
  ChevronUp,
  ChevronDown,
  Bike,
  Calendar,
  Check,
  Banknote,
  Wallet,
  Loader2,
  Clock,
  User,
  Store,
} from "lucide-react";
import { Product, Category, ProductVariant, isProductAvailableInPos } from "@/lib/products/types";
import { findProductByBarcode } from "@/lib/products/barcode-service";
import { audioFeedback } from "@/lib/audio/beep";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { BarcodeScannerModal } from "@/components/scanner/barcode-scanner-modal";
import { subscribeToCatalogUpdates } from "@/lib/products/channel-sync";
import {
  PosCartItem,
  PosSelectedModifier,
  PosOrderSummary,
  calculateCartSummary,
  calculateItemTax,
  createCartItem,
  formatCOP,
} from "@/lib/pos/types";
import { RestaurantTable, RestaurantOrderWithDetails } from "@/lib/restaurant/types";
import { CashRegister, CashSession } from "@/lib/cash/types";
import { PublicPaymentMethodDTO } from "@/lib/payments/types";
import { ModifierSelectionModal } from "./modifier-selection-modal";
import { OrderDestinationModal } from "./order-destination-modal";
import { OrderSuccessModal } from "./order-success-modal";
import {
  KitchenCommandTicketModal,
  KitchenCommandTicketData,
} from "@/components/printing/kitchen-command-ticket-modal";
import { OpenCashShiftModal } from "./open-cash-shift-modal";
import { OrderPaymentModal } from "@/components/payments/order-payment-modal";
import { ProductFormModal } from "@/app/workspace/[businessId]/productos/product-form-modal";
import { CreateQuotationModal } from "./create-quotation-modal";
import { QuotationsListModal } from "./quotations-list-modal";
import type { Quotation } from "@/lib/quotations/types";
import { CashMovementModal } from "@/components/cash/cash-movement-modal";
import { ShiftMovementsHistoryModal } from "@/components/cash/shift-movements-history-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";

// Nuevos subcomponentes modales y paneles [POS-006]
import { PosItemLibreModal } from "./pos-item-libre-modal";
import { PosDiscountModal } from "./pos-discount-modal";
import { PosEditPriceModal } from "./pos-edit-price-modal";
import { PosSelectCustomerModal, PosCustomerItem } from "./pos-select-customer-modal";
import { PosQuickCreateCustomerModal } from "./pos-quick-create-customer-modal";
import { PosKitchenTicketModal, KitchenTicketData } from "./pos-kitchen-ticket-modal";
import { PosInvoiceModal, InvoiceData } from "./pos-invoice-modal";
import { PosOpenTicketsDrawer, OpenTicket } from "./pos-open-tickets-drawer";
import { PosResponsibleSelector } from "./pos-responsible-selector";
import {
  createRestaurantOrderAction,
  getWorkspaceStaffAction,
} from "@/app/workspace/[businessId]/ventas/order-actions";
import {
  registerRestaurantOrderPaymentAction,
  getRestaurantOrderAction,
} from "@/app/workspace/[businessId]/pedidos/actions";
import { syncOrderNotificationAction } from "@/app/workspace/[businessId]/notificaciones/actions";
import { showNativeOrderNotification } from "@/lib/notifications/web-push-client";
import { playOrderSoundAlert, initOrderAudioUnlock } from "@/lib/audio/order-sound-player";
import type { CreateRestaurantOrderInput, ProcessOrderPaymentInput, StaffMember } from "@/lib/restaurant/types";

interface PosScreenClientProps {
  businessId: string;
  businessName: string;
  cashierName?: string;
  currentUserId?: string;
  tradeName?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  initialProducts: Product[];
  initialCategories: Category[];
  initialTables?: RestaurantTable[];
  initialSelectedTableId?: string;
  initialCashRegisters?: CashRegister[];
  initialActiveSession?: CashSession | null;
  initialCashBalance?: number;
  initialPaymentMethods?: PublicPaymentMethodDTO[];
  initialQuotation?: Quotation | null;
  initialStaff?: StaffMember[];
  onSwitchToManualForm?: () => void;
  onOrderReady?: (order: PosOrderSummary) => void;
}

export function PosScreenClient({
  businessId,
  businessName,
  cashierName,
  currentUserId,
  tradeName,
  logoUrl,
  primaryColor = "#ED500A",
  initialProducts,
  initialCategories,
  initialTables = [],
  initialSelectedTableId,
  initialCashRegisters = [],
  initialActiveSession = null,
  initialCashBalance,
  initialPaymentMethods = [],
  initialQuotation = null,
  initialStaff = [],
  onSwitchToManualForm,
  onOrderReady,
}: PosScreenClientProps) {
  const router = useRouter();

  // 1. Estado del catálogo
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const tables = initialTables;

  // 1.1 Gestión de turnos de caja [POS-001]
  const [cashRegisters] = useState<CashRegister[]>(initialCashRegisters);
  const [activeCashSession, setActiveCashSession] = useState<CashSession | null>(initialActiveSession);
  const [currentCashBalance, setCurrentCashBalance] = useState<number>(
    initialCashBalance !== undefined ? initialCashBalance : initialActiveSession?.initialAmount ?? 0
  );
  const [isOpenCashShiftModalOpen, setIsOpenCashShiftModalOpen] = useState<boolean>(false);
  const [pendingProceedToSale, setPendingProceedToSale] = useState<boolean>(false);

  useEffect(() => {
    if (initialActiveSession) {
      setActiveCashSession(initialActiveSession);
      setIsOpenCashShiftModalOpen(false);
    }
  }, [initialActiveSession]);

  useEffect(() => {
    if (initialCashBalance !== undefined) {
      setCurrentCashBalance(initialCashBalance);
    }
  }, [initialCashBalance]);

  // 1.2 Cobro inmediato en POS [POS-002]
  const [orderToPay, setOrderToPay] = useState<RestaurantOrderWithDetails | null>(null);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState<boolean>(false);

  // Sincronización en tiempo real de cambios de productos y disponibilidad por canal (POS)
  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    if (!businessId) return;

    const unsubscribe = subscribeToCatalogUpdates(businessId, {
      onProductUpsert: (updatedProduct) => {
        setProducts((prev) => {
          const exists = prev.some((p) => p.id === updatedProduct.id);
          if (exists) {
            return prev.map((p) => (p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p));
          }
          return [updatedProduct, ...prev];
        });
      },
      onProductDelete: (deletedProductId) => {
        setProducts((prev) => prev.filter((p) => p.id !== deletedProductId));
      },
    });

    return () => unsubscribe();
  }, [businessId]);

  // 2. Filtros, búsqueda y densidad visual
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [gridDensity, setGridDensity] = useState<"large" | "medium" | "compact" | "list">("large");

  // 3. Estado del Carrito / Pedido Temporal en memoria
  const [cartItems, setCartItems] = useState<PosCartItem[]>([]);

  // 4. Estados de modales existentes
  const [productForModifiers, setProductForModifiers] = useState<Product | null>(null);
  const [isClearCartConfirmOpen, setIsClearCartConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PosCartItem | null>(null);
  const [isDestinationModalOpen, setIsDestinationModalOpen] = useState(false);
  const [isCreateQuotationModalOpen, setIsCreateQuotationModalOpen] = useState(false);
  const [isQuotationsListModalOpen, setIsQuotationsListModalOpen] = useState(false);
  const [activeQuotationId, setActiveQuotationId] = useState<string | null>(initialQuotation?.id || null);
  const [isCashMovementModalOpen, setIsCashMovementModalOpen] = useState(false);
  const [cashMovementInitialType, setCashMovementInitialType] = useState<"entry" | "withdrawal">("entry");
  const [isCashHistoryModalOpen, setIsCashHistoryModalOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [successOrder, setSuccessOrder] = useState<KitchenCommandTicketData | null>(null);

  // 5. Estados Nuevos para [POS-006]
  const [isItemLibreModalOpen, setIsItemLibreModalOpen] = useState(false);
  const [discountItem, setDiscountItem] = useState<PosCartItem | null>(null);
  const [editPriceItem, setEditPriceItem] = useState<PosCartItem | null>(null);
  const [isSelectCustomerModalOpen, setIsSelectCustomerModalOpen] = useState(false);
  const [isQuickCreateCustomerModalOpen, setIsQuickCreateCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: string;
    name: string;
    document?: string;
    phone?: string;
    address?: string;
  }>({ id: "general", name: "Cliente General" });

  // 5.1 Personal y responsable del pedido (selección por defecto: usuario actual)
  const [staffList, setStaffList] = useState<StaffMember[]>(initialStaff || []);

  const defaultStaff = useMemo(() => {
    return (
      staffList.find((s) => s.isCurrentUser || s.id === currentUserId) ||
      staffList[0] ||
      null
    );
  }, [staffList, currentUserId]);

  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(
    initialStaff?.find((s) => s.isCurrentUser || s.id === currentUserId)?.id ||
      currentUserId ||
      null
  );

  useEffect(() => {
    if (!selectedStaffId && defaultStaff) {
      setSelectedStaffId(defaultStaff.id);
    }
  }, [defaultStaff, selectedStaffId]);

  const selectedStaff = useMemo(() => {
    return staffList.find((s) => s.id === selectedStaffId) || defaultStaff || null;
  }, [staffList, selectedStaffId, defaultStaff]);

  // Carga reactiva de personal si initialStaff llegó vacío
  useEffect(() => {
    if (staffList.length === 0) {
      getWorkspaceStaffAction(businessId)
        .then((res) => {
          if (res.success && res.data && res.data.length > 0) {
            setStaffList(res.data);
            const current =
              res.data.find((s) => s.isCurrentUser || s.id === currentUserId) ||
              res.data[0];
            if (current && !selectedStaffId) {
              setSelectedStaffId(current.id);
            }
          }
        })
        .catch(() => {});
    }
  }, [businessId, staffList.length, currentUserId, selectedStaffId]);

  // 5.2 Información para pedidos "Para recoger"
  const [takeoutDetails, setTakeoutDetails] = useState({
    name: "",
    phone: "",
    saveCustomer: false,
  });

  const [isOpenTicketsDrawerOpen, setIsOpenTicketsDrawerOpen] = useState(false);
  const [kitchenTicketData, setKitchenTicketData] = useState<KitchenTicketData | null>(null);
  const [invoiceTicketData, setInvoiceTicketData] = useState<InvoiceData | null>(null);

  // 6. Flujo de Cobro Lateral en 2 Pasos
  const [isCheckoutStepActive, setIsCheckoutStepActive] = useState(false);
  const [serviceType, setServiceType] = useState<"TAKEOUT" | "DINE_IN" | "PICKUP" | "DELIVERY">("TAKEOUT");
  const [selectedTableId, setSelectedTableId] = useState<string>(initialSelectedTableId || "");
  const [deliveryDetails, setDeliveryDetails] = useState({
    phone: "",
    name: "",
    address: "",
    deliveryFee: 5000,
  });
  const [paymentTiming, setPaymentTiming] = useState<"pay_now" | "pay_later">("pay_now");
  const [tipPercentage, setTipPercentage] = useState<number>(0);
  const [customTip, setCustomTip] = useState<number>(0);
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [isSummaryExpanded, setIsSummaryExpanded] = useState<boolean>(true);
  const [generalDiscount, setGeneralDiscount] = useState<number>(0);

  // Mobile drawer toggle
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);

  // Inicializar desbloqueo acústico para alertas de venta
  useEffect(() => {
    initOrderAudioUnlock();
  }, []);

  // Carga inicial si viene con cotización seleccionada por URL [POS-004]
  useEffect(() => {
    if (initialQuotation && Array.isArray(initialQuotation.items) && initialQuotation.items.length > 0) {
      setCartItems(initialQuotation.items);
      setActiveQuotationId(initialQuotation.id);
      toast.success(`Cotización «${initialQuotation.quotationNumber}» cargada en la venta actual.`);
    }
  }, [initialQuotation]);

  // Cálculo del resumen en tiempo real
  const summary: PosOrderSummary = useMemo(() => {
    const baseSummary = calculateCartSummary(cartItems);
    const tipAmount = customTip > 0 ? customTip : Math.round((baseSummary.subtotal * tipPercentage) / 100);
    const deliveryFee = serviceType === "DELIVERY" ? deliveryDetails.deliveryFee : 0;
    const finalTotal = Math.max(0, baseSummary.total + tipAmount + deliveryFee - generalDiscount);

    return {
      ...baseSummary,
      discount: baseSummary.discount + generalDiscount,
      total: finalTotal,
    };
  }, [cartItems, tipPercentage, customTip, serviceType, deliveryDetails.deliveryFee, generalDiscount]);

  // Productos activos habilitados para el canal POS
  const posChannelProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.status !== "archived" &&
        p.status !== "inactive" &&
        isProductAvailableInPos(p)
    );
  }, [products]);

  // Filtrado de productos en memoria
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posChannelProducts.filter((p) => {
      if (q) {
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q) || false;
        const meta = (p.metadata || {}) as Record<string, any>;
        const matchesSku = (meta.sku || "").toString().toLowerCase().includes(q);
        const matchesBarcode = (meta.barcode || "").toString().toLowerCase().includes(q);
        const matchesVariants =
          Array.isArray(meta.variants) &&
          meta.variants.some(
            (v: any) =>
              (v.name || "").toString().toLowerCase().includes(q) ||
              (v.sku || "").toString().toLowerCase().includes(q) ||
              (v.barcode || "").toString().toLowerCase().includes(q)
          );

        if (!matchesName && !matchesDesc && !matchesSku && !matchesBarcode && !matchesVariants) {
          return false;
        }
      }
      if (selectedCategory !== "all") {
        const matchesDirect = p.category_id === selectedCategory;
        const matchesSub = categories.some(
          (c) => c.parent_category_id === selectedCategory && p.category_id === c.id
        );
        if (!matchesDirect && !matchesSub) return false;
      }
      if (showOnlyAvailable && !p.is_available) {
        return false;
      }
      return true;
    });
  }, [posChannelProducts, categories, search, selectedCategory, showOnlyAvailable]);

  // Conteo de productos por categoría
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: posChannelProducts.length };
    posChannelProducts.forEach((p) => {
      if (p.category_id) {
        counts[p.category_id] = (counts[p.category_id] || 0) + 1;
        const cat = categories.find((c) => c.id === p.category_id);
        if (cat?.parent_category_id) {
          counts[cat.parent_category_id] = (counts[cat.parent_category_id] || 0) + 1;
        }
      }
    });
    return counts;
  }, [posChannelProducts, categories]);

  // Manejo de clic en producto del catálogo
  const handleProductClick = (product: Product) => {
    const isRecipeOutOfStock = Boolean(
      (product.metadata as any)?.has_recipe &&
      (product.metadata as any)?.recipe_portions_available === 0
    );

    if (!product.is_available || isRecipeOutOfStock) {
      toast.error(`«${product.name}» está agotado temporalmente.`);
      return;
    }

    const modifierGroups = (product.metadata as any)?.modifier_groups || [];
    const rawVariants = Array.isArray((product.metadata as any)?.variants)
      ? (product.metadata as any).variants
      : [];
    const hasVariants = Boolean(
      ((product.metadata as any)?.has_variants || rawVariants.length > 0) &&
      rawVariants.length > 0
    );

    if (modifierGroups.length > 0 || hasVariants) {
      setProductForModifiers(product);
    } else {
      handleAddToCart(product, [], 1);
    }
  };

  // Agregar producto al carrito
  const handleAddToCart = (
    product: Product,
    selectedModifiers: PosSelectedModifier[] = [],
    quantity: number = 1,
    notes?: string,
    variant?: ProductVariant | null
  ) => {
    const rawVariants = Array.isArray((product.metadata as any)?.variants)
      ? (product.metadata as any).variants
      : [];
    const hasVariants = Boolean(
      ((product.metadata as any)?.has_variants || rawVariants.length > 0) &&
      rawVariants.length > 0
    );

    if (hasVariants && !variant) {
      setProductForModifiers(product);
      return;
    }

    const newItem = createCartItem(product, selectedModifiers, quantity, notes, variant);

    setCartItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.id === newItem.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const existing = updated[existingIdx];
        const newQty = existing.quantity + quantity;
        const newLineTotal = existing.unitPrice * newQty;
        const taxCalc = calculateItemTax(newLineTotal, existing.taxPercentage, existing.taxIncludedInPrice);
        updated[existingIdx] = {
          ...existing,
          quantity: newQty,
          lineTotal: newLineTotal,
          netSubtotal: taxCalc.netSubtotal,
          taxAmount: taxCalc.taxAmount,
        };
        return updated;
      } else {
        return [...prev, newItem];
      }
    });

    toast.success(`«${product.name}» agregado al pedido`);
  };

  // Manejar adición de ítem libre [POS-006]
  const handleAddItemLibre = (itemData: {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }) => {
    const customId = `custom-item-${Date.now()}`;
    const total = itemData.unitPrice * itemData.quantity;
    const newCartItem: PosCartItem = {
      id: customId,
      productId: customId,
      productName: itemData.description,
      basePrice: itemData.unitPrice,
      quantity: itemData.quantity,
      selectedModifiers: [],
      modifiersPrice: 0,
      unitPrice: itemData.unitPrice,
      lineTotal: total,
      taxPercentage: 0,
      taxIncludedInPrice: true,
      taxAmount: 0,
      netSubtotal: total,
      notes: itemData.unit ? `Unidad: ${itemData.unit}` : undefined,
      isCustom: true,
    };

    setCartItems((prev) => [...prev, newCartItem]);
    setIsItemLibreModalOpen(false);
    toast.success(`Ítem libre «${itemData.description}» añadido al pedido.`);
  };

  // Aplicar descuento por línea [POS-006]
  const handleApplyLineDiscount = (discount: { type: "percentage" | "fixed"; value: number }) => {
    if (!discountItem) return;

    setCartItems((prev) =>
      prev.map((it) => {
        if (it.id !== discountItem.id) return it;
        const originalTotal = it.unitPrice * it.quantity;
        const discountAmount =
          discount.type === "percentage"
            ? Math.round((originalTotal * discount.value) / 100)
            : Math.min(originalTotal, discount.value);
        const newLineTotal = Math.max(0, originalTotal - discountAmount);
        const taxCalc = calculateItemTax(newLineTotal, it.taxPercentage, it.taxIncludedInPrice);
        return {
          ...it,
          lineTotal: newLineTotal,
          netSubtotal: taxCalc.netSubtotal,
          taxAmount: taxCalc.taxAmount,
          discountAmount: discountAmount,
          notes:
            discount.type === "percentage"
              ? `${it.notes ? it.notes + ' · ' : ''}Desc. ${discount.value}%`
              : it.notes,
        };
      })
    );

    const appliedVal =
      discount.type === "percentage"
        ? `${discount.value}%`
        : formatCOP(discount.value);
    setDiscountItem(null);
    toast.success(`Descuento de ${appliedVal} aplicado a «${discountItem.productName}».`);
  };

  // Modificar precio unitario de una línea [POS-006]
  const handleApplyNewUnitPrice = (newUnitPrice: number) => {
    if (!editPriceItem) return;

    setCartItems((prev) =>
      prev.map((it) => {
        if (it.id !== editPriceItem.id) return it;
        const newLineTotal = newUnitPrice * it.quantity;
        const taxCalc = calculateItemTax(newLineTotal, it.taxPercentage, it.taxIncludedInPrice);
        return {
          ...it,
          unitPrice: newUnitPrice,
          lineTotal: newLineTotal,
          netSubtotal: taxCalc.netSubtotal,
          taxAmount: taxCalc.taxAmount,
        };
      })
    );

    setEditPriceItem(null);
    toast.success(`Precio de «${editPriceItem.productName}» actualizado a ${formatCOP(newUnitPrice)}.`);
  };

  // Modificar cantidad en una línea
  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id !== itemId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          const newLineTotal = item.unitPrice * nextQty - (item.discountAmount || 0);
          const taxCalc = calculateItemTax(newLineTotal, item.taxPercentage, item.taxIncludedInPrice);
          return {
            ...item,
            quantity: nextQty,
            lineTotal: Math.max(0, newLineTotal),
            netSubtotal: taxCalc.netSubtotal,
            taxAmount: taxCalc.taxAmount,
          };
        })
        .filter(Boolean) as PosCartItem[]
    );
  };

  // Eliminar una línea del pedido
  const handleRemoveItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
    setItemToDelete(null);
    toast.info("Producto eliminado del pedido");
  };

  // Vaciar carrito
  const handleClearCart = () => {
    setCartItems([]);
    setActiveQuotationId(null);
    setIsClearCartConfirmOpen(false);
    setIsCheckoutStepActive(false);
    toast.success("Venta vaciada");
  };

  // Cargar productos de cotización
  const handleLoadQuotationIntoCart = (quotation: Quotation) => {
    if (!quotation.items || quotation.items.length === 0) {
      toast.error("La cotización no contiene productos.");
      return;
    }
    setCartItems(quotation.items);
    setActiveQuotationId(quotation.id);
    setIsMobileCartOpen(false);
  };

  // Escaneo de código de barras
  const handleBarcodeScan = (barcode: string) => {
    const match = findProductByBarcode(posChannelProducts, barcode);
    if (!match) {
      audioFeedback.playErrorBeep();
      toast.error(`Código de barras "${barcode}" no encontrado.`);
      return;
    }
    audioFeedback.playSuccessBeep();
    const { product, matchedVariant } = match;
    if (matchedVariant) {
      handleAddToCart(product, [], 1, undefined, matchedVariant);
      toast.success(`Añadido: ${product.name} (${matchedVariant.name})`);
    } else {
      handleAddToCart(product, [], 1);
      toast.success(`Añadido: ${product.name}`);
    }
  };

  useBarcodeScanner({
    enabled:
      !isDestinationModalOpen &&
      !isCreateQuotationModalOpen &&
      !isQuotationsListModalOpen &&
      !isCashMovementModalOpen &&
      !isCashHistoryModalOpen &&
      !isClearCartConfirmOpen &&
      !itemToDelete &&
      !productForModifiers &&
      !isBarcodeModalOpen &&
      !isItemLibreModalOpen &&
      !discountItem &&
      !editPriceItem &&
      !isSelectCustomerModalOpen &&
      !kitchenTicketData &&
      !invoiceTicketData &&
      !isOpenTicketsDrawerOpen,
    onScan: handleBarcodeScan,
    playBeep: false,
  });

  // Confirmar y crear el pedido operativo en el Checkout Lateral [POS-006]
  // La creación NO registra pago ni genera movimiento de caja hasta confirmar el pago expresamente.
  const handleCreateOrder = async () => {
    if (cartItems.length === 0) {
      toast.error("El carrito está vacío.");
      return;
    }

    if (serviceType === "DELIVERY") {
      if (!deliveryDetails.phone || !deliveryDetails.name || !deliveryDetails.address) {
        toast.error("Para servicio a domicilio se requiere Teléfono, Nombre y Dirección completos.");
        return;
      }
    }

    if (serviceType === "PICKUP") {
      if (!takeoutDetails.name.trim() || !takeoutDetails.phone.trim()) {
        toast.error("Para pedidos para recoger es obligatorio ingresar el Nombre y Teléfono de contacto.");
        return;
      }
    }

    setIsSubmittingSale(true);

    try {
      const tableName = serviceType === "DINE_IN" ? tables.find((t) => t.id === selectedTableId)?.name_or_number || "Mesa 1" : undefined;
      let finalCustomerName = selectedCustomer.name;
      let finalCustomerPhone = selectedCustomer.phone || null;

      if (serviceType === "DELIVERY") {
        finalCustomerName = deliveryDetails.name;
        finalCustomerPhone = deliveryDetails.phone;
      } else if (serviceType === "PICKUP" && takeoutDetails.name.trim()) {
        finalCustomerName = takeoutDetails.name.trim();
        finalCustomerPhone = takeoutDetails.phone.trim() || null;
      }

      const orderTypeKey = serviceType === "DINE_IN" ? "dine_in" : serviceType === "DELIVERY" ? "delivery" : "takeout";

      const rawNotes = orderNotes.trim();
      const discountTag = generalDiscount > 0 ? `Descuento: $${generalDiscount.toLocaleString('es-CO')}` : null;
      const finalNotes = [rawNotes, discountTag].filter(Boolean).join(" | ");

      const payload: CreateRestaurantOrderInput = {
        orderType: orderTypeKey,
        channelOrigin: "in_person",
        tableId: serviceType === "DINE_IN" ? selectedTableId || null : null,
        customerId: selectedCustomer.id && selectedCustomer.id !== "default" ? selectedCustomer.id : null,
        customerName: finalCustomerName || (serviceType === "DELIVERY" ? "Cliente Domicilio" : "Cliente General"),
        customerPhone: finalCustomerPhone,
        deliveryAddress: serviceType === "DELIVERY" ? deliveryDetails.address : null,
        deliveryFee: serviceType === "DELIVERY" ? (deliveryDetails.deliveryFee || 0) : 0,
        notes: finalNotes || null,
        taxTotal: summary.tax,
        assignedStaffId: selectedStaff?.id || null,
        assignedStaffName: selectedStaff?.name || cashierName || null,
        assignedStaffRole: selectedStaff && selectedStaff.roles.length > 0 ? selectedStaff.roles.join(", ") : null,
        saveCustomerForFuture: serviceType === "PICKUP" ? takeoutDetails.saveCustomer : false,
        items: cartItems.map((ci) => ({
          productId: ci.productId && ci.productId !== "custom-item" && !ci.productId.startsWith("custom-") ? ci.productId : null,
          variantId: ci.variantId || null,
          variantName: ci.variantName || null,
          quantity: ci.quantity,
          notes: ci.notes,
          taxPercentage: ci.taxPercentage,
          taxIncludedInPrice: ci.taxIncludedInPrice,
          selectedModifiers: (ci.selectedModifiers || []).map((m) => ({
            groupId: m.groupId,
            groupName: m.groupName,
            optionId: m.optionId,
            optionName: m.optionName,
            price: m.price,
          })),
        })),
      };

      const res = await createRestaurantOrderAction(businessId, payload);
      if (!res.success || !res.orderId || !res.orderNumber) {
        toast.error(res.error || "Ocurrió un error al registrar el pedido.");
        setIsSubmittingSale(false);
        return;
      }

      const orderId = res.orderId;
      const orderNum = res.orderNumber;

      // Feedback sonoro
      try {
        playOrderSoundAlert(orderId);
      } catch {}

      // Sincronizar notificación en campanita
      try {
        await syncOrderNotificationAction(businessId, {
          orderId,
          orderNumber: orderNum,
          orderType: payload.orderType,
          customerName: payload.customerName,
          total: summary.total,
        });
      } catch (notifErr) {
        console.warn("[handleCreateOrder] Error sincronizando notificación:", notifErr);
      }

      // Notificación push nativa
      try {
        showNativeOrderNotification({
          orderId,
          orderNumber: orderNum,
          orderType: payload.orderType,
          customerName: payload.customerName,
          total: summary.total,
          businessId,
        });
      } catch {}

      // Evento global para tickets abiertos y KDS
      try {
        window.dispatchEvent(
          new CustomEvent("negova:new_order", {
            detail: {
              id: orderId,
              businessId,
              orderNumber: orderNum,
              orderType: payload.orderType,
              customerName: payload.customerName,
              total: summary.total,
              createdAt: new Date().toISOString(),
            },
          })
        );
      } catch {}

      // Generar comanda de cocina térmica
      const kTicket: KitchenTicketData = {
        orderId,
        orderNumber: orderNum,
        referenceName: `REF-${orderNum}`,
        serviceType: serviceType === "DINE_IN" ? "COMER AQUÍ" : serviceType === "TAKEOUT" ? "PARA LLEVAR" : serviceType === "DELIVERY" ? "DOMICILIO" : "PARA RECOGER",
        tableName: tableName,
        cashierName: cashierName || businessName || "Cajero",
        createdAt: new Date().toISOString(),
        items: cartItems.map((ci) => ({
          quantity: ci.quantity,
          name: ci.productName,
          modifiers: (ci.selectedModifiers || []).map((m) => `${m.groupName}: ${m.optionName}`),
          notes: ci.notes,
        })),
      };

      setCartItems([]);
      setGeneralDiscount(0);
      setTipPercentage(0);
      setCustomTip(0);
      setOrderNotes("");
      setTakeoutDetails({ name: "", phone: "", saveCustomer: false });
      setIsCheckoutStepActive(false);

      const pickupCodeNotice = res.pickupCode ? `Código recogida: #${res.pickupCode}` : null;

      if (paymentTiming === "pay_now") {
        toast.success(
          pickupCodeNotice
            ? `Pedido #${orderNum} creado (${pickupCodeNotice}). Abriendo flujo de cobro...`
            : `Pedido #${orderNum} creado. Abriendo flujo de cobro...`
        );
        await handlePayExistingTicketById(orderId);
      } else {
        setKitchenTicketData(kTicket);
        toast.success(`¡Pedido #${orderNum} creado exitosamente!`, {
          description: pickupCodeNotice
            ? `${pickupCodeNotice} · Pendiente de pago`
            : "Estado: Recibido · Pendiente de pago",
          action: {
            label: "Confirmar pago",
            onClick: () => handlePayExistingTicketById(orderId),
          },
          duration: 12000,
        });
      }
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Error al registrar el pedido.");
    } finally {
      setIsSubmittingSale(false);
    }
  };

  // Cargar ticket existente desde Tickets Abiertos o notificación para cobrarlo
  const handlePayExistingTicketById = async (orderId: string) => {
    try {
      const res = await getRestaurantOrderAction(businessId, orderId);
      if (res.success && res.order) {
        setOrderToPay(res.order);
      } else {
        toast.error("No se pudo cargar el pedido para cobro.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al cargar el pedido.");
    }
  };

  const handlePayExistingTicket = async (ticket: OpenTicket | { id: string }) => {
    return handlePayExistingTicketById(ticket.id);
  };

  // Copiar nombre del cliente
  const handleCopyCustomer = () => {
    navigator.clipboard.writeText(selectedCustomer.name);
    toast.success("Cliente copiado al portapapeles.");
  };

  // Clases de cuadrícula según la densidad
  const gridClasses = useMemo(() => {
    switch (gridDensity) {
      case "compact":
        return "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2";
      case "medium":
        return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3";
      case "list":
        return "grid grid-cols-1 gap-2";
      case "large":
      default:
        return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5";
    }
  }, [gridDensity]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-[1680px] mx-auto w-full p-2 sm:p-3.5 lg:p-3 xl:p-4 gap-2.5 overflow-hidden">
      {/* CONTENEDOR PRINCIPAL: CATÁLOGO (IZQUIERDA) + PANEL DE VENTA / CHECKOUT (DERECHA) */}
      <div className="flex-1 flex gap-3.5 overflow-hidden min-h-0">
        {/* PANEL IZQUIERDO: CATÁLOGO Y PRODUCTOS */}
        <section className="flex-1 flex flex-col gap-2.5 min-w-0 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-3 shadow-xs overflow-hidden">
          {/* BARRA DE FILTROS, BUSCADOR Y ACCIONES OPERACIONALES */}
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar producto, SKU o código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A] text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {/* Indicador de turno de caja */}
              {activeCashSession ? (
                <button
                  type="button"
                  onClick={() => setIsCashMovementModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100 transition cursor-pointer"
                  title="Turno de caja activo (Clic para ver arqueo o registrar entrada/salida)"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <Landmark className="w-3.5 h-3.5" />
                  <span className="font-bold">{formatCOP(currentCashBalance)}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsOpenCashShiftModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-xl bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 hover:bg-amber-100 transition cursor-pointer"
                  title="Abrir turno de caja"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Abrir caja</span>
                </button>
              )}

              {/* Botón Tickets Abiertos */}
              <button
                type="button"
                onClick={() => setIsOpenTicketsDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-[#0D0F16] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08] transition cursor-pointer"
                title="Ver tickets abiertos en operación"
              >
                <Receipt className="w-3.5 h-3.5 text-[#ED500A]" />
                <span className="hidden sm:inline">Tickets</span>
              </button>

              {/* Botón Scanner Barcode */}
              <button
                type="button"
                onClick={() => setIsBarcodeModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-xl bg-orange-50 text-[#ED500A] dark:bg-[#ED500A]/10 border border-orange-200 dark:border-[#ED500A]/20 hover:bg-orange-100 dark:hover:bg-[#ED500A]/20 transition cursor-pointer"
                title="Escanear código de barras"
              >
                <Barcode className="w-4 h-4" />
                <span className="hidden sm:inline">Escanear</span>
              </button>

              {/* Conmutador de Densidad Visual */}
              <div className="flex items-center bg-white dark:bg-[#0D0F16] p-0.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setGridDensity("large")}
                  className={`p-1.5 rounded-lg transition ${gridDensity === "large" ? "bg-slate-100 dark:bg-white/[0.1] text-[#ED500A] shadow-xs" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"}`}
                  title="Vista Cuadrícula Grande"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setGridDensity("medium")}
                  className={`p-1.5 rounded-lg transition ${gridDensity === "medium" ? "bg-slate-100 dark:bg-white/[0.1] text-[#ED500A] shadow-xs" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"}`}
                  title="Vista Cuadrícula Mediana"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setGridDensity("compact")}
                  className={`p-1.5 rounded-lg transition ${gridDensity === "compact" ? "bg-slate-100 dark:bg-white/[0.1] text-[#ED500A] shadow-xs" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"}`}
                  title="Vista Compacta"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setGridDensity("list")}
                  className={`p-1.5 rounded-lg transition ${gridDensity === "list" ? "bg-slate-100 dark:bg-white/[0.1] text-[#ED500A] shadow-xs" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"}`}
                  title="Vista Lista"
                >
                  <Rows className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* PÍLDORAS DE CATEGORÍAS */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth pb-1 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                selectedCategory === "all"
                  ? "bg-[#ED500A] text-white shadow-xs shadow-[#ED500A]/20"
                  : "bg-white dark:bg-[#0D0F16] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08]"
              }`}
            >
              Todos ({categoryCounts.all || 0})
            </button>

            {categories.map((cat) => {
              const count = categoryCounts[cat.id] || 0;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                    isSelected
                      ? "bg-[#ED500A] text-white shadow-xs shadow-[#ED500A]/20"
                      : "bg-white dark:bg-[#0D0F16] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08]"
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* CUADRÍCULA DE PRODUCTOS */}
          <div className="flex-1 overflow-y-auto pr-1 pb-4">
            <div className={gridClasses}>
              {/* TARJETA DE ÍTEM LIBRE / PERSONALIZADO [POS-006] */}
              <div
                onClick={() => setIsItemLibreModalOpen(true)}
                className="group relative flex flex-col justify-between p-3.5 bg-slate-50/60 dark:bg-white/[0.02] hover:bg-[#ED500A]/[0.04] dark:hover:bg-[#ED500A]/[0.08] border-2 border-dashed border-slate-300 dark:border-white/[0.1] hover:border-[#ED500A] rounded-2xl transition-all cursor-pointer text-center min-h-[170px]"
              >
                <div className="flex flex-col items-center justify-center pt-2">
                  <div className="w-11 h-11 rounded-full bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Personalizado
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Texto libre
                  </h4>
                  <span className="text-xs text-[#ED500A] font-bold">Precio libre</span>
                </div>

                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    aria-label="Añadir ítem libre"
                    className="w-8 h-8 rounded-full bg-[#ED500A] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* PRODUCTOS DE CATÁLOGO */}
              {filteredProducts.map((prod) => {
                const rawVariants: any[] = (prod.metadata as any)?.variants || [];
                const hasVariants = Boolean(
                  (prod.metadata as any)?.has_variants && rawVariants.length > 0
                );
                const minVariantPrice = hasVariants
                  ? Math.min(...rawVariants.map((v) => v.price || 0))
                  : null;
                const isAvailable = prod.is_available;
                const trackStock = Boolean(
                  (prod.metadata as any)?.track_stock ||
                  (prod as any).track_stock ||
                  (prod as any).track_inventory
                );
                const rawStock = (prod as any).stock_quantity ?? (prod as any).stock;
                const hasTrackedStock = trackStock && rawStock !== undefined && rawStock !== null;
                const stockCount = hasTrackedStock ? Number(rawStock) : null;
                const catName =
                  prod.categories?.name ||
                  categories.find((c) => c.id === prod.category_id)?.name ||
                  "General";

                if (gridDensity === "list") {
                  return (
                    <div
                      key={prod.id}
                      onClick={() => handleProductClick(prod)}
                      className="flex items-center justify-between p-2.5 bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] rounded-xl hover:border-[#ED500A]/50 hover:bg-slate-50/50 dark:hover:bg-white/[0.05] transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/[0.03] overflow-hidden shrink-0 flex items-center justify-center">
                          {prod.image_url ? (
                            <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                          ) : (
                            <Layers className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 block">{catName}</span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-[#ED500A] transition-colors">{prod.name}</h4>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-[#ED500A] font-mono">
                          {hasVariants && minVariantPrice !== null ? formatCOP(minVariantPrice) : formatCOP(prod.price)}
                        </span>
                        <button
                          type="button"
                          className="w-7 h-7 rounded-full bg-[#ED500A]/10 text-[#ED500A] hover:bg-[#ED500A] hover:text-white flex items-center justify-center transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={prod.id}
                    onClick={() => handleProductClick(prod)}
                    className="group relative flex flex-col justify-between bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden hover:border-[#ED500A]/50 hover:shadow-lg hover:shadow-[#ED500A]/5 transition cursor-pointer"
                  >
                    {/* Imagen / Badge de Stock condicional (solo si se gestiona inventario) */}
                    <div className="relative w-full aspect-[4/3] bg-slate-100 dark:bg-white/[0.03] overflow-hidden flex items-center justify-center">
                      {prod.image_url ? (
                        <img
                          src={prod.image_url}
                          alt={prod.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <Layers className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                      )}

                      {/* Badge de Stock: solo visible si el producto controla inventario */}
                      {hasTrackedStock && stockCount !== null && (
                        <span
                          className={`absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold shadow-xs backdrop-blur-xs ${
                            stockCount <= 0
                              ? "bg-rose-600 text-white"
                              : stockCount <= 5
                              ? "bg-amber-500 text-white"
                              : "bg-black/75 text-white border border-white/10"
                          }`}
                        >
                          {stockCount <= 0 ? "Agotado" : `${stockCount} disp.`}
                        </span>
                      )}
                    </div>

                    {/* Cuerpo */}
                    <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider block truncate">
                          {catName}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-[#ED500A] transition-colors">
                          {prod.name}
                        </h4>
                      </div>

                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100 dark:border-white/[0.06]">
                        <span className="text-xs sm:text-sm font-black text-[#ED500A] font-mono">
                          {hasVariants && minVariantPrice !== null ? formatCOP(minVariantPrice) : formatCOP(prod.price)}
                        </span>
                        <button
                          type="button"
                          aria-label={`Añadir ${prod.name}`}
                          className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl bg-[#ED500A]/10 text-[#ED500A] group-hover:bg-[#ED500A] group-hover:text-white flex items-center justify-center transition shadow-xs cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* PANEL DERECHO: CARRITO / FLUJO DE COBRO LATERAL */}
        <aside className="hidden lg:flex w-[320px] xl:w-[360px] 2xl:w-[390px] shrink-0 flex-col bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs overflow-hidden">
          {!isCheckoutStepActive ? (
            /* VISTA DE CARRITO DE COMPRAS / TU PEDIDO */
            <>
              {/* Cabecera del pedido */}
              <div className="p-3 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between bg-white dark:bg-[#0D0F16]">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Tu pedido - ({summary.itemsCount})
                  </h3>
                </div>
                {cartItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsClearCartConfirmOpen(true)}
                    className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                    title="Vaciar pedido"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Lista de productos en el pedido */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                {cartItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3 text-slate-400">
                    <ShoppingBag className="w-10 h-10 stroke-[1.5] text-slate-300 dark:text-slate-600" />
                    <p className="text-xs font-medium text-slate-500 max-w-[200px]">
                      Tu pedido está vacío. Selecciona productos o añade un ítem personalizado.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsItemLibreModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-[#ED500A] text-[#ED500A] text-xs font-bold hover:bg-[#ED500A]/5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Ítem de texto libre</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {cartItems.map((item) => {
                      const itemImage =
                        item.productImage ||
                        products.find((p) => p.id === item.productId)?.image_url;

                      return (
                        <div
                          key={item.id}
                          className="p-3 bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl space-y-2.5 transition-all"
                        >
                          <div className="flex items-start gap-2.5">
                            {/* Miniatura de la imagen del producto */}
                            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                              {itemImage ? (
                                <img
                                  src={itemImage}
                                  alt={item.productName}
                                  className="w-full h-full object-cover"
                                />
                              ) : item.isCustom ? (
                                <FileText className="w-5 h-5 text-[#ED500A]" />
                              ) : (
                                <Layers className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-1">
                                <h4
                                  className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-1"
                                  title={item.productName}
                                >
                                  {item.productName}
                                </h4>
                                <span className="text-sm font-black text-[#ED500A] font-mono shrink-0">
                                  {formatCOP(item.lineTotal)}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                {formatCOP(item.unitPrice)} c/u
                              </p>
                            </div>
                          </div>

                          {/* Modificadores o notas */}
                          {item.selectedModifiers.length > 0 && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 pl-0.5">
                              {item.selectedModifiers.map((m, idx) => (
                                <div key={idx}>• {m.optionName}</div>
                              ))}
                            </div>
                          )}
                          {item.notes && (
                            <p className="text-[10px] italic text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/40">
                              {item.notes}
                            </p>
                          )}

                          {/* Barra de herramientas y selector de cantidad */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                            {/* Herramientas: Descuento, Precio, Notas, Papelera */}
                            <div className="flex items-center gap-0.5 text-slate-400">
                              <button
                                type="button"
                                onClick={() => setDiscountItem(item)}
                                className="p-1.5 hover:text-[#ED500A] hover:bg-[#ED500A]/10 rounded-lg transition-colors cursor-pointer"
                                title="Aplicar descuento individual"
                              >
                                <Tag className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditPriceItem(item)}
                                className="p-1.5 hover:text-[#ED500A] hover:bg-[#ED500A]/10 rounded-lg transition-colors cursor-pointer"
                                title="Editar precio de la línea"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const newNote = item.notes ? "" : "Especial";
                                  setCartItems((prev) =>
                                    prev.map((ci) => (ci.id === item.id ? { ...ci, notes: newNote || undefined } : ci))
                                  );
                                }}
                                className="p-1.5 hover:text-[#ED500A] hover:bg-[#ED500A]/10 rounded-lg transition-colors cursor-pointer"
                                title="Editar notas"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1.5 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar ítem"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Control de Cantidad - qty + */}
                            <div className="flex items-center bg-slate-100 dark:bg-white/[0.05] rounded-xl border border-slate-200/80 dark:border-white/[0.08] p-0.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.id, -1)}
                                className="w-6 h-6 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/[0.1] hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center cursor-pointer"
                                title="Disminuir cantidad"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-6 text-center text-xs font-black text-slate-900 dark:text-white font-mono">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.id, 1)}
                                className="w-6 h-6 rounded-lg bg-[#ED500A] text-white hover:bg-[#ED500A]/90 transition shadow-xs flex items-center justify-center cursor-pointer"
                                title="Aumentar cantidad"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Botón contextual para añadir ítem libre */}
                    <button
                      type="button"
                      onClick={() => setIsItemLibreModalOpen(true)}
                      className="w-full py-2.5 border border-dashed border-slate-300 dark:border-white/[0.1] hover:border-[#ED500A] hover:bg-[#ED500A]/[0.02] rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#ED500A] transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ítem de texto libre</span>
                    </button>
                  </>
                )}
              </div>

              {/* Pie de Carrito con Total y Botón Completar Compra */}
              <div className="p-3 border-t border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Total ({summary.itemsCount} unidades)</span>
                  <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                    {formatCOP(summary.total)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={cartItems.length === 0}
                  onClick={() => setIsCheckoutStepActive(true)}
                  className="w-full py-3 px-4 rounded-xl bg-[#ED500A] hover:bg-[#d94608] text-white font-bold text-sm shadow-lg shadow-[#ED500A]/25 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <span>Completar compra</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            /* FLUJO DE COBRO LATERAL EN 2 PASOS [POS-006] */
            <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-200">
              {/* Botón de Retorno al Carrito */}
              <div className="p-2.5 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between bg-white dark:bg-[#0D0F16]">
                <button
                  type="button"
                  onClick={() => setIsCheckoutStepActive(false)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#ED500A] transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver al pedido</span>
                </button>
                <span className="text-xs font-bold text-[#ED500A]">Flujo de Cobro</span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
                {/* BLOQUE A: RESUMEN DE LA VENTA (COLAPSABLE) */}
                <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-xl p-2.5 bg-slate-50/70 dark:bg-white/[0.02] text-xs">
                  <button
                    type="button"
                    onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                    className="w-full flex items-center justify-between font-bold text-slate-900 dark:text-white pb-1 cursor-pointer"
                  >
                    <span>Resumen de la Venta</span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                      {isSummaryExpanded ? "Ocultar" : "Ver"}
                      {isSummaryExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </button>
                  {isSummaryExpanded && (
                    <div className="space-y-1 pt-1.5 border-t border-slate-200/80 dark:border-white/[0.06] text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>Subtotal ({summary.itemsCount} items)</span>
                        <span className="font-mono">{formatCOP(summary.subtotal)}</span>
                      </div>
                      {serviceType === "DELIVERY" && (
                        <div className="flex justify-between text-purple-700 dark:text-purple-400">
                          <span>Tarifa de domicilio</span>
                          <span className="font-mono">+{formatCOP(deliveryDetails.deliveryFee)}</span>
                        </div>
                      )}
                      {(tipPercentage > 0 || customTip > 0) && (
                        <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                          <span>Propina</span>
                          <span className="font-mono">
                            +{formatCOP(customTip > 0 ? customTip : Math.round((summary.subtotal * tipPercentage) / 100))}
                          </span>
                        </div>
                      )}
                      {generalDiscount > 0 && (
                        <div className="flex justify-between text-rose-600 font-semibold">
                          <span>Descuento aplicado</span>
                          <span className="font-mono">-{formatCOP(generalDiscount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200/80 dark:border-white/[0.08]">
                        <span>Total neto</span>
                        <span className="font-mono text-[#ED500A] font-black">{formatCOP(summary.total)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* BLOQUE CLIENTE ASIGNADO */}
                <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-xl p-2.5 bg-slate-50/70 dark:bg-white/[0.02] text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#ED500A]" />
                      Cliente del pedido
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSelectCustomerModalOpen(true)}
                      className="text-[11px] font-bold text-[#ED500A] hover:underline cursor-pointer"
                    >
                      {selectedCustomer.id === "general" ? "+ Asignar cliente" : "Cambiar"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.06]">
                    <div className="min-w-0 pr-2">
                      <span className="font-bold text-slate-900 dark:text-white block truncate">
                        {selectedCustomer.name}
                      </span>
                      {selectedCustomer.phone && (
                        <span className="text-[10px] text-slate-400 font-mono block">
                          Tel: {selectedCustomer.phone}
                        </span>
                      )}
                    </div>
                    {selectedCustomer.id !== "general" && (
                      <button
                        type="button"
                        onClick={() => setSelectedCustomer({ id: "general", name: "Cliente General" })}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                        title="Restablecer a Cliente General"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* BLOQUE RESPONSABLE DEL PEDIDO */}
                <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-xl p-2.5 bg-slate-50/70 dark:bg-white/[0.02]">
                  <PosResponsibleSelector
                    staffList={staffList}
                    selectedStaffId={selectedStaffId}
                    onSelectStaff={(staff) => setSelectedStaffId(staff.id)}
                  />
                </div>

                {/* BLOQUE B: SERVICIO (PASO 1) */}
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-2">
                    1. Tipo de Servicio
                  </span>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setServiceType("TAKEOUT")}
                      className={`min-h-[84px] py-3 px-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer text-center group ${
                        serviceType === "TAKEOUT"
                          ? "border-[#ED500A] bg-[#ED500A]/10 text-[#ED500A] shadow-xs"
                          : "border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/[0.15]"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                        serviceType === "TAKEOUT" ? "bg-[#ED500A] text-white shadow-xs" : "bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300"
                      }`}>
                        <ShoppingBag className="w-4 h-4 shrink-0" />
                      </div>
                      <div>
                        <span className="block font-bold text-xs leading-tight">Para llevar</span>
                        <span className="text-[10px] opacity-75 font-medium leading-tight">Empacado</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setServiceType("DINE_IN")}
                      className={`min-h-[84px] py-3 px-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer text-center group ${
                        serviceType === "DINE_IN"
                          ? "border-[#ED500A] bg-[#ED500A]/10 text-[#ED500A] shadow-xs"
                          : "border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/[0.15]"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                        serviceType === "DINE_IN" ? "bg-[#ED500A] text-white shadow-xs" : "bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300"
                      }`}>
                        <Store className="w-4 h-4 shrink-0" />
                      </div>
                      <div>
                        <span className="block font-bold text-xs leading-tight">En local</span>
                        <span className="text-[10px] opacity-75 font-medium leading-tight">Atención presencial</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setServiceType("PICKUP")}
                      className={`min-h-[84px] py-3 px-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer text-center group ${
                        serviceType === "PICKUP"
                          ? "border-[#ED500A] bg-[#ED500A]/10 text-[#ED500A] shadow-xs"
                          : "border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/[0.15]"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                        serviceType === "PICKUP" ? "bg-[#ED500A] text-white shadow-xs" : "bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300"
                      }`}>
                        <Receipt className="w-4 h-4 shrink-0" />
                      </div>
                      <div>
                        <span className="block font-bold text-xs leading-tight">Para recoger</span>
                        <span className="text-[10px] opacity-75 font-medium leading-tight">Retiro en caja</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setServiceType("DELIVERY")}
                      className={`min-h-[84px] py-3 px-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer text-center group ${
                        serviceType === "DELIVERY"
                          ? "border-[#ED500A] bg-[#ED500A]/10 text-[#ED500A] shadow-xs"
                          : "border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/[0.15]"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                        serviceType === "DELIVERY" ? "bg-[#ED500A] text-white shadow-xs" : "bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300"
                      }`}>
                        <Bike className="w-4 h-4 shrink-0" />
                      </div>
                      <div>
                        <span className="block font-bold text-xs leading-tight">Domicilio</span>
                        <span className="text-[10px] opacity-75 font-medium leading-tight">Envío con flete</span>
                      </div>
                    </button>
                  </div>

                  {/* Campos condicionales para Comer aquí */}
                  {serviceType === "DINE_IN" && (
                    <div className="mt-2 p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900/40 text-xs">
                      <label className="block text-[10px] font-bold text-blue-900 dark:text-blue-300 mb-1">
                        Selecciona Mesa
                      </label>
                      <Select
                        selectSize="sm"
                        value={selectedTableId}
                        onChange={(e) => setSelectedTableId(e.target.value)}
                      >
                        <option value="">Mesa Principal / Mostrador</option>
                        {tables.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name_or_number} (Capacidad: {t.capacity || 4})
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}

                  {/* Campos condicionales para Domicilio */}
                  {serviceType === "DELIVERY" && (
                    <div className="mt-2 p-2.5 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-900/40 text-xs space-y-2">
                      <div>
                        <label className="block text-[10px] font-bold text-purple-900 dark:text-purple-300 mb-0.5">
                          Teléfono *
                        </label>
                        <input
                          type="tel"
                          placeholder="Ej. 300 123 4567"
                          value={deliveryDetails.phone}
                          onChange={(e) => setDeliveryDetails({ ...deliveryDetails, phone: e.target.value })}
                          className="w-full h-8 px-2 rounded border border-slate-300 dark:border-white/10 bg-white dark:bg-white/[0.03] text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-purple-900 dark:text-purple-300 mb-0.5">
                          Nombre del cliente *
                        </label>
                        <input
                          type="text"
                          placeholder="Nombre receptor"
                          value={deliveryDetails.name}
                          onChange={(e) => setDeliveryDetails({ ...deliveryDetails, name: e.target.value })}
                          className="w-full h-8 px-2 rounded border border-slate-300 dark:border-white/10 bg-white dark:bg-white/[0.03] text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-purple-900 dark:text-purple-300 mb-0.5">
                          Dirección de entrega *
                        </label>
                        <input
                          type="text"
                          placeholder="Calle, carrera, apto..."
                          value={deliveryDetails.address}
                          onChange={(e) => setDeliveryDetails({ ...deliveryDetails, address: e.target.value })}
                          className="w-full h-8 px-2 rounded border border-slate-300 dark:border-white/10 bg-white dark:bg-white/[0.03] text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-purple-900 dark:text-purple-300 mb-0.5">
                          Tarifa de Domicilio ($)
                        </label>
                        <input
                          type="number"
                          value={deliveryDetails.deliveryFee}
                          onChange={(e) => setDeliveryDetails({ ...deliveryDetails, deliveryFee: parseFloat(e.target.value) || 0 })}
                          className="w-full h-8 px-2 rounded border border-slate-300 dark:border-white/10 bg-white dark:bg-white/[0.03] text-slate-900 dark:text-white font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* Campos obligatorios para Para recoger [POS-008] */}
                  {serviceType === "PICKUP" && (
                    <div className="mt-2.5 p-3 bg-amber-500/5 dark:bg-amber-500/10 rounded-2xl border border-amber-500/20 text-xs space-y-2.5 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-800 dark:text-amber-300 text-[11px] flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          Datos de quien recoge el pedido
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                          Obligatorio
                        </span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Nombre de quien recoge *
                        </label>
                        <input
                          type="text"
                          placeholder="Nombre completo"
                          value={takeoutDetails.name}
                          onChange={(e) => setTakeoutDetails({ ...takeoutDetails, name: e.target.value })}
                          className="w-full h-8 px-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Teléfono de contacto *
                        </label>
                        <input
                          type="tel"
                          placeholder="Ej. 300 123 4567"
                          value={takeoutDetails.phone}
                          onChange={(e) => setTakeoutDetails({ ...takeoutDetails, phone: e.target.value })}
                          className="w-full h-8 px-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#0D0F16] text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                        />
                      </div>

                      <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={takeoutDetails.saveCustomer}
                          onChange={(e) => setTakeoutDetails({ ...takeoutDetails, saveCustomer: e.target.checked })}
                          className="w-3.5 h-3.5 rounded text-[#ED500A] focus:ring-[#ED500A] accent-[#ED500A] cursor-pointer"
                        />
                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                          Guardar este cliente para futuras compras
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* BLOQUE RESPONSABLE: ASIGNACIÓN DE RESPONSABLE (PASO 2) */}
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-2">
                    2. Responsable del pedido
                  </span>
                  <PosResponsibleSelector
                    staffList={staffList}
                    selectedStaffId={selectedStaff?.id || selectedStaffId}
                    onSelectStaff={(staff) => setSelectedStaffId(staff.id)}
                  />
                </div>

                {/* BLOQUE C: CUÁNDO SE COBRA EL PEDIDO (PASO 3) */}
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-2">
                    3. Cobro del pedido
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setPaymentTiming("pay_now")}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 font-bold transition cursor-pointer min-h-[58px] ${
                        paymentTiming === "pay_now"
                          ? "border-[#ED500A] bg-[#ED500A]/10 text-[#ED500A] ring-1 ring-[#ED500A]"
                          : "border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/[0.15]"
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Cobrar ahora</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentTiming("pay_later")}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 font-bold transition cursor-pointer min-h-[58px] ${
                        paymentTiming === "pay_later"
                          ? "border-[#ED500A] bg-[#ED500A]/10 text-[#ED500A] ring-1 ring-[#ED500A]"
                          : "border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/[0.15]"
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span>Dejar pago pendiente</span>
                    </button>
                  </div>
                </div>

                {/* BLOQUE D: PROPINA (OPCIONAL) */}
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-1.5">
                    Propina (Opcional)
                  </span>
                  <div className="grid grid-cols-4 gap-1 text-xs">
                    {[0, 10, 15, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setTipPercentage(pct);
                          setCustomTip(0);
                        }}
                        className={`py-2 rounded-xl border font-bold transition cursor-pointer text-xs ${
                          tipPercentage === pct && customTip === 0
                            ? "bg-[#ED500A] text-white border-[#ED500A]"
                            : "bg-white dark:bg-[#0D0F16] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/[0.15]"
                        }`}
                      >
                        {pct === 0 ? "Sin propina" : `${pct}%`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* BLOQUE E: DESCUENTO Y NOTAS (OPCIONAL) */}
                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                      Descuento general ($)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={generalDiscount || ""}
                      onChange={(e) => setGeneralDiscount(parseFloat(e.target.value) || 0)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                      Nota de la orden
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Enviar cubiertos y servilletas extra"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ED500A]/30 focus:border-[#ED500A]"
                    />
                  </div>
                </div>
              </div>

              {/* Pie Fijo del Checkout con Total y Confirmar */}
              <div className="p-3 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.02] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total:</span>
                  <span className="text-lg font-black text-[#ED500A] font-mono">{formatCOP(summary.total)}</span>
                </div>

                <button
                  type="button"
                  onClick={handleCreateOrder}
                  disabled={isSubmittingSale || cartItems.length === 0}
                  className="w-full py-3.5 rounded-xl bg-[#ED500A] hover:bg-[#d94608] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg shadow-[#ED500A]/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {isSubmittingSale ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Procesando pedido...</span>
                    </>
                  ) : paymentTiming === "pay_now" ? (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      <span>Confirmar y cobrar</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar pedido (Pendiente)</span>
                    </>
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsCreateQuotationModalOpen(true)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline cursor-pointer"
                  >
                    Crear cotización (no afecta el stock)
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* 3. MODALES OPERATIVOS [POS-006] */}
      {/* Modal de Ítem Libre */}
      <PosItemLibreModal
        isOpen={isItemLibreModalOpen}
        onClose={() => setIsItemLibreModalOpen(false)}
        onAddItem={handleAddItemLibre}
      />

      {/* Modal de Descuento Individual */}
      <PosDiscountModal
        isOpen={Boolean(discountItem)}
        itemName={discountItem?.productName || ""}
        itemPrice={discountItem ? discountItem.unitPrice * discountItem.quantity : 0}
        onClose={() => setDiscountItem(null)}
        onApplyDiscount={handleApplyLineDiscount}
      />

      {/* Modal de Editar Precio */}
      <PosEditPriceModal
        isOpen={Boolean(editPriceItem)}
        itemName={editPriceItem?.productName || ""}
        currentUnitPrice={editPriceItem?.unitPrice || 0}
        onClose={() => setEditPriceItem(null)}
        onSavePrice={handleApplyNewUnitPrice}
      />

      {/* Modal de Selección de Cliente */}
      <PosSelectCustomerModal
        isOpen={isSelectCustomerModalOpen}
        businessId={businessId}
        selectedCustomerId={selectedCustomer.id}
        onClose={() => setIsSelectCustomerModalOpen(false)}
        onCreateNewCustomer={() => {
          setIsSelectCustomerModalOpen(false);
          setIsQuickCreateCustomerModalOpen(true);
        }}
        onSelectCustomer={(cust: PosCustomerItem) => {
          setSelectedCustomer({
            id: cust.id || "general",
            name: cust.name,
            document: cust.documentNumber || undefined,
            phone: cust.phone || undefined,
          });
          if (cust.name && cust.id !== "general" && cust.id !== "default") {
            setTakeoutDetails((prev) => ({
              ...prev,
              name: cust.name,
              phone: cust.phone || prev.phone,
            }));
          }
          setIsSelectCustomerModalOpen(false);
          toast.success(`Cliente «${cust.name}» asignado.`);
        }}
      />

      {/* Modal Rápido de Creación de Cliente desde POS */}
      <PosQuickCreateCustomerModal
        isOpen={isQuickCreateCustomerModalOpen}
        onClose={() => setIsQuickCreateCustomerModalOpen(false)}
        businessId={businessId}
        onCustomerCreated={(newCust: PosCustomerItem) => {
          setSelectedCustomer({
            id: newCust.id || "general",
            name: newCust.name,
            document: newCust.documentNumber || undefined,
            phone: newCust.phone || undefined,
          });
          if (newCust.name && newCust.id !== "general" && newCust.id !== "default") {
            setTakeoutDetails((prev) => ({
              ...prev,
              name: newCust.name,
              phone: newCust.phone || prev.phone,
            }));
          }
        }}
      />

      {/* Modal de Comanda de Cocina */}
      {kitchenTicketData && (
        <PosKitchenTicketModal
          isOpen={Boolean(kitchenTicketData)}
          data={kitchenTicketData}
          onClose={() => setKitchenTicketData(null)}
        />
      )}

      {/* Modal de Factura / Recibo de Venta */}
      {invoiceTicketData && (
        <PosInvoiceModal
          isOpen={Boolean(invoiceTicketData)}
          data={invoiceTicketData}
          onClose={() => setInvoiceTicketData(null)}
        />
      )}

      {/* Panel Lateral de Tickets Abiertos */}
      <PosOpenTicketsDrawer
        isOpen={isOpenTicketsDrawerOpen}
        onClose={() => setIsOpenTicketsDrawerOpen(false)}
        businessId={businessId}
        onPayTicket={handlePayExistingTicket}
      />

      {/* Modal de Apertura de Turno de Caja [POS-001] */}
      <OpenCashShiftModal
        isOpen={isOpenCashShiftModalOpen && !activeCashSession}
        businessId={businessId}
        registers={cashRegisters}
        onClose={() => setIsOpenCashShiftModalOpen(false)}
        onSessionOpened={(session) => {
          setActiveCashSession(session);
          setCurrentCashBalance(session.initialAmount);
          setIsOpenCashShiftModalOpen(false);
          router.refresh();
        }}
      />

      {/* Modal de Cobro de Pedido Abierto [POS-002] */}
      {orderToPay && (
        <OrderPaymentModal
          isOpen={Boolean(orderToPay)}
          order={orderToPay}
          paymentMethods={initialPaymentMethods}
          isSubmitting={isPaymentSubmitting}
          onClose={() => setOrderToPay(null)}
          onConfirm={async (data) => {
            setIsPaymentSubmitting(true);
            try {
              const res = await registerRestaurantOrderPaymentAction(businessId, orderToPay.id, data);
              if (res.success) {
                toast.success(`¡Pedido #${orderToPay.order_number} pagado exitosamente!`, {
                  description: "Estado financiero: Pagado",
                });

                const isCash = typeof data === "string" ? data === "cash" : data.paymentMethod === "cash";
                if (isCash) {
                  setCurrentCashBalance((prev) => (typeof prev === "number" ? prev + (orderToPay.total || 0) : orderToPay.total || 0));
                }

                // Generar datos para modal de factura de venta térmica
                const finalDocNumber = res.documentNumber || `V-${String(orderToPay.order_number).padStart(4, "0")}`;
                const iTicket: InvoiceData = {
                  orderNumber: orderToPay.order_number,
                  invoiceFolio: finalDocNumber,
                  businessName: tradeName || businessName || "NEGOVA POS",
                  logoUrl: logoUrl || null,
                  taxRegime: "No responsable de IVA",
                  createdAt: new Date().toLocaleString("es-CO"),
                  customerName: orderToPay.customer_name || "Cliente General",
                  customerPhone: orderToPay.customer_phone || undefined,
                  customerAddress: orderToPay.delivery_address || undefined,
                  serviceType: orderToPay.order_type === "dine_in" ? "Comer Aquí" : orderToPay.order_type === "takeout" ? "Para llevar" : "Domicilio",
                  saleType: "Contado",
                  paymentMethodName: typeof data === "string" ? data : (data.paymentMethod || "Efectivo"),
                  items: ((orderToPay.items || (orderToPay as any).restaurant_order_items || []) as any[]).map((ci: any) => ({
                    name: ci.product_name,
                    quantity: ci.quantity,
                    unitPrice: ci.unit_price,
                    subtotal: ci.subtotal,
                  })),
                  subtotal: orderToPay.subtotal || orderToPay.total,
                  deliveryFee: orderToPay.delivery_fee || 0,
                  tipAmount: typeof data !== "string" && data.tip ? data.tip.amount : 0,
                  discountAmount: typeof data !== "string" && data.discount ? data.discount.value : 0,
                  total: orderToPay.total,
                };

                setInvoiceTicketData(iTicket);
                setOrderToPay(null);
                setIsOpenTicketsDrawerOpen(false);
                router.refresh();
              } else {
                toast.error(res.error || "No se pudo registrar el pago.");
              }
            } catch (err: any) {
              toast.error(err?.message || "Error al procesar el pago.");
            } finally {
              setIsPaymentSubmitting(false);
            }
          }}
        />
      )}

      {/* Modales Complementarios Existentes */}
      <ModifierSelectionModal
        isOpen={Boolean(productForModifiers)}
        product={productForModifiers}
        onClose={() => setProductForModifiers(null)}
        onConfirm={(selectedMods, qty, notes, selectedVariant) => {
          if (productForModifiers) {
            handleAddToCart(productForModifiers, selectedMods, qty, notes, selectedVariant);
          }
        }}
      />

      <ConfirmModal
        isOpen={isClearCartConfirmOpen}
        onClose={() => setIsClearCartConfirmOpen(false)}
        onConfirm={handleClearCart}
        title="¿Vaciar venta actual?"
        description="Se eliminarán todos los productos seleccionados en esta venta."
        confirmText="Vaciar venta"
        variant="danger"
      />

      <CreateQuotationModal
        isOpen={isCreateQuotationModalOpen}
        businessId={businessId}
        cartItems={cartItems}
        summary={summary}
        onClose={() => setIsCreateQuotationModalOpen(false)}
        onSuccess={() => {}}
      />

      <QuotationsListModal
        isOpen={isQuotationsListModalOpen}
        businessId={businessId}
        onClose={() => setIsQuotationsListModalOpen(false)}
        onLoadIntoCart={handleLoadQuotationIntoCart}
      />

      {activeCashSession && (
        <CashMovementModal
          isOpen={isCashMovementModalOpen}
          businessId={businessId}
          sessionId={activeCashSession.id}
          registerName={cashRegisters.find((r) => r.id === activeCashSession.registerId)?.name || "Caja Principal"}
          currentCashInDrawer={currentCashBalance}
          initialType={cashMovementInitialType}
          onClose={() => setIsCashMovementModalOpen(false)}
          onSuccess={(newBalance) => {
            setCurrentCashBalance(newBalance);
            router.refresh();
          }}
        />
      )}



      <BarcodeScannerModal
        isOpen={isBarcodeModalOpen}
        onClose={() => setIsBarcodeModalOpen(false)}
        onScan={handleBarcodeScan}
      />

      {/* BARRA INFERIOR PERSISTENTE MÓVIL */}
      {summary.itemsCount > 0 && !isMobileCartOpen && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/95 dark:bg-[#0B0E14]/95 backdrop-blur-md border-t border-slate-200 dark:border-white/[0.08] shadow-lg z-40 safe-area-inset-bottom">
          <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setIsMobileCartOpen(true)}
              className="flex items-center gap-2.5 text-left min-w-0 flex-1 hover:opacity-90 active:scale-[0.99] transition-transform min-h-[48px]"
            >
              <div className="relative w-11 h-11 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center shrink-0">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#ED500A] text-white text-[11px] font-black flex items-center justify-center shadow-xs">
                  {summary.itemsCount}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {summary.itemsCount} {summary.itemsCount === 1 ? "producto" : "productos"}
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                  {formatCOP(summary.total)}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsMobileCartOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl font-bold text-xs bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-lg shadow-[#ED500A]/25 shrink-0 active:scale-[0.98] transition-transform min-h-[44px] cursor-pointer"
            >
              <span>Ver Venta</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* DRAWER MÓVIL PARA VER PEDIDO */}
      {isMobileCartOpen && (
        <ModalPortal>
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full bg-white dark:bg-[#0D0F16] rounded-t-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden border-t border-slate-200/80 dark:border-white/[0.08]">
              <div className="p-3 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Tu pedido ({summary.itemsCount})
                </h3>
                <button
                  type="button"
                  onClick={() => setIsMobileCartOpen(false)}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {cartItems.map((item) => {
                  const itemImage =
                    item.productImage ||
                    products.find((p) => p.id === item.productId)?.image_url;

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden shrink-0 flex items-center justify-center">
                          {itemImage ? (
                            <img
                              src={itemImage}
                              alt={item.productName}
                              className="w-full h-full object-cover"
                            />
                          ) : item.isCustom ? (
                            <FileText className="w-4 h-4 text-[#ED500A]" />
                          ) : (
                            <Layers className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {item.productName}
                          </h4>
                          <span className="text-xs font-black text-[#ED500A] font-mono">
                            {formatCOP(item.lineTotal)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center bg-slate-100 dark:bg-white/[0.05] rounded-xl border border-slate-200/80 dark:border-white/[0.08] p-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="w-7 h-7 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/[0.1] hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center cursor-pointer"
                          title="Disminuir cantidad"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-xs font-black text-slate-900 dark:text-white font-mono">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="w-7 h-7 rounded-lg bg-[#ED500A] text-white hover:bg-[#ED500A]/90 transition shadow-xs flex items-center justify-center cursor-pointer"
                          title="Aumentar cantidad"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 border-t border-slate-200/80 dark:border-white/[0.08] space-y-2 bg-slate-50/70 dark:bg-white/[0.02]">
                <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white">
                  <span>Total:</span>
                  <span className="text-[#ED500A] font-mono">{formatCOP(summary.total)}</span>
                </div>
                <button
                  type="button"
                  disabled={cartItems.length === 0}
                  onClick={() => {
                    setIsMobileCartOpen(false);
                    setIsCheckoutStepActive(true);
                  }}
                  className="w-full py-3 rounded-xl bg-[#ED500A] hover:bg-[#d94608] text-white font-bold text-sm min-h-[44px] cursor-pointer shadow-lg shadow-[#ED500A]/25 transition active:scale-[0.99] flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Continuar Cobro</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
