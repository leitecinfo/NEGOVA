"use client";

import React, { useState, useTransition, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutGrid,
  Plus,
  Users,
  UtensilsCrossed,
  Clock,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Unlock,
  RefreshCw,
  Search,
  X,
  FileText,
  User,
  ShoppingBag,
  DollarSign,
  Sparkles,
  MoreVertical,
  Armchair,
  Receipt,
  Eye,
  ListFilter,
  Layers,
  QrCode,
  Copy,
  Download,
  Calendar,
  ArrowRight,
  TrendingUp,
  MapPin,
  HelpCircle,
  Smartphone,
  EyeOff,
  Flame,
  ArrowLeftRight,
} from "lucide-react";
import { toast } from "sonner";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Input, Select, SearchSelect, SearchInput } from "@/components/ui";
import { CreateRoomModal } from "@/components/mesas/create-room-modal";
import { CloseTableOrderModal } from "@/components/mesas/close-table-order-modal";
import { TableCommandTicketModal } from "@/components/mesas/table-command-ticket-modal";
import { ModalPortal } from "@/components/ui/modal-portal";
import { TableBlueprintIllustration } from "@/components/mesas/table-blueprint-illustration";
import { TableFloorPlanView } from "@/components/mesas/table-floor-plan-view";
import {
  getStoredTableShape,
  saveStoredTableShape,
  inferTableShape,
} from "@/lib/restaurant/table-layout-storage";
import {
  createRestaurantTableAction,
  updateRestaurantTableAction,
  deleteRestaurantTableAction,
  releaseRestaurantTableAction,
  transferRestaurantTableAction,
  getTableQrDataAction,
  regenerateTableQrAction,
  toggleTableQrActiveAction,
  updateRestaurantRoomAction,
  deleteRestaurantRoomAction,
  getRestaurantTableTransfersHistoryAction,
} from "./actions";
import type {
  RestaurantTableWithOrder,
  RestaurantTablesSummary,
  CreateTableInput,
  UpdateTableInput,
  RestaurantRoom,
  RestaurantRoomWithTables,
  TableShape,
} from "@/lib/restaurant/types";

interface TablesDashboardClientProps {
  businessId: string;
  businessName: string;
  initialTables: RestaurantTableWithOrder[];
  initialSummary: RestaurantTablesSummary;
  initialRooms?: RestaurantRoomWithTables[];
  locations?: any[];
  canManageTables: boolean;
}

export function TablesDashboardClient({
  businessId,
  businessName,
  initialTables,
  initialSummary,
  initialRooms = [],
  locations = [],
  canManageTables,
}: TablesDashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Pestaña principal activa: Mesas | Salas | Traslados | Rendimiento
  const [activeMainTab, setActiveMainTab] = useState<"mesas" | "salas" | "traslados" | "rendimiento">("mesas");

  // Filtros de mesas
  const [selectedRoomId, setSelectedRoomId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "occupied">("all");
  const [tablesViewMode, setTablesViewMode] = useState<"cards" | "plan">("cards");
  const [shapeVersion, setShapeVersion] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [customTableShapes, setCustomTableShapes] = useState<Record<string, TableShape>>({});

  // Carga las formas personalizadas únicamente tras montar en cliente para evitar mismatch de hidratación SSR
  useEffect(() => {
    setIsMounted(true);
    const loaded: Record<string, TableShape> = {};
    for (const t of initialTables) {
      loaded[t.id] = getStoredTableShape(businessId, t.id, t.capacity, t.name_or_number);
    }
    setCustomTableShapes(loaded);
  }, [businessId, initialTables, shapeVersion]);

  // Resuelve de forma determinista la forma (en SSR y primera hidratación usa inferTableShape consistente)
  const getResolvedTableShape = useCallback(
    (table: RestaurantTableWithOrder): TableShape => {
      if (!isMounted) {
        return inferTableShape(table.capacity, table.name_or_number);
      }
      return customTableShapes[table.id] || inferTableShape(table.capacity, table.name_or_number);
    },
    [isMounted, customTableShapes]
  );

  // Modales superiores
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState(false);
  const [isCloseOrdersModalOpen, setIsCloseOrdersModalOpen] = useState(false);
  const [closeOrderInitialTableId, setCloseOrderInitialTableId] = useState<string | null>(null);
  const [commandTicketTable, setCommandTicketTable] = useState<RestaurantTableWithOrder | null>(null);
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);

  // Modales de mesas
  const [isCreateTableModalOpen, setIsCreateTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTableWithOrder | null>(null);
  const [tableToDelete, setTableToDelete] = useState<RestaurantTableWithOrder | null>(null);
  const [tableToRelease, setTableToRelease] = useState<RestaurantTableWithOrder | null>(null);
  const [activeDropdownTableId, setActiveDropdownTableId] = useState<string | null>(null);

  // Modal QR
  const [qrModalTable, setQrModalTable] = useState<RestaurantTableWithOrder | null>(null);
  const [qrTokenData, setQrTokenData] = useState<{ token: string; version: number; isActive: boolean } | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);

  // Modal y estado de Traslados
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSourceTableId, setTransferSourceTableId] = useState<string>("");
  const [transferTargetTableId, setTransferTargetTableId] = useState<string>("");
  const [transferNotes, setTransferNotes] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transfersHistory, setTransfersHistory] = useState<Array<{
    id: string;
    sourceTableName: string;
    targetTableName: string;
    orderNumber?: number;
    userName?: string;
    transferredAt: string;
    notes?: string;
  }>>([]);
  const [isLoadingTransfers, setIsLoadingTransfers] = useState(false);

  // Modal y estado de Edición/Eliminación de Salas
  const [roomToEdit, setRoomToEdit] = useState<RestaurantRoom | null>(null);
  const [editRoomName, setEditRoomName] = useState("");
  const [roomToDelete, setRoomToDelete] = useState<RestaurantRoom | null>(null);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);

  // Estados de Rendimiento / Mapa de Calor
  const [heatMapPeriod, setHeatMapPeriod] = useState<"today" | "week" | "month">("today");
  const [heatMapMetric, setHeatMapMetric] = useState<"revenue" | "orders">("revenue");

  // Formas de mesa seleccionadas (Dibujo arquitectónico)
  const [createTableShape, setCreateTableShape] = useState<TableShape>("round");
  const [editTableShape, setEditTableShape] = useState<TableShape>("round");

  // Formulario creación de mesa
  const [createTableForm, setCreateTableForm] = useState<CreateTableInput>({
    name_or_number: "",
    capacity: 4,
    sort_order: 0,
    room_id: undefined,
  });

  // Formulario edición de mesa
  const [editTableForm, setEditTableForm] = useState<UpdateTableInput>({
    name_or_number: "",
    capacity: 4,
    sort_order: 0,
    room_id: undefined,
  });

  const [formError, setFormError] = useState<string | null>(null);

  // Cerrar menús al hacer click afuera
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdownTableId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cargar historial de traslados al cambiar a la pestaña de Traslados
  useEffect(() => {
    if (activeMainTab === "traslados") {
      setIsLoadingTransfers(true);
      getRestaurantTableTransfersHistoryAction(businessId)
        .then((res) => {
          if (res.success && res.data) {
            setTransfersHistory(res.data);
          }
        })
        .finally(() => setIsLoadingTransfers(false));
    }
  }, [activeMainTab, businessId]);

  // Sincronización automática periódica
  useEffect(() => {
    const handleFocus = () => {
      if (tablesViewMode !== "plan") router.refresh();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && tablesViewMode !== "plan") {
        router.refresh();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && tablesViewMode !== "plan") {
        router.refresh();
      }
    }, 15000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [router, tablesViewMode]);

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat("es-CO", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return isoString;
    }
  };

  // Minutos transcurridos
  const getElapsedMinutes = (isoString?: string) => {
    if (!isoString) return 0;
    try {
      const diffMs = Math.max(0, Date.now() - new Date(isoString).getTime());
      return Math.floor(diffMs / (1000 * 60));
    } catch {
      return 0;
    }
  };

  const formatElapsedTime = (minutes: number) => {
    if (minutes < 1) return "Recién abierta";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rem = minutes % 60;
    return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
  };

  // Mesas filtradas por sala, estado y búsqueda
  const filteredTables = useMemo(() => {
    return initialTables.filter((tbl) => {
      if (selectedRoomId !== "all") {
        if (tbl.room_id !== selectedRoomId) return false;
      }
      if (statusFilter !== "all" && tbl.status !== statusFilter) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = tbl.name_or_number.toLowerCase().includes(q);
        const matchesCust = tbl.activeOrder?.customer_name?.toLowerCase().includes(q) || false;
        const matchesNum = String(tbl.activeOrder?.order_number || "") === q.replace(/^#/, "");
        if (!matchesName && !matchesCust && !matchesNum) return false;
      }
      return true;
    });
  }, [initialTables, selectedRoomId, statusFilter, search]);

  const occupiedTables = useMemo(
    () => initialTables.filter((t) => t.status === "occupied"),
    [initialTables]
  );
  const availableTables = useMemo(
    () => initialTables.filter((t) => t.status === "available"),
    [initialTables]
  );

  // Salas enriquecidas con conteo de mesas
  const roomsList = useMemo(() => {
    return initialRooms.map((r) => {
      const count = initialTables.filter((t) => t.room_id === r.id).length;
      return { ...r, tablesCount: count };
    });
  }, [initialRooms, initialTables]);

  // Salas para visualizar en el Plano Salón
  const roomsToDisplay = useMemo(() => {
    if (selectedRoomId === "all") {
      return roomsList;
    }
    const matched = roomsList.find((r) => r.id === selectedRoomId);
    return matched ? [matched] : [];
  }, [selectedRoomId, roomsList]);

  // Manejador apertura traslado
  const handleOpenTransferModal = () => {
    if (occupiedTables.length < 1 || initialTables.length < 2) {
      toast.warning("Mesas insuficientes: Necesitas al menos 2 mesas (y al menos 1 ocupada) para realizar traslados.");
      return;
    }
    setTransferSourceTableId(occupiedTables[0]?.id || "");
    setTransferTargetTableId(availableTables[0]?.id || "");
    setTransferNotes("");
    setIsTransferModalOpen(true);
  };

  const handleExecuteTransfer = async () => {
    if (!transferSourceTableId || !transferTargetTableId) {
      toast.error("Debes seleccionar una mesa de origen y una mesa de destino.");
      return;
    }
    if (transferSourceTableId === transferTargetTableId) {
      toast.error("La mesa de origen y destino deben ser diferentes.");
      return;
    }

    setIsTransferring(true);
    try {
      const res = await transferRestaurantTableAction(
        businessId,
        transferSourceTableId,
        transferTargetTableId,
        transferNotes.trim() || undefined
      );

      if (res.success) {
        toast.success("Mesa trasladada exitosamente.");
        setIsTransferModalOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "No se pudo realizar el traslado de la mesa.");
      }
    } catch {
      toast.error("Ocurrió un error al procesar el traslado.");
    } finally {
      setIsTransferring(false);
    }
  };

  // Manejo de crear mesa rápida
  const handleOpenCreateTableModal = (roomIdToAssign?: string) => {
    const defaultRoomId =
      roomIdToAssign ||
      (selectedRoomId !== "all" ? selectedRoomId : roomsList[0]?.id || undefined);
    setCreateTableForm({
      name_or_number: `Mesa ${initialTables.length + 1}`,
      capacity: 4,
      sort_order: initialTables.length + 1,
      room_id: defaultRoomId,
    });
    setCreateTableShape("round");
    setFormError(null);
    setIsCreateTableModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTableForm.name_or_number.trim()) {
      setFormError("El nombre o número de la mesa es requerido.");
      return;
    }
    if (roomsList.length > 0 && !createTableForm.room_id) {
      setFormError("Debes seleccionar una sala para la mesa.");
      return;
    }

    startTransition(async () => {
      const res = await createRestaurantTableAction(businessId, {
        ...createTableForm,
        shape: createTableShape,
      });
      if (res.success) {
        if (res.table?.id) {
          saveStoredTableShape(businessId, res.table.id, createTableShape);
          setCustomTableShapes((prev) => ({ ...prev, [res.table!.id]: createTableShape }));
        }
        setShapeVersion((v) => v + 1);
        toast.success(`Mesa «${createTableForm.name_or_number}» creada con éxito.`);
        setIsCreateTableModalOpen(false);
        router.refresh();
      } else {
        setFormError(res.error || "No se pudo registrar la mesa.");
        toast.error(res.error || "Error al crear la mesa.");
      }
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    if (!editTableForm.name_or_number?.trim()) {
      setFormError("El nombre de mesa es requerido.");
      return;
    }

    startTransition(async () => {
      const res = await updateRestaurantTableAction(businessId, editingTable.id, {
        ...editTableForm,
        shape: editTableShape,
      });
      if (res.success) {
        saveStoredTableShape(businessId, editingTable.id, editTableShape);
        setCustomTableShapes((prev) => ({ ...prev, [editingTable.id]: editTableShape }));
        setShapeVersion((v) => v + 1);
        toast.success(`Mesa «${editTableForm.name_or_number}» actualizada exitosamente.`);
        setEditingTable(null);
        router.refresh();
      } else {
        setFormError(res.error || "No se pudo actualizar la mesa.");
        toast.error(res.error || "Error al actualizar la mesa.");
      }
    });
  };

  const handleConfirmDelete = async () => {
    if (!tableToDelete) return;
    const target = tableToDelete;
    setTableToDelete(null);

    startTransition(async () => {
      const res = await deleteRestaurantTableAction(businessId, target.id);
      if (res.success) {
        toast.success(`Mesa «${target.name_or_number}» eliminada.`);
        router.refresh();
      } else {
        toast.error(res.error || "No se pudo eliminar la mesa.");
      }
    });
  };

  const handleConfirmRelease = async () => {
    if (!tableToRelease) return;
    const target = tableToRelease;
    setTableToRelease(null);

    startTransition(async () => {
      const res = await releaseRestaurantTableAction(businessId, target.id);
      if (res.success) {
        toast.success(`Mesa «${target.name_or_number}» liberada exitosamente.`);
        router.refresh();
      } else {
        toast.error(res.error || "No fue posible liberar la mesa.");
      }
    });
  };

  // Manejo de edición / eliminación de salas
  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomToEdit || !editRoomName.trim()) return;

    startTransition(async () => {
      const res = await updateRestaurantRoomAction(businessId, roomToEdit.id, {
        name: editRoomName.trim(),
      });
      if (res.success) {
        toast.success("Sala actualizada exitosamente.");
        setRoomToEdit(null);
        router.refresh();
      } else {
        toast.error(res.error || "No se pudo actualizar la sala.");
      }
    });
  };

  const handleToggleRoomVisibility = async (room: RestaurantRoom) => {
    const nextStatus = room.status === "active" ? "inactive" : "active";
    startTransition(async () => {
      const res = await updateRestaurantRoomAction(businessId, room.id, {
        status: nextStatus,
      });
      if (res.success) {
        toast.success(nextStatus === "active" ? "Sala visible." : "Sala oculta.");
        router.refresh();
      } else {
        toast.error(res.error || "No se pudo cambiar la visibilidad.");
      }
    });
  };

  const handleDeleteRoom = async () => {
    if (!roomToDelete) return;
    setIsDeletingRoom(true);
    try {
      const res = await deleteRestaurantRoomAction(businessId, roomToDelete.id);
      if (res.success) {
        toast.success(`Sala «${roomToDelete.name}» eliminada.`);
        setRoomToDelete(null);
        router.refresh();
      } else {
        toast.error(res.error || "No se pudo eliminar la sala.");
      }
    } finally {
      setIsDeletingRoom(false);
    }
  };

  // Métricas de Rendimiento calculadas
  const performanceKpis = useMemo(() => {
    const totalRevenue = occupiedTables.reduce((acc, t) => acc + (t.activeOrder?.total || 0), 0);
    const totalOrdersCount = occupiedTables.length;
    const totalDiners = occupiedTables.reduce((acc, t) => acc + (t.capacity || 4), 0);
    const totalOccupiedMinutes = occupiedTables.reduce(
      (acc, t) => acc + getElapsedMinutes(t.activeOrder?.created_at),
      0
    );

    return {
      revenue: totalRevenue,
      orders: totalOrdersCount,
      diners: totalDiners,
      totalMinutes: totalOccupiedMinutes,
    };
  }, [occupiedTables]);

  return (
    <AppPageContainer
      title="Gestión de Mesas"
      description="Salas, mesas y rendimiento."
    >
      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* PESTAÑAS DE NAVEGACIÓN DEL MÓDULO (ESTILO PRODUCTOS / INVENTARIO)          */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-white/[0.08] pb-1 overflow-x-auto no-scrollbar">
          {[
            { id: "mesas", label: "Mesas", icon: LayoutGrid, count: initialTables.length },
            { id: "salas", label: "Salas", icon: Layers, count: roomsList.length },
            { id: "traslados", label: "Traslados", icon: ArrowLeftRight },
            { id: "rendimiento", label: "Rendimiento", icon: Flame },
          ].map((tab) => {
            const isActive = activeMainTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveMainTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? "bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20 font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[#ED500A]" : "text-slate-400"}`} />
                <span>{tab.label}</span>
                {typeof tab.count === "number" && (
                  <span
                    className={`ml-1 text-2xs px-2 py-0.5 rounded-full font-bold transition-colors ${
                      isActive
                        ? "bg-[#ED500A]/15 text-[#ED500A] dark:bg-[#ED500A]/30"
                        : "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: MESAS                                                              */}
        {/* ========================================================================= */}
        {activeMainTab === "mesas" && (
          <div className="space-y-4">
            {/* Selector de salas y leyenda de estados */}
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 shadow-2xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Selector de Salas */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth pb-1 lg:pb-0">
                  <button
                    type="button"
                    onClick={() => setSelectedRoomId("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      selectedRoomId === "all"
                        ? "bg-[#ED500A] text-white shadow-xs"
                        : "bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 hover:bg-slate-200/60"
                    }`}
                  >
                    Todas las salas ({initialTables.length})
                  </button>

                  {roomsList.map((room) => {
                    const isSelected = selectedRoomId === room.id;
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? "bg-[#ED500A] text-white shadow-xs"
                            : "bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 hover:bg-slate-200/60"
                        }`}
                      >
                        <span>{room.name}</span>
                        <span className="text-3xs font-mono px-1.5 py-0.2 rounded-md bg-black/10 dark:bg-white/10">
                          {room.tablesCount}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Contador rápido */}
                <div className="flex items-center gap-2 text-xs font-mono font-semibold shrink-0">
                  <span className="px-2.5 py-1 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                    {occupiedTables.length} ocupadas
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400">
                    {availableTables.length} libres
                  </span>
                </div>
              </div>

              {/* Leyenda de estados de mesa */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                  <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider mr-1">
                    Estados:
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 text-xs">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    Libre
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Ocupado
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    +30 min
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 text-xs">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    +60 min
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Impreso
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* Selector de Modo de Vista: Tarjetas vs Plano 2D (Estilo Productos Tabla / Cuadrícula) */}
                  <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => setTablesViewMode("cards")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        tablesViewMode === "cards"
                          ? "bg-white dark:bg-[#1E2028] text-slate-900 dark:text-white shadow-2xs font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Lista Rápida</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTablesViewMode("plan")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        tablesViewMode === "plan"
                          ? "bg-white dark:bg-[#1E2028] text-slate-900 dark:text-white shadow-2xs font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Plano Salón</span>
                    </button>
                  </div>

                  {/* Buscador */}
                  <div className="w-full sm:w-56">
                    <SearchInput
                      inputSize="sm"
                      value={search}
                      onChange={setSearch}
                      onClear={() => setSearch("")}
                      placeholder="Buscar mesa..."
                    />
                  </div>

                  {/* Botón Nueva Mesa */}
                  {canManageTables && (
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={() => handleOpenCreateTableModal()}
                      className="shrink-0"
                    >
                      <span className="hidden sm:inline">Nueva </span>Mesa
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* VISTA SEGÚN MODO SELECCIONADO */}
            {tablesViewMode === "plan" ? (
              <div className="space-y-6">
                {roomsToDisplay.map((room) => {
                  const roomTables = filteredTables.filter((t) => t.room_id === room.id);
                  return (
                    <TableFloorPlanView
                      key={room.id}
                      businessId={businessId}
                      roomId={room.id}
                      roomName={room.name}
                      tables={roomTables}
                      canManageTables={canManageTables}
                      onOpenCommandTicket={(tbl) => setCommandTicketTable(tbl)}
                      onTableShapeChange={(tableId, newShape) => {
                        saveStoredTableShape(businessId, tableId, newShape);
                        setCustomTableShapes((prev) => ({ ...prev, [tableId]: newShape }));
                        setShapeVersion((v) => v + 1);
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              /* Grid de Mesas */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredTables.map((table) => {
                const isOccupied = table.status === "occupied";
                const activeOrder = table.activeOrder;
                const elapsedMins = getElapsedMinutes(activeOrder?.created_at);
                const isDropdownOpen = activeDropdownTableId === table.id;
                const roomName = table.roomName || (table.room_id ? roomsList.find((r) => r.id === table.room_id)?.name : undefined);

                if (isOccupied) {
                  return (
                    <div
                      key={table.id}
                      className="bg-white dark:bg-[#0D0F16] border border-red-200/80 dark:border-red-900/40 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all relative flex flex-col justify-between"
                    >
                      <div>
                        {/* Cabecera tarjeta ocupada */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            {/* Indicador numérico en fondo rojo */}
                            <div className="w-9 h-9 rounded-xl bg-red-600 text-white font-mono font-bold text-sm flex items-center justify-center shadow-xs">
                              {table.name_or_number.replace(/[^0-9]/g, "") || table.name_or_number.slice(0, 3)}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white text-xs block">
                                {table.name_or_number}
                              </span>
                              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {activeOrder?.diners_count
                                    ? `Comensales: ${activeOrder.diners_count} / ${table.capacity || 4}`
                                    : `Cap. ${table.capacity || 4} personas`}
                                </span>
                                {roomName && (
                                  <>
                                    <span className="text-slate-300 dark:text-slate-700">·</span>
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#ED500A]/10 text-[#ED500A] font-sans font-semibold text-[10px]">
                                      <Layers className="w-2.5 h-2.5" />
                                      {roomName}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Badge de comanda */}
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              {activeOrder?.status === "ready" ? "Listo" : "Ocupado"}
                            </span>

                            {/* Menú contextual ... */}
                            <div className="relative" ref={isDropdownOpen ? dropdownRef : undefined}>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveDropdownTableId(isDropdownOpen ? null : table.id)
                                }
                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-400 hover:text-slate-600 transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {isDropdownOpen && (
                                <div className="absolute right-0 top-7 z-30 w-44 rounded-xl bg-white dark:bg-[#121620] border border-slate-200 dark:border-white/[0.1] shadow-xl py-1 text-xs divide-y divide-slate-100 dark:divide-white/[0.06]">
                                  <div className="py-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveDropdownTableId(null);
                                        setCommandTicketTable(table);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06] text-left cursor-pointer font-medium"
                                    >
                                      <Receipt className="w-3.5 h-3.5 text-[#ED500A]" />
                                      <span>Ver comanda (ticket)</span>
                                    </button>
                                    <Link
                                      href={`/workspace/${businessId}/pos?tableId=${table.id}`}
                                      className="flex items-center gap-2 px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]"
                                    >
                                      <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Agregar productos en POS</span>
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveDropdownTableId(null);
                                        setTransferSourceTableId(table.id);
                                        setTransferTargetTableId(availableTables[0]?.id || "");
                                        setIsTransferModalOpen(true);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06] text-left cursor-pointer"
                                    >
                                      <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500" />
                                      <span>Trasladar mesa</span>
                                    </button>
                                  </div>
                                  <div className="py-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveDropdownTableId(null);
                                        setTableToRelease(table);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-left cursor-pointer font-medium"
                                    >
                                      <Unlock className="w-3.5 h-3.5" />
                                      <span>Liberar mesa</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Ilustración arquitectónica de la mesa y sus sillas */}
                        <div
                          onClick={() => setCommandTicketTable(table)}
                          className="my-2 py-2 flex items-center justify-center bg-red-950/20 dark:bg-red-950/30 rounded-xl border border-red-500/15 cursor-pointer hover:border-red-500/40 hover:bg-red-950/35 transition-all"
                          title="Haga clic para ver el ticket de la comanda"
                        >
                          <TableBlueprintIllustration
                            shape={getResolvedTableShape(table)}
                            capacity={table.capacity || 4}
                            status="occupied"
                            tableNumber={table.name_or_number}
                            size="md"
                          />
                        </div>

                        {/* Cronómetro y responsable */}
                        <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 mb-3 font-mono">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1 text-slate-400">
                              <Clock className="w-3 h-3" />
                              Ocupación:
                            </span>
                            <span
                              suppressHydrationWarning
                              className={`font-bold ${
                                elapsedMins > 60
                                  ? "text-red-600 dark:text-red-400"
                                  : elapsedMins > 30
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {formatElapsedTime(elapsedMins)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Atendido por:
                            </span>
                            <span
                              className="truncate max-w-[150px] font-semibold text-slate-800 dark:text-slate-200"
                              title={
                                activeOrder?.assigned_staff_name
                                  ? `${activeOrder.assigned_staff_name}${activeOrder.assigned_staff_role ? ` (${activeOrder.assigned_staff_role})` : ""}`
                                  : "Sin mesero asignado"
                              }
                            >
                              {(() => {
                                const staffName = activeOrder?.assigned_staff_name || (activeOrder as any)?.driver_name;
                                const staffRole = activeOrder?.assigned_staff_role;
                                if (staffName) {
                                  return staffRole ? `${staffName} (${staffRole})` : staffName;
                                }
                                return (activeOrder?.customer_name && activeOrder.customer_name !== "Cliente General" ? activeOrder.customer_name : "Sin asignar");
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Monto acumulado y botón cobrar */}
                      <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:justify-between sm:gap-2">
                        <div className="min-h-[40px] flex flex-col justify-center">
                          <span className="text-[10px] text-slate-400 block font-medium">Total comanda</span>
                          <span className="font-bold font-mono text-sm text-slate-900 dark:text-white">
                            {formatCOP(activeOrder?.total || 0)}
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setCommandTicketTable(table)}
                          className="w-full sm:w-auto min-h-[44px] justify-center cursor-pointer"
                        >
                          Comanda →
                        </Button>
                      </div>
                    </div>
                  );
                }

                // Tarjeta de mesa Libre
                return (
                  <div
                    key={table.id}
                    className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-white/[0.15] transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Cabecera mesa libre */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          {/* Indicador numérico gris neutro */}
                          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 font-mono font-bold text-sm flex items-center justify-center">
                            {table.name_or_number.replace(/[^0-9]/g, "") || table.name_or_number.slice(0, 3)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white text-xs block">
                              {table.name_or_number}
                            </span>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 flex-wrap">
                              <span>Cap. {table.capacity || 4} personas</span>
                              {roomName && (
                                <>
                                  <span className="text-slate-300 dark:text-slate-700">·</span>
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#ED500A]/10 text-[#ED500A] font-sans font-semibold text-[10px]">
                                    <Layers className="w-2.5 h-2.5" />
                                    {roomName}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-white/[0.06] text-slate-500">
                            Libre
                          </span>

                          <div className="relative" ref={isDropdownOpen ? dropdownRef : undefined}>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveDropdownTableId(isDropdownOpen ? null : table.id)
                              }
                              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {isDropdownOpen && (
                              <div className="absolute right-0 top-7 z-30 w-44 rounded-xl bg-white dark:bg-[#121620] border border-slate-200 dark:border-white/[0.1] shadow-xl py-1 text-xs divide-y divide-slate-100 dark:divide-white/[0.06]">
                                <div className="py-1">
                                  <Link
                                    href={`/workspace/${businessId}/pos?tableId=${table.id}`}
                                    className="flex items-center gap-2 px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06]"
                                  >
                                    <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Abrir comanda</span>
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveDropdownTableId(null);
                                      setEditingTable(table);
                                      setEditTableShape(getResolvedTableShape(table));
                                      setEditTableForm({
                                        name_or_number: table.name_or_number,
                                        capacity: table.capacity || 4,
                                        sort_order: table.sort_order || 0,
                                        room_id: table.room_id || undefined,
                                      });
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.06] text-left cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Editar mesa</span>
                                  </button>
                                </div>
                                <div className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveDropdownTableId(null);
                                      setTableToDelete(table);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-left cursor-pointer font-medium"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Eliminar</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Ilustración arquitectónica de la mesa y sus sillas */}
                      <div className="my-2 py-2 flex items-center justify-center bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-white/[0.04]">
                        <TableBlueprintIllustration
                          shape={getResolvedTableShape(table)}
                          capacity={table.capacity || 4}
                          status="available"
                          tableNumber={table.name_or_number}
                          size="md"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                      <Link href={`/workspace/${businessId}/pos?tableId=${table.id}`}>
                        <Button variant="outline" size="sm" className="w-full justify-center min-h-[38px] min-w-[38px]">
                          Abrir comanda
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}

              {/* Tarjeta de acción rápida: + Añadir mesa */}
              {canManageTables && (
                <button
                  type="button"
                  onClick={() => handleOpenCreateTableModal()}
                  className="min-h-[160px] rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/[0.1] hover:border-[#ED500A] dark:hover:border-[#ED500A] bg-slate-50/50 dark:bg-white/[0.01] hover:bg-orange-500/5 transition-all flex flex-col items-center justify-center gap-2 p-6 cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-[#ED500A]">
                    Añadir mesa
                  </span>
                  <span className="text-[10px] text-slate-400">En la sala activa</span>
                </button>
              )}
            </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SALAS                                                              */}
        {/* ========================================================================= */}
        {activeMainTab === "salas" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 shadow-2xs">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Gestión de Salas
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Administra las salas, zonas y terrazas para organizar tus mesas.
                </p>
              </div>

              {canManageTables && (
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setIsCreateRoomModalOpen(true)}
                >
                  Nueva sala
                </Button>
              )}
            </div>

            {roomsList.length === 0 ? (
              <div className="text-center p-8 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl space-y-3">
                <Layers className="w-10 h-10 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No hay salas registradas
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Crea salas como Terraza, Salón VIP o Primer Piso para ordenar las mesas.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsCreateRoomModalOpen(true)}
                >
                  Crear primera sala
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {roomsList.map((room) => (
                  <div
                    key={room.id}
                    className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Cabecera sala */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            {room.name}
                          </h4>
                          <span className="text-xs text-slate-500 font-mono block">
                            {room.tablesCount} {room.tablesCount === 1 ? "mesa asignada" : "mesas asignadas"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <IconButton
                            icon={<Edit2 className="w-3.5 h-3.5" />}
                            title="Editar sala"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setRoomToEdit(room);
                              setEditRoomName(room.name);
                            }}
                          />
                          <IconButton
                            icon={room.status === "inactive" ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            title={room.status === "inactive" ? "Mostrar sala" : "Ocultar sala"}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleRoomVisibility(room)}
                          />
                          <IconButton
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            title="Eliminar sala"
                            variant="destructive"
                            size="sm"
                            onClick={() => setRoomToDelete(room)}
                          />
                        </div>
                      </div>

                      {/* Tarjeta de información de la sala */}
                      <div className="rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] p-3 flex items-center gap-3 text-xs">
                        <div className="w-9 h-9 rounded-xl bg-[#ED500A]/10 text-[#ED500A] flex items-center justify-center font-bold shrink-0">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                            {room.tablesCount} {room.tablesCount === 1 ? "mesa registrada" : "mesas registradas"}
                          </span>
                          <span className="text-[11px] text-slate-400 block truncate">
                            Asigna mesas a esta sala al crearlas o editarlas
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pie de tarjeta */}
                    <div className="text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
                      <span>Creada: {formatDate(room.created_at)}</span>
                      <span className={room.status === "active" ? "text-emerald-600 font-bold" : "text-slate-400"}>
                        {room.status === "active" ? "Activa" : "Oculta"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: TRASLADOS ENTRE MESAS                                              */}
        {/* ========================================================================= */}
        {activeMainTab === "traslados" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 shadow-2xs">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Traslados entre Mesas
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Historial de traslados de productos entre mesas y paso de mesas de una sala a otra.
                </p>
              </div>

              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={handleOpenTransferModal}
              >
                Nuevo Traslado
              </Button>
            </div>

            {/* Alerta informativa de validación si no hay mesas suficientes */}
            {(occupiedTables.length === 0 || initialTables.length < 2) && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Mesas insuficientes:</strong> Necesitas al menos 2 mesas registradas y al menos 1 mesa ocupada con comanda activa para realizar traslados.
                </div>
              </div>
            )}

            {/* Historial de traslados */}
            {isLoadingTransfers ? (
              <div className="p-8 text-center text-xs text-slate-400">Cargando traslados...</div>
            ) : transfersHistory.length === 0 ? (
              <div className="text-center p-10 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl space-y-2">
                <ArrowLeftRight className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Sin movimientos de traslado
                </h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Cuando traslades una comanda de una mesa a otra, el historial auditado aparecerá registrado aquí.
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/[0.08] text-slate-500 font-mono text-[11px] uppercase">
                      <tr>
                        <th className="px-4 py-3">Fecha y Hora</th>
                        <th className="px-4 py-3">Mesa Origen</th>
                        <th className="px-4 py-3">Mesa Destino</th>
                        <th className="px-4 py-3">Comanda #</th>
                        <th className="px-4 py-3">Motivo / Notas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] font-mono text-xs">
                      {transfersHistory.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                            {formatDate(t.transferredAt)}
                          </td>
                          <td className="px-4 py-3 font-bold text-red-600">
                            {t.sourceTableName}
                          </td>
                          <td className="px-4 py-3 font-bold text-emerald-600">
                            {t.targetTableName}
                          </td>
                          <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                            {t.orderNumber ? `#${t.orderNumber}` : "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {t.notes || "Traslado operativo"}
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

        {/* ========================================================================= */}
        {/* TAB 4: RENDIMIENTO / MAPA DE CALOR                                        */}
        {/* ========================================================================= */}
        {activeMainTab === "rendimiento" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 shadow-2xs">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Mapa de Calor
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Visualiza el rendimiento de las mesas por período.
                </p>
              </div>

              {/* Filtros de rendimiento (Segmented Controls modernos) */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Selector de Período */}
                <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setHeatMapPeriod("today")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      heatMapPeriod === "today"
                        ? "bg-white dark:bg-[#1E2028] text-slate-900 dark:text-white shadow-2xs font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeatMapPeriod("week")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      heatMapPeriod === "week"
                        ? "bg-white dark:bg-[#1E2028] text-slate-900 dark:text-white shadow-2xs font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Esta semana
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeatMapPeriod("month")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      heatMapPeriod === "month"
                        ? "bg-white dark:bg-[#1E2028] text-slate-900 dark:text-white shadow-2xs font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Este mes
                  </button>
                </div>

                {/* Selector de Métrica */}
                <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setHeatMapMetric("revenue")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      heatMapMetric === "revenue"
                        ? "bg-[#ED500A] text-white shadow-2xs font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Ingresos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHeatMapMetric("orders")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      heatMapMetric === "orders"
                        ? "bg-[#ED500A] text-white shadow-2xs font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Pedidos</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4 Tarjetas de KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 shadow-2xs">
                <span className="text-xs text-slate-500 block font-medium">Ingresos Totales</span>
                <span className="text-xl font-bold font-mono text-slate-900 dark:text-white block mt-1">
                  {formatCOP(performanceKpis.revenue)}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block font-mono">Facturación acumulada</span>
              </div>

              <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 shadow-2xs">
                <span className="text-xs text-slate-500 block font-medium">Pedidos Totales</span>
                <span className="text-xl font-bold font-mono text-emerald-600 block mt-1">
                  {performanceKpis.orders}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block font-mono">Comandas atendidas</span>
              </div>

              <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 shadow-2xs">
                <span className="text-xs text-slate-500 block font-medium">Comensales</span>
                <span className="text-xl font-bold font-mono text-blue-600 block mt-1">
                  {performanceKpis.diners}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block font-mono">Capacidad ocupada</span>
              </div>

              <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 shadow-2xs">
                <span className="text-xs text-slate-500 block font-medium">Tiempo Total</span>
                <span className="text-xl font-bold font-mono text-[#ED500A] block mt-1">
                  {formatElapsedTime(performanceKpis.totalMinutes)}
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block font-mono">Permanencia acumulada</span>
              </div>
            </div>

            {/* Matriz gráfica con escala cromática */}
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Matriz de Actividad por Mesa
                </h4>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-200 dark:bg-white/10" />
                    Sin actividad
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    Actividad media
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    Actividad alta
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {initialTables.map((t) => {
                  const isOcc = t.status === "occupied";
                  const rev = t.activeOrder?.total || 0;
                  const isHigh = rev > 80000;
                  const isMid = isOcc && !isHigh;

                  return (
                    <div
                      key={t.id}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        isHigh
                          ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400 font-bold"
                          : isMid
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 font-semibold"
                          : "bg-slate-50 dark:bg-white/[0.02] border-slate-100 dark:border-white/[0.04] text-slate-400"
                      }`}
                    >
                      <span className="text-xs font-bold block">{t.name_or_number}</span>
                      <span className="text-[10px] font-mono block mt-1">
                        {isOcc ? formatCOP(rev) : "Sin consumo"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: NUEVA SALA (CreateRoomModal Oficial)                              */}
      {/* ========================================================================= */}
      <CreateRoomModal
        isOpen={isCreateRoomModalOpen}
        businessId={businessId}
        onClose={() => setIsCreateRoomModalOpen(false)}
        onSuccess={(newRoom) => {
          setIsCreateRoomModalOpen(false);
          if (newRoom?.id) {
            setCreateTableForm((prev) => ({ ...prev, room_id: newRoom.id }));
          }
          router.refresh();
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL: VER COMANDA / TICKET DE MESA                                        */}
      {/* ========================================================================= */}
      <TableCommandTicketModal
        isOpen={Boolean(commandTicketTable)}
        onClose={() => setCommandTicketTable(null)}
        table={commandTicketTable}
        businessId={businessId}
        businessName={businessName}
        onCloseTable={(tbl) => {
          setCloseOrderInitialTableId(tbl.id);
          setIsCloseOrdersModalOpen(true);
        }}
        onRefresh={() => router.refresh()}
      />

      {/* ========================================================================= */}
      {/* MODAL 2: CERRAR ÓRDENES (CloseTableOrderModal Oficial)                     */}
      {/* ========================================================================= */}
      <CloseTableOrderModal
        isOpen={isCloseOrdersModalOpen}
        businessId={businessId}
        occupiedTables={occupiedTables}
        initialTableId={closeOrderInitialTableId}
        onClose={() => {
          setIsCloseOrdersModalOpen(false);
          setCloseOrderInitialTableId(null);
        }}
        onSuccess={() => {
          setIsCloseOrdersModalOpen(false);
          setCloseOrderInitialTableId(null);
          router.refresh();
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL 3: TRASLADO ENTRE MESAS                                             */}
      {/* ========================================================================= */}
      {isTransferModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.1] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-[#ED500A]" />
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Trasladar Mesa
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <SearchSelect
                    label="Mesa de Origen (Ocupada)"
                    value={transferSourceTableId}
                    onChange={(val) => setTransferSourceTableId(val)}
                    options={occupiedTables.map((t) => ({
                      value: t.id,
                      label: `${t.name_or_number} (${formatCOP(t.activeOrder?.total || 0)})`,
                    }))}
                    placeholder="Seleccionar mesa ocupada..."
                    clearable={false}
                    searchable={occupiedTables.length > 4}
                  />
                </div>

                <div>
                  <SearchSelect
                    label="Mesa de Destino"
                    value={transferTargetTableId}
                    onChange={(val) => setTransferTargetTableId(val)}
                    options={initialTables
                      .filter((t) => t.id !== transferSourceTableId)
                      .map((t) => ({
                        value: t.id,
                        label: `${t.name_or_number} ${t.status === "available" ? "(Libre)" : "(Ocupada - Unir)"}`,
                      }))}
                    placeholder="Seleccionar mesa destino..."
                    clearable={false}
                    searchable={initialTables.length > 4}
                  />
                </div>

                <div>
                  <Input
                    label="Motivo del traslado (opcional)"
                    type="text"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="Ej. Solicitud del cliente por lluvia, mesa más grande..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTransferModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={isTransferring}
                  onClick={handleExecuteTransfer}
                >
                  Confirmar Traslado
                </Button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CREAR / EDITAR MESA                                              */}
      {/* ========================================================================= */}
      {isCreateTableModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.1] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] pb-3 shrink-0">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Nueva Mesa
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreateTableModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs overflow-y-auto pr-1">
                {formError && (
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600">
                    {formError}
                  </div>
                )}

                {/* Previsualización en Vivo de la Mesa y Sillas */}
                <div className="flex flex-col items-center justify-center p-3.5 bg-slate-50 dark:bg-white/[0.02] rounded-2xl border border-slate-100 dark:border-white/[0.06] text-center">
                  <TableBlueprintIllustration
                    shape={createTableShape}
                    capacity={createTableForm.capacity || 4}
                    status="available"
                    tableNumber={createTableForm.name_or_number || "Mesa"}
                    size="lg"
                  />
                  <div className="mt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Forma: <span className="font-bold text-slate-800 dark:text-slate-200">
                      {createTableShape === "round"
                        ? "Redonda"
                        : createTableShape === "square"
                        ? "Cuadrada"
                        : createTableShape === "rectangle"
                        ? "Rectangular"
                        : "Barra"}
                    </span> · {createTableForm.capacity || 4} sillas
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Forma geométrica de la mesa
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-white/[0.04]">
                    {[
                      { id: "round", label: "Redonda", icon: "●" },
                      { id: "square", label: "Cuadrada", icon: "■" },
                      { id: "rectangle", label: "Rectangular", icon: "▬" },
                      { id: "bar", label: "Barra", icon: "▰" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCreateTableShape(item.id as TableShape)}
                        className={`flex flex-col items-center py-2 px-1 rounded-lg text-2xs font-bold transition-all cursor-pointer ${
                          createTableShape === item.id
                            ? "bg-[#ED500A] text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <span className="text-sm leading-none mb-1">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Input
                    label="Nombre o número de mesa (*)"
                    type="text"
                    required
                    value={createTableForm.name_or_number}
                    onChange={(e) =>
                      setCreateTableForm((prev) => ({ ...prev, name_or_number: e.target.value }))
                    }
                    placeholder="Ej. Mesa 5, Terraza 2"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Número de sillas (Capacidad)
                    </span>
                    <span className="text-2xs font-mono text-slate-400">
                      {createTableForm.capacity || 4} comensales
                    </span>
                  </div>
                  {/* Botones rápidos de sillas */}
                  <div className="flex items-center gap-1.5 mb-2">
                    {[2, 4, 6, 8, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() =>
                          setCreateTableForm((prev) => ({ ...prev, capacity: num }))
                        }
                        className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                          createTableForm.capacity === num
                            ? "border-[#ED500A] bg-orange-500/10 text-[#ED500A]"
                            : "border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={createTableForm.capacity}
                    onChange={(e) =>
                      setCreateTableForm((prev) => ({
                        ...prev,
                        capacity: parseInt(e.target.value, 10) || 4,
                      }))
                    }
                  />
                </div>

                <div>
                  <SearchSelect
                    label={
                      <span className="flex items-center justify-between w-full">
                        <span>Sala o Ambiente</span>
                        <button
                          type="button"
                          onClick={() => setIsCreateRoomModalOpen(true)}
                          className="text-[11px] font-semibold text-[#ED500A] hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Crear sala</span>
                        </button>
                      </span>
                    }
                    value={createTableForm.room_id || ""}
                    onChange={(val) =>
                      setCreateTableForm((prev) => ({
                        ...prev,
                        room_id: val || undefined,
                      }))
                    }
                    options={roomsList.map((r) => ({
                      value: r.id,
                      label: r.name,
                      description: `${r.tablesCount || 0} mesas registradas`,
                    }))}
                    placeholder="Seleccionar sala o ambiente..."
                    searchPlaceholder="Buscar sala..."
                    searchable={roomsList.length > 4}
                    clearable={false}
                  />
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Selecciona a qué sala pertenece esta mesa (ej. Interior, Terraza).
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateTableModalOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isLoading={isPending}>
                    Crear Mesa
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Editar Mesa */}
      {editingTable && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.1] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] pb-3 shrink-0">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Editar Mesa
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingTable(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs overflow-y-auto pr-1">
                {/* Previsualización en Vivo de la Mesa y Sillas */}
                <div className="flex flex-col items-center justify-center p-3.5 bg-slate-50 dark:bg-white/[0.02] rounded-2xl border border-slate-100 dark:border-white/[0.06] text-center">
                  <TableBlueprintIllustration
                    shape={editTableShape}
                    capacity={editTableForm.capacity || 4}
                    status={editingTable.status}
                    tableNumber={editTableForm.name_or_number || "Mesa"}
                    size="lg"
                  />
                  <div className="mt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Forma: <span className="font-bold text-slate-800 dark:text-slate-200">
                      {editTableShape === "round"
                        ? "Redonda"
                        : editTableShape === "square"
                        ? "Cuadrada"
                        : editTableShape === "rectangle"
                        ? "Rectangular"
                        : "Barra"}
                    </span> · {editTableForm.capacity || 4} sillas
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Forma geométrica de la mesa
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-white/[0.04]">
                    {[
                      { id: "round", label: "Redonda", icon: "●" },
                      { id: "square", label: "Cuadrada", icon: "■" },
                      { id: "rectangle", label: "Rectangular", icon: "▬" },
                      { id: "bar", label: "Barra", icon: "▰" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setEditTableShape(item.id as TableShape)}
                        className={`flex flex-col items-center py-2 px-1 rounded-lg text-2xs font-bold transition-all cursor-pointer ${
                          editTableShape === item.id
                            ? "bg-[#ED500A] text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <span className="text-sm leading-none mb-1">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Input
                    label="Nombre o número de mesa"
                    type="text"
                    required
                    value={editTableForm.name_or_number}
                    onChange={(e) =>
                      setEditTableForm((prev) => ({ ...prev, name_or_number: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Capacidad (comensales)
                    </span>
                    <span className="text-2xs font-mono text-slate-400">
                      {editTableForm.capacity || 4} comensales
                    </span>
                  </div>
                  {/* Botones rápidos de sillas */}
                  <div className="flex items-center gap-1.5 mb-2">
                    {[2, 4, 6, 8, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() =>
                          setEditTableForm((prev) => ({ ...prev, capacity: num }))
                        }
                        className={`flex-1 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                          editTableForm.capacity === num
                            ? "border-[#ED500A] bg-orange-500/10 text-[#ED500A]"
                            : "border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={editTableForm.capacity}
                    onChange={(e) =>
                      setEditTableForm((prev) => ({
                        ...prev,
                        capacity: parseInt(e.target.value, 10) || 4,
                      }))
                    }
                  />
                </div>

                <div>
                  <SearchSelect
                    label="Sala o Ambiente"
                    value={editTableForm.room_id || ""}
                    onChange={(val) =>
                      setEditTableForm((prev) => ({
                        ...prev,
                        room_id: val || undefined,
                      }))
                    }
                    options={roomsList.map((r) => ({
                      value: r.id,
                      label: r.name,
                      description: `${r.tablesCount || 0} mesas registradas`,
                    }))}
                    placeholder="Seleccionar sala o ambiente..."
                    searchPlaceholder="Buscar sala..."
                    searchable={roomsList.length > 4}
                    clearable={false}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingTable(null)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isLoading={isPending}>
                    Guardar Cambios
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Editar Sala */}
      {roomToEdit && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.1] rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.06] pb-3">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Editar Sala
                </h3>
                <button
                  type="button"
                  onClick={() => setRoomToEdit(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateRoom} className="space-y-3 text-xs">
                <div>
                  <Input
                    label="Nombre de la sala (*)"
                    type="text"
                    required
                    value={editRoomName}
                    onChange={(e) => setEditRoomName(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRoomToEdit(null)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isLoading={isPending}>
                    Actualizar
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Instalar App (PWA) */}
      {isPwaModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.1] rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  App de Comandas y Meseros
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Para instalar NEGOVA en tu celular o tablet, abre el menú de opciones de tu navegador (Chrome o Safari) y selecciona <strong>«Agregar a la pantalla principal»</strong>.
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                className="w-full justify-center"
                onClick={() => setIsPwaModalOpen(false)}
              >
                Entendido
              </Button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ConfirmModal para Eliminar Mesa */}
      <ConfirmModal
        isOpen={Boolean(tableToDelete)}
        onClose={() => setTableToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar mesa?"
        description={
          tableToDelete
            ? `Se eliminará la mesa «${tableToDelete.name_or_number}». Esta acción no se puede deshacer.`
            : ""
        }
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* ConfirmModal para Liberar Mesa */}
      <ConfirmModal
        isOpen={Boolean(tableToRelease)}
        onClose={() => setTableToRelease(null)}
        onConfirm={handleConfirmRelease}
        title="¿Liberar mesa ocupada?"
        description={
          tableToRelease
            ? `Se marcará la comanda de «${tableToRelease.name_or_number}» como finalizada y la mesa volverá a estar libre.`
            : ""
        }
        confirmText="Sí, liberar"
        cancelText="Cancelar"
        variant="warning"
      />

      {/* ConfirmModal para Eliminar Sala */}
      <ConfirmModal
        isOpen={Boolean(roomToDelete)}
        onClose={() => setRoomToDelete(null)}
        onConfirm={handleDeleteRoom}
        title="¿Eliminar sala?"
        description={
          roomToDelete
            ? `Se eliminará la sala «${roomToDelete.name}». Solo puedes eliminarla si no tiene mesas asignadas.`
            : ""
        }
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        variant="danger"
        isLoading={isDeletingRoom}
      />
    </AppPageContainer>
  );
}
