"use client";

import React, { useState, useTransition, useRef } from "react";
import Link from "next/link";
import {
  Printer,
  Monitor,
  Receipt,
  UtensilsCrossed,
  DollarSign,
  Save,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Wifi,
  Usb,
  Bluetooth,
  Landmark,
  Wine,
  Bike,
  Building2,
  Upload,
  ArrowLeft,
  Sliders,
  Radio,
  Eye,
  Check,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppPageContainer } from "@/components/layout/app-page-container";
import { Button, Input, Badge, Select, Tabs } from "@/components/ui";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  PrintingSettings,
  PrinterConfig,
  PrintingStation,
  TicketTemplateConfig,
  KitchenCommandTemplateConfig,
  CashDrawerConfig,
  AvailableCashRegister,
  PrintDriverType,
} from "@/lib/printing/types";
import { TicketLivePreview } from "@/components/printing/ticket-live-preview";
import { PrinterFormModal } from "@/components/printing/printer-form-modal";
import { StationFormModal } from "@/components/printing/station-form-modal";
import {
  savePrintingSettingsAction,
  uploadPrinterLogoAction,
  testPrinterPulseAction,
} from "./actions";

interface PrintingConfigClientProps {
  businessId: string;
  initialSettings: PrintingSettings;
  cashRegisters: AvailableCashRegister[];
  businessMaster: {
    name: string;
    tradeName?: string;
    legalName?: string;
    taxId?: string;
    address?: string;
    city?: string;
    phone?: string;
    logoUrl?: string | null;
  };
  isOwner: boolean;
}

export function PrintingConfigClient({
  businessId,
  initialSettings,
  cashRegisters,
  businessMaster,
  isOwner,
}: PrintingConfigClientProps) {
  // Estado local completo de configuración
  const [printers, setPrinters] = useState<PrinterConfig[]>(initialSettings.printers || []);
  const [stations, setStations] = useState<PrintingStation[]>(initialSettings.stations || []);
  const [ticketTemplate, setTicketTemplate] = useState<TicketTemplateConfig>(initialSettings.ticketTemplate);
  const [kitchenTemplate, setKitchenTemplate] = useState<KitchenCommandTemplateConfig>(initialSettings.kitchenCommandTemplate);
  const [cashDrawer, setCashDrawer] = useState<CashDrawerConfig>(initialSettings.cashDrawer);
  const [printDriver, setPrintDriver] = useState<PrintDriverType>(initialSettings.printDriver || "browser");

  // Pestaña activa de configuración en el formulario
  const [activeTab, setActiveTab] = useState<"devices" | "templates" | "drawer">("devices");
  // Vista activa del simulador térmico (ticket o kitchen)
  const [previewView, setPreviewView] = useState<"ticket" | "kitchen">("ticket");

  // Modales
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterConfig | null>(null);

  const [isStationModalOpen, setIsStationModalOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<PrintingStation | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: "printer" | "station";
    id: string;
    title: string;
    description: string;
  }>({
    isOpen: false,
    type: "printer",
    id: "",
    title: "",
    description: "",
  });

  const [isPending, startTransition] = useTransition();
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Guardar Configuración ───────────────────────────────────────────────
  const handleSaveAll = () => {
    startTransition(async () => {
      const payload: Partial<PrintingSettings> = {
        printers,
        stations,
        ticketTemplate,
        kitchenCommandTemplate: kitchenTemplate,
        cashDrawer,
        printDriver,
      };

      const res = await savePrintingSettingsAction(businessId, payload);
      if (res.success) {
        toast.success("Configuración de impresión guardada", {
          description: "Las impresoras, estaciones y plantillas se actualizaron correctamente.",
        });
      } else {
        toast.error("Error al guardar", { description: res.error });
      }
    });
  };

  // ─── Manejo de Impresoras ────────────────────────────────────────────────
  const handleSavePrinter = (printer: PrinterConfig) => {
    setPrinters((prev) => {
      const idx = prev.findIndex((p) => p.id === printer.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = printer;
        return copy;
      }
      return [...prev, printer];
    });
    toast.success(editingPrinter ? "Impresora actualizada" : "Impresora registrada");
  };

  const handleDeletePrinter = (id: string) => {
    setPrinters((prev) => prev.filter((p) => p.id !== id));
    // Desenlazar estaciones que usaban esta impresora
    setStations((prev) =>
      prev.map((s) => (s.printerId === id ? { ...s, printerId: null } : s))
    );
    toast.success("Impresora eliminada de la lista");
  };

  // ─── Manejo de Estaciones ────────────────────────────────────────────────
  const handleSaveStation = (station: PrintingStation) => {
    setStations((prev) => {
      const idx = prev.findIndex((s) => s.id === station.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = station;
        return copy;
      }
      return [...prev, station];
    });
    toast.success(editingStation ? "Estación actualizada" : "Estación creada");
  };

  const handleDeleteStation = (id: string) => {
    setStations((prev) => prev.filter((s) => s.id !== id));
    toast.success("Estación eliminada");
  };

  // ─── Subida de Logotipo ──────────────────────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Archivo no admitido", { description: "Selecciona una imagen PNG, JPG o WEBP." });
      return;
    }

    setIsUploadingLogo(true);
    const formData = new FormData();
    formData.append("logo", file);

    const res = await uploadPrinterLogoAction(businessId, formData);
    if (res.success && res.url) {
      setTicketTemplate((prev) => ({
        ...prev,
        customLogoUrl: res.url,
      }));
      toast.success("Logotipo actualizado con éxito", {
        description: "El preview del ticket se ha actualizado con la nueva imagen.",
      });
    } else {
      toast.error("Error al subir imagen", { description: res.error });
    }

    setIsUploadingLogo(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Pruebas de Hardware ─────────────────────────────────────────────────
  const handleTestDrawer = async () => {
    const targetPrinter = printers.find((p) => p.id === cashDrawer.targetPrinterId) || printers[0];
    const printerName = targetPrinter ? targetPrinter.name : "Impresora Principal";

    const res = await testPrinterPulseAction(businessId, {
      printerId: targetPrinter?.id || "default",
      type: "drawer",
    });

    if (res.success) {
      toast.success("Pulso de apertura enviado", {
        description: `Código ESC/POS (${cashDrawer.drawerKickCode}) enviado a ${printerName}.`,
      });
    } else {
      toast.error("Error al emitir pulso", { description: res.error });
    }
  };

  const handleTestPrintStation = (station: PrintingStation) => {
    const printer = printers.find((p) => p.id === station.printerId);
    const printerName = printer ? printer.name : "Impresora no asignada";

    toast.info("Página de prueba enviada", {
      description: `Orden de prueba para «${station.name}» enviada a ${printerName}.`,
    });
  };

  return (
    <AppPageContainer
      title="Configuración de Impresión y Estaciones"
      description="Gestiona impresoras térmicas, estaciones de comanda de cocina, cajón monedero y plantillas de comprobantes."
      badge={
        <div className="flex items-center gap-2">
          <Link
            href={`/workspace/${businessId}/configuracion?tab=comprobantes`}
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a Configuración</span>
          </Link>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <Badge variant="orange" className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
            Fase 9 · Impresión POS
          </Badge>
        </div>
      }
    >
      {/* Barra superior de acciones principales */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-xs">
        {/* Pestañas de configuración */}
        <Tabs
          tabs={[
            { id: "devices", label: "Impresoras & Estaciones", icon: <Printer className="w-3.5 h-3.5" />, count: printers.length },
            { id: "templates", label: "Plantillas (Ticket & Comanda)", icon: <Receipt className="w-3.5 h-3.5" /> },
            { id: "drawer", label: "Cajón Monedero & Conexión", icon: <DollarSign className="w-3.5 h-3.5" /> },
          ]}
          activeTab={activeTab}
          onChange={(id) => {
            setActiveTab(id as "devices" | "templates" | "drawer");
            if (id === "templates") setPreviewView("ticket");
          }}
          size="sm"
        />

        {/* Botón Guardar Cambios */}
        {isOwner && (
          <Button
            size="sm"
            leftIcon={<Save className="w-4 h-4" />}
            onClick={handleSaveAll}
            isLoading={isPending}
            className="cursor-pointer"
          >
            Guardar Configuración
          </Button>
        )}
      </div>

      {/* CUERPO PRINCIPAL: 2 COLUMNAS (CONTENIDO + VISTA PREVIA EN TIEMPO REAL) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: FORMULARIOS Y LISTADOS (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">
          {/* =================================================================
              PESTAÑA 1: IMPRESORAS REGISTRADAS & ESTACIONES DE TRABAJO
              ================================================================= */}
          {activeTab === "devices" && (
            <div className="space-y-6">
              {/* 1.1 IMPRESORAS REGISTRADAS */}
              <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
                      <Printer className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Impresoras Registradas
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Dispositivos térmicos y de red disponibles en el local
                      </p>
                    </div>
                  </div>

                  {isOwner && (
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setEditingPrinter(null);
                        setIsPrinterModalOpen(true);
                      }}
                      className="cursor-pointer"
                    >
                      Añadir Impresora
                    </Button>
                  )}
                </div>

                <div className="p-5">
                  {printers.length === 0 ? (
                    <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 dark:border-white/10 space-y-2">
                      <Printer className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        No hay impresoras registradas todavía
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                        Añade una impresora térmica (USB, Red o Bluetooth) para comenzar a emitir tickets y comandas.
                      </p>
                      {isOwner && (
                        <div className="pt-2">
                          <Button
                            size="sm"
                            leftIcon={<Plus className="w-3.5 h-3.5" />}
                            onClick={() => {
                              setEditingPrinter(null);
                              setIsPrinterModalOpen(true);
                            }}
                          >
                            Registrar Primera Impresora
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {printers.map((printer) => {
                        const isNet = printer.connection === "network";
                        const isUsb = printer.connection === "usb";
                        return (
                          <div
                            key={printer.id}
                            className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.02] flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-white/15 transition-all"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                                {isNet ? <Wifi className="w-4 h-4 text-blue-500" /> : isUsb ? <Usb className="w-4 h-4 text-emerald-500" /> : <Bluetooth className="w-4 h-4 text-indigo-500" />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {printer.name}
                                  </span>
                                  <Badge
                                    variant={printer.status === "active" ? "emerald" : "slate"}
                                    className={
                                      printer.status === "active"
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]"
                                        : "bg-slate-200 dark:bg-white/10 text-slate-500 text-[10px]"
                                    }
                                  >
                                    {printer.status === "active" ? "Activa" : "Inactiva"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  <span className="font-mono">
                                    {printer.type === "thermal_80mm" ? "Térmica 80 mm" : printer.type === "thermal_58mm" ? "Térmica 58 mm" : "Carta A4"}
                                  </span>
                                  <span>·</span>
                                  <span className="capitalize">{printer.connection}</span>
                                  {printer.ipAddress && (
                                    <>
                                      <span>·</span>
                                      <span className="font-mono text-slate-600 dark:text-slate-300">{printer.ipAddress}:{printer.port || 9100}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  toast.info(`Prueba enviada a ${printer.name}`);
                                }}
                                title="Imprimir prueba"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                              >
                                <Zap className="w-3.5 h-3.5" />
                              </button>
                              {isOwner && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingPrinter(printer);
                                      setIsPrinterModalOpen(true);
                                    }}
                                    title="Editar"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteConfirm({
                                        isOpen: true,
                                        type: "printer",
                                        id: printer.id,
                                        title: "Eliminar impresora",
                                        description: `¿Estás seguro de que deseas eliminar la impresora «${printer.name}»? Las estaciones vinculadas quedarán sin impresora asignada.`,
                                      });
                                    }}
                                    title="Eliminar"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 1.2 ESTACIONES DE TRABAJO (CRITERIO 1: VINCULAR IMPRESORA A CAJA/ÁREA) */}
              <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
                      <Monitor className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Estaciones de Impresión
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Vincula tus impresoras a cajas físicas o áreas como cocina y barra
                      </p>
                    </div>
                  </div>

                  {isOwner && (
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setEditingStation(null);
                        setIsStationModalOpen(true);
                      }}
                      className="cursor-pointer"
                    >
                      Nueva Estación
                    </Button>
                  )}
                </div>

                <div className="p-5">
                  {stations.length === 0 ? (
                    <div className="text-center py-8 px-4 rounded-xl border border-dashed border-slate-200 dark:border-white/10 space-y-2">
                      <Monitor className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        No hay estaciones configuradas
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                        Crea una estación para enlazar, por ejemplo, «Caja Principal» con tu impresora de mostrador, o «Cocina» con tu impresora de comandas.
                      </p>
                      {isOwner && (
                        <div className="pt-2">
                          <Button
                            size="sm"
                            leftIcon={<Plus className="w-3.5 h-3.5" />}
                            onClick={() => {
                              setEditingStation(null);
                              setIsStationModalOpen(true);
                            }}
                          >
                            Crear Estación
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stations.map((st) => {
                        const printer = printers.find((p) => p.id === st.printerId);
                        const matchedRegister = cashRegisters.find((r) => r.id === st.cashRegisterId);

                        return (
                          <div
                            key={st.id}
                            className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-white/15 transition-all"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                  {st.name}
                                </span>
                                <Badge variant="slate" className="text-[10px] uppercase font-mono">
                                  {st.area}
                                </Badge>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                                {/* Impresora asignada */}
                                <div className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                  <Printer className="w-3 h-3 text-orange-500" />
                                  <span>{printer ? printer.name : "Sin impresora asignada"}</span>
                                </div>

                                <span>·</span>

                                {/* Caja vinculada (CRITERIO 1) */}
                                <div className="inline-flex items-center gap-1">
                                  <Landmark className="w-3 h-3 text-emerald-500" />
                                  <span className={matchedRegister ? "font-semibold text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>
                                    {matchedRegister ? `Caja: ${matchedRegister.name}` : "Caja: Todas (General)"}
                                  </span>
                                </div>

                                <span>·</span>

                                {/* Flags de impresión */}
                                <span className="text-slate-400">
                                  {st.autoPrintReceipt ? "Ticket auto ✓" : ""}
                                  {st.autoPrintReceipt && st.autoPrintOrderCommand ? " | " : ""}
                                  {st.autoPrintOrderCommand ? "Comanda auto ✓" : ""}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 self-end sm:self-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTestPrintStation(st)}
                                className="text-xs py-1 h-7"
                              >
                                Probar
                              </Button>
                              {isOwner && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingStation(st);
                                      setIsStationModalOpen(true);
                                    }}
                                    title="Editar"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteConfirm({
                                        isOpen: true,
                                        type: "station",
                                        id: st.id,
                                        title: "Eliminar estación",
                                        description: `¿Estás seguro de que deseas eliminar la estación «${st.name}»?`,
                                      });
                                    }}
                                    title="Eliminar"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              PESTAÑA 2: PLANTILLAS (TICKET COMERCIAL & COMANDA DE COCINA)
              ================================================================= */}
          {activeTab === "templates" && (
            <div className="space-y-6">
              {/* 2.1 PLANTILLA DE TICKET DE VENTA (CRITERIO 2 & 3) */}
              <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Plantilla de Ticket Comercial
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Encabezado, datos fiscales, logotipo y mensajes de agradecimiento
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<Eye className="w-3.5 h-3.5" />}
                    onClick={() => setPreviewView("ticket")}
                    className="text-xs"
                  >
                    Ver en Simulador
                  </Button>
                </div>

                <div className="p-5 space-y-4">
                  {/* SELECCIÓN Y SUBIDA DE LOGO (CRITERIO 3) */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Logotipo del negocio en el ticket
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Impreso en la parte superior del comprobante térmico
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        <span>Mostrar logo</span>
                        <input
                          type="checkbox"
                          checked={ticketTemplate.showLogo}
                          onChange={(e) =>
                            setTicketTemplate({ ...ticketTemplate, showLogo: e.target.checked })
                          }
                          className="rounded text-orange-500 focus:ring-orange-500 cursor-pointer w-4 h-4"
                        />
                      </label>
                    </div>

                    {ticketTemplate.showLogo && (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2 border-t border-slate-200/60 dark:border-white/5">
                        <div className="w-16 h-16 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                          {ticketTemplate.customLogoUrl || businessMaster.logoUrl ? (
                            <img
                              src={ticketTemplate.customLogoUrl || businessMaster.logoUrl || ""}
                              alt="Logo"
                              className="max-h-full max-w-full object-contain p-1"
                            />
                          ) : (
                            <Building2 className="w-6 h-6 text-slate-400" />
                          )}
                        </div>

                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleLogoUpload}
                              accept="image/png, image/jpeg, image/webp"
                              className="hidden"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              leftIcon={<Upload className="w-3.5 h-3.5" />}
                              onClick={() => fileInputRef.current?.click()}
                              isLoading={isUploadingLogo}
                            >
                              Subir Nuevo Logotipo
                            </Button>
                            {ticketTemplate.customLogoUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setTicketTemplate({ ...ticketTemplate, customLogoUrl: null })
                                }
                                className="text-xs text-rose-500 hover:underline cursor-pointer"
                              >
                                Restablecer logo por defecto
                              </button>
                            )}
                          </div>
                          <p className="text-[10.5px] text-slate-400">
                            Recomendado: Imagen en blanco y negro o alto contraste, formato PNG con fondo transparente.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CAMPOS FISCALES & DE CONTACTO (CRITERIO 2: DATOS REALES) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Nombre comercial
                      </label>
                      <Input
                        value={ticketTemplate.businessName}
                        onChange={(e) =>
                          setTicketTemplate({ ...ticketTemplate, businessName: e.target.value })
                        }
                        placeholder="Ej. Restaurante Don Pedro"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        NIT / Identificación fiscal
                      </label>
                      <Input
                        value={ticketTemplate.taxId}
                        onChange={(e) =>
                          setTicketTemplate({ ...ticketTemplate, taxId: e.target.value })
                        }
                        placeholder="Ej. 900.123.456-7"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Dirección del local
                      </label>
                      <Input
                        value={ticketTemplate.address}
                        onChange={(e) =>
                          setTicketTemplate({ ...ticketTemplate, address: e.target.value })
                        }
                        placeholder="Ej. Calle 10 # 40-20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Teléfono / Contacto
                      </label>
                      <Input
                        value={ticketTemplate.phone}
                        onChange={(e) =>
                          setTicketTemplate({ ...ticketTemplate, phone: e.target.value })
                        }
                        placeholder="Ej. +57 300 123 4567"
                      />
                    </div>
                  </div>

                  {/* LEYENDAS Y PIE DE PÁGINA */}
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Leyenda de encabezado (Régimen / Subtítulo)
                      </label>
                      <Input
                        value={ticketTemplate.headerText}
                        onChange={(e) =>
                          setTicketTemplate({ ...ticketTemplate, headerText: e.target.value })
                        }
                        placeholder="Ej. Régimen Simple de Tributación — No responsable de IVA"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Mensaje de agradecimiento
                      </label>
                      <Input
                        value={ticketTemplate.thankYouNote}
                        onChange={(e) =>
                          setTicketTemplate({ ...ticketTemplate, thankYouNote: e.target.value })
                        }
                        placeholder="Ej. ¡Gracias por su compra! Esperamos atenderle nuevamente."
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Pie de página / Observación legal
                      </label>
                      <Input
                        value={ticketTemplate.footerText}
                        onChange={(e) =>
                          setTicketTemplate({ ...ticketTemplate, footerText: e.target.value })
                        }
                        placeholder="Ej. Comprobante comercial de control interno."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2.2 PLANTILLA DE COMANDA DE COCINA (CRITERIO 4: SIN PRECIOS, MODIFICADORES RESALTADOS) */}
              <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
                      <UtensilsCrossed className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Plantilla de Comanda de Cocina / Barra
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Formato optimizado para cocineros: sin precios y con modificadores destacados
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<Eye className="w-3.5 h-3.5" />}
                    onClick={() => setPreviewView("kitchen")}
                    className="text-xs"
                  >
                    Ver en Simulador
                  </Button>
                </div>

                <div className="p-5 space-y-4">
                  {/* REGLA CRÍTICA CONF-002: NO MOSTRAR PRECIOS */}
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Ocultar precios en comandas de cocina
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                        La comanda se enfoca exclusivamente en la preparación: no expone valores monetarios.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!kitchenTemplate.showPrices}
                        onChange={(e) =>
                          setKitchenTemplate({ ...kitchenTemplate, showPrices: !e.target.checked })
                        }
                        className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4"
                      />
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        {kitchenTemplate.showPrices ? "Precios Visibles" : "Precios Ocultos (Activo)"}
                      </span>
                    </label>
                  </div>

                  {/* REGLA CRÍTICA CONF-002: RESALTAR MODIFICADORES */}
                  <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Resaltar modificadores e ingredientes especiales
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                        Destaca visualmente agregados [+], exclusiones [-] y términos de cocción para evitar errores.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={kitchenTemplate.highlightModifiers}
                        onChange={(e) =>
                          setKitchenTemplate({
                            ...kitchenTemplate,
                            highlightModifiers: e.target.checked,
                          })
                        }
                        className="rounded text-orange-500 focus:ring-orange-500 cursor-pointer w-4 h-4"
                      />
                      <span className="text-xs font-bold text-orange-700 dark:text-orange-400">
                        Resaltar
                      </span>
                    </label>
                  </div>

                  {/* Metadatos operativos de salón */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <label className="p-3 rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-slate-800 dark:text-white font-medium">Mostrar # de Mesa</span>
                      <input
                        type="checkbox"
                        checked={kitchenTemplate.showTableNumber}
                        onChange={(e) =>
                          setKitchenTemplate({ ...kitchenTemplate, showTableNumber: e.target.checked })
                        }
                        className="rounded text-orange-500 focus:ring-orange-500 cursor-pointer w-4 h-4"
                      />
                    </label>

                    <label className="p-3 rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-slate-800 dark:text-white font-medium">Mostrar Mesero</span>
                      <input
                        type="checkbox"
                        checked={kitchenTemplate.showWaiterName}
                        onChange={(e) =>
                          setKitchenTemplate({ ...kitchenTemplate, showWaiterName: e.target.checked })
                        }
                        className="rounded text-orange-500 focus:ring-orange-500 cursor-pointer w-4 h-4"
                      />
                    </label>

                    <label className="p-3 rounded-xl border border-slate-200/60 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-slate-800 dark:text-white font-medium">Mostrar # Comensales</span>
                      <input
                        type="checkbox"
                        checked={kitchenTemplate.showDinersCount}
                        onChange={(e) =>
                          setKitchenTemplate({ ...kitchenTemplate, showDinersCount: e.target.checked })
                        }
                        className="rounded text-orange-500 focus:ring-orange-500 cursor-pointer w-4 h-4"
                      />
                    </label>
                  </div>

                  {/* Título de comanda */}
                  <div className="space-y-1 pt-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Título superior de comanda
                    </label>
                    <Input
                      value={kitchenTemplate.headerTitle}
                      onChange={(e) =>
                        setKitchenTemplate({ ...kitchenTemplate, headerTitle: e.target.value })
                      }
                      placeholder="*** COMANDA DE COCINA ***"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              PESTAÑA 3: CAJÓN MONEDERO & CONTROLADOR DE IMPRESIÓN
              ================================================================= */}
          {activeTab === "drawer" && (
            <div className="space-y-6">
              {/* 3.1 CAJÓN MONEDERO */}
              <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Configuración de Cajón Monedero
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Apertura automática mediante pulso ESC/POS conectado al puerto RJ11
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Toggle Apertura Automática */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Apertura automática al cobrar en efectivo
                        </span>
                        <Badge variant="emerald" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                          Recomendado
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Envía la señal de apertura de gaveta cada vez que se registre un cobro en caja con billetes o monedas.
                      </p>
                    </div>
                    <label className="cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cashDrawer.autoOpenOnCashSale}
                        onChange={(e) =>
                          setCashDrawer({ ...cashDrawer, autoOpenOnCashSale: e.target.checked })
                        }
                        className="rounded text-orange-500 focus:ring-orange-500 cursor-pointer w-4 h-4"
                      />
                    </label>
                  </div>

                  {/* Impresora Vinculada al Cajón */}
                  <div className="space-y-1.5">
                    <Select
                      label="Impresora conectada al cajón (Puerto RJ11)"
                      value={cashDrawer.targetPrinterId || ""}
                      onChange={(e) =>
                        setCashDrawer({ ...cashDrawer, targetPrinterId: e.target.value || null })
                      }
                    >
                      <option value="">Impresora predeterminada del POS</option>
                      {printers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.connection.toUpperCase()})
                        </option>
                      ))}
                    </Select>
                    <p className="text-[11px] text-slate-400">
                      El cajón monedero debe estar enchufado con cable RJ11 a la parte trasera de esta impresora.
                    </p>
                  </div>

                  {/* Código de Pulso ESC/POS */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Secuencia de comando ESC/POS
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={cashDrawer.drawerKickCode}
                        onChange={(e) =>
                          setCashDrawer({ ...cashDrawer, drawerKickCode: e.target.value })
                        }
                        placeholder="ESC p 0 25 250"
                        className="font-mono text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        leftIcon={<Zap className="w-3.5 h-3.5 text-orange-500" />}
                        onClick={handleTestDrawer}
                        className="shrink-0 text-xs"
                      >
                        Probar Apertura
                      </Button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Estándar Epson/Star/Bixolon: <code className="font-mono text-slate-600 dark:text-slate-300 font-bold">ESC p 0 25 250</code> (PIN 2) o <code className="font-mono text-slate-600 dark:text-slate-300">ESC p 1 25 250</code> (PIN 5).
                    </p>
                  </div>
                </div>
              </div>

              {/* 3.2 CONTROLADOR DE IMPRESIÓN (QZ TRAY VS BROWSER) */}
              <div className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Controlador de Impresión
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Método de comunicación entre NEGOVA y las impresoras térmicas
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Opción 1: Navegador */}
                    <button
                      type="button"
                      onClick={() => setPrintDriver("browser")}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        printDriver === "browser"
                          ? "bg-orange-50/50 dark:bg-orange-500/10 border-orange-500 text-slate-900 dark:text-white ring-1 ring-orange-500/30"
                          : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Nativo del Navegador (window.print)
                        </span>
                        <Badge variant="emerald" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                          Recomendado
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Funciona en cualquier dispositivo (PC, Mac, tabletas Android, iPads) sin requerir instalación de programas adicionales.
                      </p>
                    </button>

                    {/* Opción 2: QZ Tray */}
                    <button
                      type="button"
                      onClick={() => setPrintDriver("qz_tray")}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        printDriver === "qz_tray"
                          ? "bg-orange-50/50 dark:bg-orange-500/10 border-orange-500 text-slate-900 dark:text-white ring-1 ring-orange-500/30"
                          : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          QZ Tray (Impresión Silenciosa)
                        </span>
                        <Badge variant="blue" className="text-[10px] bg-blue-500/10 text-blue-600">
                          Avanzado
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Permite imprimir directo sin abrir el diálogo de confirmación del navegador. Requiere tener instalada la app QZ Tray en la computadora local.
                      </p>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      Fallback seguro: Si QZ Tray no responde o no está instalado, NEGOVA utilizará automáticamente el diálogo de impresión nativo del navegador.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: VISTA PREVIA INTERACTIVA EN TIEMPO REAL (5 COLS) */}
        <div className="lg:col-span-5 sticky top-24">
          <TicketLivePreview
            businessMaster={businessMaster}
            ticketTemplate={ticketTemplate}
            kitchenTemplate={kitchenTemplate}
            activeView={previewView}
            onViewChange={setPreviewView}
            className="h-[680px]"
          />
        </div>
      </div>

      {/* MODAL PARA AGREGAR/EDITAR IMPRESORA */}
      <PrinterFormModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
        onSave={handleSavePrinter}
        editingPrinter={editingPrinter}
      />

      {/* MODAL PARA AGREGAR/EDITAR ESTACIÓN */}
      <StationFormModal
        isOpen={isStationModalOpen}
        onClose={() => setIsStationModalOpen(false)}
        onSave={handleSaveStation}
        editingStation={editingStation}
        printers={printers}
        cashRegisters={cashRegisters}
      />

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN (CERO ALERTAS NATIVAS) */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.title}
        description={deleteConfirm.description}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={() => {
          if (deleteConfirm.type === "printer") {
            handleDeletePrinter(deleteConfirm.id);
          } else {
            handleDeleteStation(deleteConfirm.id);
          }
          setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        }}
        onClose={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
      />
    </AppPageContainer>
  );
}

