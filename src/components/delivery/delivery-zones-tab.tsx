"use client";

import React, { useState, useEffect } from "react";
import {
  MapPin,
  CircleDot,
  Maximize2,
  Plus,
  Sliders,
  DollarSign,
  Clock,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Crosshair,
  Compass,
  Search,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  DeliveryZone,
  DeliveryZoneGeometry,
  GeoPoint,
  CreateDeliveryZoneInput,
  UpdateDeliveryZoneInput,
  findMatchingDeliveryZone,
} from "@/lib/delivery/types";
import {
  getDeliveryZonesAction,
  createDeliveryZoneAction,
  updateDeliveryZoneAction,
  deleteDeliveryZoneAction,
} from "@/app/workspace/[businessId]/pedidos/domicilios/actions";
import { InteractiveZoneMap } from "./interactive-zone-map";
import { ZoneFormModal } from "./zone-form-modal";

interface DeliveryZonesTabProps {
  businessId: string;
}

export function DeliveryZonesTab({ businessId }: DeliveryZonesTabProps) {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);

  // Estados de dibujo
  const [drawingMode, setDrawingMode] = useState<"none" | "radius" | "polygon">("none");
  const [draftGeometry, setDraftGeometry] = useState<DeliveryZoneGeometry | null>(null);
  const [activeColor, setActiveColor] = useState<string>("#ED500A");

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoneToEdit, setZoneToEdit] = useState<DeliveryZone | null>(null);
  const [zoneToDelete, setZoneToDelete] = useState<DeliveryZone | null>(null);

  // Evaluador / Tester de cobertura
  const [testPoint, setTestPoint] = useState<GeoPoint | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  // Cargar zonas
  const loadZones = async () => {
    setIsLoading(true);
    try {
      const res = await getDeliveryZonesAction(businessId);
      if (res.success && res.data) {
        setZones(res.data);
      } else if (res.error) {
        toast.error(res.error);
      }
    } catch {
      toast.error("Error al cargar zonas de entrega.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadZones();
  }, [businessId]);

  // Click en el mapa para evaluar cobertura si no se está dibujando
  const handleMapClickPoint = (point: GeoPoint) => {
    if (drawingMode === "none") {
      setTestPoint(point);
      const matched = findMatchingDeliveryZone(point, zones);
      setTestResult(matched);
      if (matched.inside) {
        toast.info(
          `Punto dentro de: ${matched.zone?.name} (Tarifa: $${Number(
            matched.tariff
          ).toLocaleString("es-CO")})`
        );
      } else {
        toast.warning("Punto fuera de todas las zonas de cobertura habilitadas.");
      }
    }
  };

  // Iniciar dibujo de radio
  const handleStartRadiusDraw = () => {
    setDrawingMode("radius");
    setDraftGeometry({
      type: "radius",
      center: { lat: 4.60971, lng: -74.08175 },
      radiusMeters: 3000,
    });
    toast.info("Haz clic en el mapa para ubicar el centro de la zona.");
  };

  // Iniciar dibujo de polígono
  const handleStartPolygonDraw = () => {
    setDrawingMode("polygon");
    setDraftGeometry({
      type: "polygon",
      coordinates: [],
    });
    toast.info("Haz clic en el mapa para trazar los vértices de la zona.");
  };

  // Cancelar dibujo
  const handleCancelDraw = () => {
    setDrawingMode("none");
    setDraftGeometry(null);
  };

  // Abrir modal con la geometría dibujada
  const handleOpenModalWithDraft = () => {
    if (drawingMode === "polygon") {
      if (!draftGeometry?.coordinates || draftGeometry.coordinates.length < 3) {
        toast.error("Dibuja al menos 3 puntos en el mapa para cerrar el polígono.");
        return;
      }
    } else if (drawingMode === "radius") {
      if (!draftGeometry?.center) {
        toast.error("Haz clic en el mapa para fijar el centro del radio.");
        return;
      }
    }
    setZoneToEdit(null);
    setIsModalOpen(true);
  };

  // Abrir modal de nueva zona manual
  const handleOpenNewManual = () => {
    setZoneToEdit(null);
    setDraftGeometry({
      type: "radius",
      center: { lat: 4.60971, lng: -74.08175 },
      radiusMeters: 3000,
    });
    setIsModalOpen(true);
  };

  // Guardar (crear o editar)
  const handleSaveZone = async (
    input: CreateDeliveryZoneInput | UpdateDeliveryZoneInput
  ) => {
    if ("id" in input) {
      const res = await updateDeliveryZoneAction(businessId, input);
      if (res.success) {
        await loadZones();
        setDrawingMode("none");
        setDraftGeometry(null);
      }
      return res;
    } else {
      const res = await createDeliveryZoneAction(businessId, input);
      if (res.success) {
        await loadZones();
        setDrawingMode("none");
        setDraftGeometry(null);
      }
      return res;
    }
  };

  // Confirmar eliminacion (Modal personalizado UI, cumple regla anti alertas)
  const handleConfirmDelete = async () => {
    if (!zoneToDelete) return;
    try {
      const res = await deleteDeliveryZoneAction(businessId, zoneToDelete.id);
      if (res.success) {
        toast.success(`Zona "${zoneToDelete.name}" eliminada.`);
        setZoneToDelete(null);
        await loadZones();
      } else {
        toast.error(res.error || "No se pudo eliminar la zona.");
      }
    } catch {
      toast.error("Error al procesar la eliminación.");
    }
  };

  // Alternar estado activo / inactivo
  const handleToggleStatus = async (zone: DeliveryZone) => {
    const nextStatus = zone.status === "active" ? "inactive" : "active";
    try {
      const res = await updateDeliveryZoneAction(businessId, {
        id: zone.id,
        status: nextStatus,
      });
      if (res.success) {
        toast.success(`Zona "${zone.name}" marcada como ${nextStatus === "active" ? "activa" : "inactiva"}.`);
        setZones((prev) =>
          prev.map((z) => (z.id === zone.id ? { ...z, status: nextStatus } : z))
        );
      } else {
        toast.error(res.error || "No se pudo actualizar el estado.");
      }
    } catch {
      toast.error("Error al actualizar el estado de la zona.");
    }
  };

  return (
    <div className="space-y-6">
      {/* BARRA DE HERRAMIENTAS SUPERIOR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#0D0F16] p-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Zonas de Cobertura y Tarifas de Domicilio
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#ED500A]/10 text-[#ED500A] border border-[#ED500A]/20">
              {zones.filter((z) => z.status === "active").length} activas
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Dibuja áreas en el mapa para asignar tarifas fijas y tiempos estimados de entrega.
          </p>
        </div>

        {/* BOTONES DE DIBUJO Y CREACIÓN */}
        <div className="flex items-center gap-2 flex-wrap">
          {drawingMode === "none" ? (
            <>
              <button
                type="button"
                onClick={handleStartRadiusDraw}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 transition-all cursor-pointer"
                title="Trazar zona circular con radio en km"
              >
                <CircleDot className="w-3.5 h-3.5" />
                <span>Dibujar Radio</span>
              </button>

              <button
                type="button"
                onClick={handleStartPolygonDraw}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 transition-all cursor-pointer"
                title="Trazar polígono con puntos en el mapa"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Dibujar Polígono</span>
              </button>

              <button
                type="button"
                onClick={handleOpenNewManual}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-xs transition-all active:scale-[0.98] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Zona</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelDraw}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Cancelar Dibujo
              </button>
              <button
                type="button"
                onClick={handleOpenModalWithDraft}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#ED500A] hover:bg-[#ED500A]/90 text-white shadow-md active:scale-98 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Guardar Zona Dibujada</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MAPA INTERACTIVO */}
      <div className="space-y-3">
        <InteractiveZoneMap
          zones={zones}
          selectedZoneId={selectedZone?.id}
          onSelectZone={(zone) => setSelectedZone(zone)}
          drawingMode={drawingMode}
          draftGeometry={draftGeometry}
          onDraftGeometryChange={(geo) => setDraftGeometry(geo)}
          activeColor={activeColor}
          height="520px"
          onMapClickPoint={handleMapClickPoint}
          testPoint={testPoint}
        />

        {/* FEEDBACK DEL EVALUADOR DE COBERTURA */}
        {testPoint && testResult && (
          <div
            className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
              testResult.inside
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-900 dark:text-emerald-200"
                : "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-900 dark:text-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {testResult.inside ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>
                <strong>Prueba de Cobertura:</strong>{" "}
                {testResult.inside
                  ? `Ubicación dentro de "${testResult.zone?.name}". Tarifa aplicable: $${Number(
                      testResult.tariff
                    ).toLocaleString("es-CO")} (${testResult.estimatedTimeMin} min).`
                  : "Ubicación fuera de cobertura. Se emitirá advertencia al crear el pedido a domicilio."}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setTestPoint(null);
                setTestResult(null);
              }}
              className="text-xs font-semibold underline text-slate-500 hover:text-slate-800 dark:hover:text-white"
            >
              Limpiar prueba
            </button>
          </div>
        )}
      </div>

      {/* LISTADO / TARJETAS DE ZONAS CONFIGURADAS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Zonas Registradas ({zones.length})
          </h4>
        </div>

        {zones.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-[#0D0F16] rounded-2xl border border-dashed border-slate-200 dark:border-white/[0.08]">
            <MapPin className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h5 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              Aún no tienes zonas de entrega
            </h5>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-3">
              Usa los botones superiores para dibujar un radio o polígono en el mapa y
              definir tus tarifas de domicilio automáticas.
            </p>
            <button
              type="button"
              onClick={handleStartRadiusDraw}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#ED500A] text-white hover:bg-[#ED500A]/90 transition-all"
            >
              <CircleDot className="w-3.5 h-3.5" />
              <span>Dibujar Primera Zona</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {zones.map((zone) => {
              const isSelected = selectedZone?.id === zone.id;

              return (
                <div
                  key={zone.id}
                  className={`p-4 rounded-2xl bg-white dark:bg-[#0D0F16] border transition-all ${
                    isSelected
                      ? "border-[#ED500A] shadow-md ring-1 ring-[#ED500A]/30"
                      : "border-slate-200 dark:border-white/[0.08] hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: zone.color }}
                      />
                      <div>
                        <h5 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                          {zone.name}
                        </h5>
                        {zone.description && (
                          <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                            {zone.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleStatus(zone)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        zone.status === "active"
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-slate-100 dark:bg-white/5 text-slate-400"
                      }`}
                    >
                      {zone.status === "active" ? "Activa" : "Inactiva"}
                    </button>
                  </div>

                  {/* DATOS DE TARIFA Y TIEMPO */}
                  <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-slate-100 dark:border-white/[0.04] text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Tarifa</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        ${Number(zone.tariff).toLocaleString("es-CO")}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Tiempo</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {zone.estimated_time_min} min
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Mínimo</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        ${Number(zone.min_order).toLocaleString("es-CO")}
                      </span>
                    </div>
                  </div>

                  {/* PIE Y ACCIONES */}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      {zone.geometry?.type === "radius" ? (
                        <>
                          <CircleDot className="w-3 h-3 text-[#ED500A]" />
                          Radio {(((zone.geometry.radiusMeters || 0) / 1000)).toFixed(1)} km
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3 h-3 text-purple-500" />
                          Polígono ({zone.geometry?.coordinates?.length || 0} pts)
                        </>
                      )}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setZoneToEdit(zone);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        title="Editar zona"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoneToDelete(zone)}
                        className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                        title="Eliminar zona"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL CREAR / EDITAR ZONA */}
      <ZoneFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setZoneToEdit(null);
        }}
        zoneToEdit={zoneToEdit}
        draftGeometry={draftGeometry}
        onSave={handleSaveZone}
      />

      {/* MODAL PERSONALIZADO DE CONFIRMACIÓN DE ELIMINACIÓN (SIN ALERTAS NATIVAS) */}
      {zoneToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-[#0D0F16] rounded-2xl p-5 border border-slate-200 dark:border-white/[0.08] shadow-2xl space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                ¿Eliminar zona "{zoneToDelete.name}"?
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Esta acción no se puede deshacer. Los pedidos creados anteriormente
                mantendrán su tarifa histórica.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setZoneToDelete(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-colors"
              >
                Eliminar Zona
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
