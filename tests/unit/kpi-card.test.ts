import { describe, it, expect, vi } from "vitest";
import React from "react";
import {
  KpiCard,
  KpiGrid,
  AdminKpiCard,
  AdminKpiGrid,
  KpiCardProps,
  KpiVariant,
} from "@/components/ui/kpi-card";
import {
  AdminKpiCard as BridgeAdminKpiCard,
  AdminKpiGrid as BridgeAdminKpiGrid,
} from "@/components/admin/ui/admin-kpi-card";

describe("KpiCard & KpiGrid — Componentes Neutrales y Puentes de Compatibilidad", () => {
  it("debe garantizar que KpiCard y AdminKpiCard apunten a la misma implementación canónica", () => {
    expect(KpiCard).toBeDefined();
    expect(AdminKpiCard).toBe(KpiCard);
    expect(BridgeAdminKpiCard).toBe(KpiCard);
  });

  it("debe garantizar que KpiGrid y AdminKpiGrid apunten a la misma implementación canónica", () => {
    expect(KpiGrid).toBeDefined();
    expect(AdminKpiGrid).toBe(KpiGrid);
    expect(BridgeAdminKpiGrid).toBe(KpiGrid);
  });

  it("debe instanciar KpiCard con props estándar y variantes de color", () => {
    const handleClick = vi.fn();
    const element = React.createElement(KpiCard, {
      title: "Ventas Totales",
      value: "$1.250.000",
      subtext: "+15% vs mes anterior",
      icon: React.createElement("span", null, "ICON"),
      variant: "emerald",
      isSelected: true,
      onClick: handleClick,
      trend: {
        value: "+12.5%",
        isPositive: true,
      },
    });

    expect(element).toBeDefined();
    expect(element.props.title).toBe("Ventas Totales");
    expect(element.props.value).toBe("$1.250.000");
    expect(element.props.variant).toBe("emerald");
    expect(element.props.isSelected).toBe(true);
    expect(element.props.trend.value).toBe("+12.5%");
  });

  it("debe instanciar KpiGrid con diferentes configuraciones de columnas", () => {
    const grid4 = React.createElement(KpiGrid, { cols: 4 }, "Hijos 4");
    expect(grid4).toBeDefined();
    expect(grid4.props.cols).toBe(4);

    const grid3 = React.createElement(KpiGrid, { cols: 3 }, "Hijos 3");
    expect(grid3).toBeDefined();
    expect(grid3.props.cols).toBe(3);

    const grid5 = React.createElement(KpiGrid, { cols: 5 }, "Hijos 5");
    expect(grid5).toBeDefined();
    expect(grid5.props.cols).toBe(5);
  });
});
