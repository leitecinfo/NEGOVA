"use client";

import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  DeliveryZone,
  DeliveryZoneGeometry,
  GeoPoint,
} from "@/lib/delivery/types";
import {
  Layers,
  ZoomIn,
  ZoomOut,
  MapPin,
  Trash2,
  Check,
  Undo2,
  Sliders,
  Crosshair,
} from "lucide-react";

interface InteractiveZoneMapProps {
  zones: DeliveryZone[];
  selectedZoneId?: string | null;
  onSelectZone?: (zone: DeliveryZone) => void;
  drawingMode?: "none" | "radius" | "polygon";
  draftGeometry?: DeliveryZoneGeometry | null;
  onDraftGeometryChange?: (geo: DeliveryZoneGeometry | null) => void;
  activeColor?: string;
  defaultCenter?: GeoPoint;
  defaultZoom?: number;
  height?: string;
  onMapClickPoint?: (point: GeoPoint) => void;
  testPoint?: GeoPoint | null;
}

const CITY_PRESETS = [
  { name: "Bogotá", lat: 4.60971, lng: -74.08175 },
  { name: "Medellín", lat: 6.2442, lng: -75.5812 },
  { name: "Cali", lat: 3.4516, lng: -76.532 },
  { name: "Barranquilla", lat: 10.9685, lng: -74.7813 },
  { name: "Bucaramanga", lat: 7.1254, lng: -73.1198 },
  { name: "Cartagena", lat: 10.391, lng: -75.4794 },
];

export function InteractiveZoneMap({
  zones,
  selectedZoneId,
  onSelectZone,
  drawingMode = "none",
  draftGeometry,
  onDraftGeometryChange,
  activeColor = "#ED500A",
  defaultCenter = { lat: 4.60971, lng: -74.08175 }, // Bogotá por defecto
  defaultZoom = 13,
  height = "520px",
  onMapClickPoint,
  testPoint,
}: InteractiveZoneMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layersGroupRef = useRef<any>(null);
  const draftLayerGroupRef = useRef<any>(null);
  const testMarkerRef = useRef<any>(null);

  const [radiusSliderMeters, setRadiusSliderMeters] = useState<number>(
    draftGeometry?.type === "radius" && draftGeometry.radiusMeters
      ? draftGeometry.radiusMeters
      : 2500
  );
  const [polygonPoints, setPolygonPoints] = useState<GeoPoint[]>(
    draftGeometry?.type === "polygon" && draftGeometry.coordinates
      ? draftGeometry.coordinates
      : []
  );
  const [radiusCenter, setRadiusCenter] = useState<GeoPoint | null>(
    draftGeometry?.type === "radius" && draftGeometry.center
      ? draftGeometry.center
      : null
  );

  // Inicialización de Leaflet en el cliente
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const L = (await import("leaflet")).default;

      if (!isMounted || !mapContainerRef.current) return;

      // Crear mapa
      const map = L.map(mapContainerRef.current, {
        center: [defaultCenter.lat, defaultCenter.lng],
        zoom: defaultZoom,
        zoomControl: false, // Usaremos botones personalizados más limpios
      });

      // Añadir capa de OpenStreetMap
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Grupos de capas
      const layersGroup = L.layerGroup().addTo(map);
      const draftGroup = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
      layersGroupRef.current = layersGroup;
      draftLayerGroupRef.current = draftGroup;

      // Click handler en el mapa
      map.on("click", (e: any) => {
        const clickedPoint: GeoPoint = { lat: e.latlng.lat, lng: e.latlng.lng };

        if (onMapClickPoint) {
          onMapClickPoint(clickedPoint);
        }
      });
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Manejador dinámico de clicks según modo de dibujo
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleDrawClick = (e: any) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      if (drawingMode === "radius") {
        setRadiusCenter({ lat, lng });
        if (onDraftGeometryChange) {
          onDraftGeometryChange({
            type: "radius",
            center: { lat, lng },
            radiusMeters: radiusSliderMeters,
          });
        }
      } else if (drawingMode === "polygon") {
        setPolygonPoints((prev) => {
          const next = [...prev, { lat, lng }];
          if (onDraftGeometryChange) {
            onDraftGeometryChange({
              type: "polygon",
              coordinates: next,
            });
          }
          return next;
        });
      }
    };

    map.on("click", handleDrawClick);

    return () => {
      map.off("click", handleDrawClick);
    };
  }, [drawingMode, radiusSliderMeters, onDraftGeometryChange]);

  // Actualizar radio cuando cambia el slider
  const handleRadiusSliderChange = (newMeters: number) => {
    setRadiusSliderMeters(newMeters);
    if (radiusCenter && onDraftGeometryChange) {
      onDraftGeometryChange({
        type: "radius",
        center: radiusCenter,
        radiusMeters: newMeters,
      });
    }
  };

  // Renderizar capas de zonas guardadas en el mapa
  useEffect(() => {
    async function renderSavedZones() {
      if (!mapInstanceRef.current || !layersGroupRef.current) return;
      const L = (await import("leaflet")).default;
      const layersGroup = layersGroupRef.current;
      layersGroup.clearLayers();

      for (const zone of zones) {
        if (!zone.geometry) continue;
        const isSelected = selectedZoneId === zone.id;
        const color = zone.color || "#ED500A";
        const fillOpacity = isSelected ? 0.45 : 0.22;
        const weight = isSelected ? 3.5 : 2;

        let layer: any = null;

        if (zone.geometry.type === "radius" && zone.geometry.center && zone.geometry.radiusMeters) {
          layer = L.circle([zone.geometry.center.lat, zone.geometry.center.lng], {
            radius: zone.geometry.radiusMeters,
            color,
            fillColor: color,
            fillOpacity,
            weight,
          });
        } else if (zone.geometry.type === "polygon" && Array.isArray(zone.geometry.coordinates)) {
          const latLngs = zone.geometry.coordinates.map((c) => [c.lat, c.lng] as [number, number]);
          layer = L.polygon(latLngs, {
            color,
            fillColor: color,
            fillOpacity,
            weight,
          });
        }

        if (layer) {
          const popupContent = `
            <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
              <strong style="font-size: 13px; color: ${color};">${zone.name}</strong>
              <div style="margin-top: 4px; color: #475569;">
                Tarifa: <strong>$${Number(zone.tariff).toLocaleString("es-CO")}</strong><br/>
                Tiempo est.: <strong>${zone.estimated_time_min} min</strong><br/>
                Pedido mín.: <strong>$${Number(zone.min_order).toLocaleString("es-CO")}</strong>
              </div>
            </div>
          `;
          layer.bindPopup(popupContent);

          if (onSelectZone) {
            layer.on("click", (e: any) => {
              L.DomEvent.stopPropagation(e);
              onSelectZone(zone);
            });
          }

          layer.addTo(layersGroup);
        }
      }
    }

    renderSavedZones();
  }, [zones, selectedZoneId, onSelectZone]);

  // Renderizar la geometría que se está dibujando (Draft)
  useEffect(() => {
    async function renderDraft() {
      if (!mapInstanceRef.current || !draftLayerGroupRef.current) return;
      const L = (await import("leaflet")).default;
      const draftGroup = draftLayerGroupRef.current;
      draftGroup.clearLayers();

      if (drawingMode === "none") return;

      if (drawingMode === "radius" && radiusCenter) {
        // Centro
        L.circleMarker([radiusCenter.lat, radiusCenter.lng], {
          radius: 6,
          color: activeColor,
          fillColor: "#ffffff",
          fillOpacity: 1,
          weight: 3,
        }).addTo(draftGroup);

        // Círculo de cobertura
        L.circle([radiusCenter.lat, radiusCenter.lng], {
          radius: radiusSliderMeters,
          color: activeColor,
          fillColor: activeColor,
          fillOpacity: 0.28,
          weight: 2.5,
          dashArray: "6, 6",
        }).addTo(draftGroup);
      }

      if (drawingMode === "polygon" && polygonPoints.length > 0) {
        // Vértices
        polygonPoints.forEach((p, idx) => {
          L.circleMarker([p.lat, p.lng], {
            radius: idx === 0 ? 7 : 5,
            color: activeColor,
            fillColor: idx === 0 ? "#10B981" : "#ffffff",
            fillOpacity: 1,
            weight: 2.5,
          }).addTo(draftGroup);
        });

        // Línea o polígono
        const latLngs = polygonPoints.map((p) => [p.lat, p.lng] as [number, number]);
        if (polygonPoints.length >= 3) {
          L.polygon(latLngs, {
            color: activeColor,
            fillColor: activeColor,
            fillOpacity: 0.25,
            weight: 2.5,
            dashArray: "4, 4",
          }).addTo(draftGroup);
        } else if (polygonPoints.length >= 2) {
          L.polyline(latLngs, {
            color: activeColor,
            weight: 2.5,
            dashArray: "4, 4",
          }).addTo(draftGroup);
        }
      }
    }

    renderDraft();
  }, [drawingMode, radiusCenter, radiusSliderMeters, polygonPoints, activeColor]);

  // Marcador del punto de prueba (para probar cobertura)
  useEffect(() => {
    async function renderTestPoint() {
      if (!mapInstanceRef.current) return;
      const L = (await import("leaflet")).default;

      if (testMarkerRef.current) {
        mapInstanceRef.current.removeLayer(testMarkerRef.current);
        testMarkerRef.current = null;
      }

      if (testPoint) {
        const marker = L.circleMarker([testPoint.lat, testPoint.lng], {
          radius: 8,
          color: "#EF4444",
          fillColor: "#F87171",
          fillOpacity: 0.9,
          weight: 3,
        }).addTo(mapInstanceRef.current);

        marker.bindPopup(`Punto de entrega evaluado: [${testPoint.lat.toFixed(4)}, ${testPoint.lng.toFixed(4)}]`);
        testMarkerRef.current = marker;
      }
    }

    renderTestPoint();
  }, [testPoint]);

  // Controles de zoom
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  // Centrar en ciudad
  const handleCenterCity = (city: { lat: number; lng: number }) => {
    mapInstanceRef.current?.setView([city.lat, city.lng], 13);
  };

  // Limpiar dibujo
  const handleClearDraft = () => {
    setRadiusCenter(null);
    setPolygonPoints([]);
    if (onDraftGeometryChange) onDraftGeometryChange(null);
  };

  // Deshacer último vértice del polígono
  const handleUndoPolygonPoint = () => {
    if (polygonPoints.length === 0) return;
    const next = polygonPoints.slice(0, -1);
    setPolygonPoints(next);
    if (onDraftGeometryChange) {
      onDraftGeometryChange(next.length > 0 ? { type: "polygon", coordinates: next } : null);
    }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-white/[0.08] shadow-md bg-slate-100 dark:bg-slate-900">
      {/* CONTENEDOR DEL MAPA LEAFLET */}
      <div ref={mapContainerRef} style={{ height, width: "100%" }} className="z-0" />

      {/* CONTROLES FLOTANTES DEL MAPA: CIUDADES & ZOOM */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 bg-white/90 dark:bg-[#0D0F16]/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] shadow-sm">
        <span className="text-[10px] font-bold text-slate-500 uppercase px-1.5 flex items-center gap-1">
          <Crosshair className="w-3 h-3" />
          Centrar:
        </span>
        {CITY_PRESETS.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => handleCenterCity(c)}
            className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 bg-white/90 dark:bg-[#0D0F16]/90 backdrop-blur-md p-1 rounded-xl border border-slate-200 dark:border-white/[0.08] shadow-sm">
        <button
          type="button"
          onClick={handleZoomIn}
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          title="Acercar mapa"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          title="Alejar mapa"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* BARRA INFORMATIVA / HERRAMIENTAS INLINE DURANTE DIBUJO */}
      {drawingMode !== "none" && (
        <div className="absolute bottom-3 left-3 right-3 z-10 bg-slate-900/95 text-white backdrop-blur-md p-3 rounded-2xl border border-slate-700 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ED500A] animate-ping shrink-0" />
            <div className="text-xs">
              {drawingMode === "radius" ? (
                <span>
                  <strong>Modo Radio:</strong>{" "}
                  {radiusCenter
                    ? `Centro fijado en [${radiusCenter.lat.toFixed(4)}, ${radiusCenter.lng.toFixed(4)}]. Ajusta el radio.`
                    : "Haz clic en el mapa para colocar el centro de la zona de reparto."}
                </span>
              ) : (
                <span>
                  <strong>Modo Polígono:</strong>{" "}
                  {polygonPoints.length === 0
                    ? "Haz clic en el mapa para añadir el primer vértice de la zona."
                    : `${polygonPoints.length} vértice(s) marcados. ${
                        polygonPoints.length < 3
                          ? `Faltan ${3 - polygonPoints.length} para formar un área.`
                          : "Área cerrada válida."
                      }`}
                </span>
              )}
            </div>
          </div>

          {/* CONTROLES SEGÚN MODO */}
          <div className="flex items-center gap-2 flex-wrap">
            {drawingMode === "radius" && radiusCenter && (
              <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl text-xs">
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-300 font-mono font-bold">
                  {(radiusSliderMeters / 1000).toFixed(1)} km
                </span>
                <input
                  type="range"
                  min="500"
                  max="15000"
                  step="250"
                  value={radiusSliderMeters}
                  onChange={(e) => handleRadiusSliderChange(Number(e.target.value))}
                  className="w-28 accent-[#ED500A] cursor-pointer"
                />
              </div>
            )}

            {drawingMode === "polygon" && polygonPoints.length > 0 && (
              <button
                type="button"
                onClick={handleUndoPolygonPoint}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1"
                title="Deshacer último punto"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Deshacer punto</span>
              </button>
            )}

            {(radiusCenter || polygonPoints.length > 0) && (
              <button
                type="button"
                onClick={handleClearDraft}
                className="px-2.5 py-1.5 rounded-xl bg-rose-900/40 hover:bg-rose-900/60 border border-rose-700/60 text-xs font-semibold text-rose-300 transition-colors flex items-center gap-1"
                title="Limpiar trazo"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
