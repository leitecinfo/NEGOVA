import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  calculateHaversineDistanceMeters,
  isPointInsidePolygon,
  isPointInsideZone,
  findMatchingDeliveryZone,
  GeoPoint,
  DeliveryZone,
} from "@/lib/delivery/types";

describe("DOM-001 - Editor de Zonas de Entrega y Cobertura", () => {
  describe("Cálculos Geoespaciales: Distancia Haversine", () => {
    it("debe retornar 0 metros para dos puntos idénticos", () => {
      const p: GeoPoint = { lat: 4.60971, lng: -74.08175 };
      const dist = calculateHaversineDistanceMeters(p, p);
      expect(dist).toBe(0);
    });

    it("debe calcular con precisión la distancia entre dos coordenadas conocidas", () => {
      // Plaza de Bolívar (Bogotá) -> Parque de la 93 (Bogotá) ~ 9.6 km
      const plazaBolivar: GeoPoint = { lat: 4.5981, lng: -74.0758 };
      const parque93: GeoPoint = { lat: 4.6766, lng: -74.0536 };

      const dist = calculateHaversineDistanceMeters(plazaBolivar, parque93);
      // Debe estar en el rango de 9.0 a 10.5 km (9000 a 10500 metros)
      expect(dist).toBeGreaterThan(9000);
      expect(dist).toBeLessThan(10500);
    });
  });

  describe("Cálculos Geoespaciales: Punto en Polígono (Ray-Casting)", () => {
    // Polígono cuadrangular de prueba centrado en Bogotá
    const squarePolygon: GeoPoint[] = [
      { lat: 4.60, lng: -74.10 },
      { lat: 4.70, lng: -74.10 },
      { lat: 4.70, lng: -74.00 },
      { lat: 4.60, lng: -74.00 },
    ];

    it("debe retornar true si el punto está dentro del polígono", () => {
      const insidePoint: GeoPoint = { lat: 4.65, lng: -74.05 };
      expect(isPointInsidePolygon(insidePoint, squarePolygon)).toBe(true);
    });

    it("debe retornar false si el punto está fuera del polígono", () => {
      const outsidePoint: GeoPoint = { lat: 4.80, lng: -74.05 };
      expect(isPointInsidePolygon(outsidePoint, squarePolygon)).toBe(false);

      const outsidePointWest: GeoPoint = { lat: 4.65, lng: -74.20 };
      expect(isPointInsidePolygon(outsidePointWest, squarePolygon)).toBe(false);
    });

    it("debe retornar false para polígonos degradados con menos de 3 vértices", () => {
      const invalidPoly: GeoPoint[] = [
        { lat: 4.60, lng: -74.10 },
        { lat: 4.70, lng: -74.10 },
      ];
      expect(isPointInsidePolygon({ lat: 4.65, lng: -74.05 }, invalidPoly)).toBe(false);
    });
  });

  describe("Evaluación de Cobertura de Zonas (Radio y Polígono)", () => {
    const centerPoint: GeoPoint = { lat: 4.60971, lng: -74.08175 };

    it("debe evaluar correctamente una zona tipo radio (dentro y fuera)", () => {
      const radiusGeometry = {
        type: "radius" as const,
        center: centerPoint,
        radiusMeters: 2000, // 2 km
      };

      // Punto a 500m del centro
      const nearPoint: GeoPoint = { lat: 4.612, lng: -74.081 };
      expect(isPointInsideZone(nearPoint, radiusGeometry)).toBe(true);

      // Punto a 5km del centro
      const farPoint: GeoPoint = { lat: 4.655, lng: -74.081 };
      expect(isPointInsideZone(farPoint, radiusGeometry)).toBe(false);
    });

    it("debe evaluar correctamente una zona tipo polígono", () => {
      const triangleGeometry = {
        type: "polygon" as const,
        coordinates: [
          { lat: 4.0, lng: -74.0 },
          { lat: 5.0, lng: -74.0 },
          { lat: 4.5, lng: -73.0 },
        ],
      };

      const inside: GeoPoint = { lat: 4.5, lng: -73.7 };
      expect(isPointInsideZone(inside, triangleGeometry)).toBe(true);

      const outside: GeoPoint = { lat: 4.5, lng: -75.0 };
      expect(isPointInsideZone(outside, triangleGeometry)).toBe(false);
    });
  });

  describe("findMatchingDeliveryZone: Selección por Prioridad y Tarifa", () => {
    const mockZones: DeliveryZone[] = [
      {
        id: "zone-broad",
        business_id: "biz-1",
        name: "Zona Amplia Perímetro",
        tariff: 8000,
        min_order: 15000,
        estimated_time_min: 50,
        priority: 1, // Menor prioridad
        color: "#3B82F6",
        status: "active",
        geometry: {
          type: "radius",
          center: { lat: 4.60971, lng: -74.08175 },
          radiusMeters: 8000, // 8 km
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "zone-inner",
        business_id: "biz-1",
        name: "Zona Cercana Express",
        tariff: 4000,
        min_order: 20000,
        estimated_time_min: 25,
        priority: 10, // Mayor prioridad
        color: "#10B981",
        status: "active",
        geometry: {
          type: "radius",
          center: { lat: 4.60971, lng: -74.08175 },
          radiusMeters: 2000, // 2 km
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "zone-inactive",
        business_id: "biz-1",
        name: "Zona Inactiva Suspendida",
        tariff: 2000,
        min_order: 0,
        estimated_time_min: 15,
        priority: 99,
        color: "#6B7280",
        status: "inactive", // Inactiva
        geometry: {
          type: "radius",
          center: { lat: 4.60971, lng: -74.08175 },
          radiusMeters: 1000,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    it("debe seleccionar la zona de mayor prioridad cuando dos zonas activas se solapan", () => {
      // Punto a 1 km del centro (dentro de zone-broad y zone-inner)
      const nearPoint: GeoPoint = { lat: 4.615, lng: -74.08175 };

      const match = findMatchingDeliveryZone(nearPoint, mockZones);
      expect(match.inside).toBe(true);
      expect(match.zone?.id).toBe("zone-inner");
      expect(match.tariff).toBe(4000);
      expect(match.estimatedTimeMin).toBe(25);
    });

    it("debe aplicar la zona amplia cuando está fuera de la zona express pero dentro del perímetro", () => {
      // Punto a 5 km del centro (fuera de zone-inner, dentro de zone-broad)
      const midPoint: GeoPoint = { lat: 4.650, lng: -74.08175 };

      const match = findMatchingDeliveryZone(midPoint, mockZones);
      expect(match.inside).toBe(true);
      expect(match.zone?.id).toBe("zone-broad");
      expect(match.tariff).toBe(8000);
      expect(match.estimatedTimeMin).toBe(50);
    });

    it("debe ignorar zonas inactivas aunque tengan mayor prioridad", () => {
      // Aunque zone-inactive tiene priority 99, status es 'inactive'
      const nearPoint: GeoPoint = { lat: 4.610, lng: -74.08175 };
      const match = findMatchingDeliveryZone(nearPoint, mockZones);

      expect(match.inside).toBe(true);
      expect(match.zone?.id).not.toBe("zone-inactive");
      expect(match.zone?.id).toBe("zone-inner");
    });

    it("debe indicar fuera de cobertura si el punto no pertenece a ninguna zona activa", () => {
      // Punto a 20 km del centro
      const outsidePoint: GeoPoint = { lat: 4.80, lng: -74.08175 };

      const match = findMatchingDeliveryZone(outsidePoint, mockZones);
      expect(match.inside).toBe(false);
      expect(match.tariff).toBe(0);
      expect(match.message).toContain("fuera de las zonas");
    });
  });

  describe("Cumplimiento estricto de Regla Global: Prohibición de Alertas Nativas", () => {
    it("no debe contener llamadas a window.alert, window.confirm, window.prompt o Alert.alert", () => {
      const filesToCheck = [
        path.resolve(__dirname, "../../src/components/delivery/interactive-zone-map.tsx"),
        path.resolve(__dirname, "../../src/components/delivery/zone-form-modal.tsx"),
        path.resolve(__dirname, "../../src/components/delivery/delivery-zones-tab.tsx"),
        path.resolve(__dirname, "../../src/app/workspace/[businessId]/pedidos/domicilios/actions.ts"),
        path.resolve(__dirname, "../../src/app/workspace/[businessId]/pedidos/domicilios/deliveries-client.tsx"),
        path.resolve(__dirname, "../../src/components/pos/order-destination-modal.tsx"),
      ];

      const forbiddenPatterns = [
        /\bwindow\.alert\b/,
        /\balert\s*\(/,
        /\bwindow\.confirm\b/,
        /\bconfirm\s*\(/,
        /\bwindow\.prompt\b/,
        /\bprompt\s*\(/,
        /\bAlert\.alert\b/,
      ];

      for (const filePath of filesToCheck) {
        expect(fs.existsSync(filePath), `Archivo ${filePath} debe existir`).toBe(true);

        const content = fs.readFileSync(filePath, "utf-8");
        for (const pattern of forbiddenPatterns) {
          expect(
            pattern.test(content),
            `El archivo ${path.basename(filePath)} NO debe contener alertas nativas coincidentes con ${pattern}`
          ).toBe(false);
        }
      }
    });
  });
});
