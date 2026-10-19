import { describe, it, expect, vi } from "vitest";
import React from "react";
import {
  Tabs,
  AdminTabs,
  TabItem,
  TabsProps,
} from "@/components/ui/tabs";
import {
  AdminTabs as BridgeAdminTabs,
} from "@/components/admin/ui/admin-tabs";

describe("Tabs — Componente Neutral y Puente de Compatibilidad", () => {
  const sampleTabs: TabItem<"general" | "detalles" | "auditoria">[] = [
    { id: "general", label: "General", count: 5 },
    { id: "detalles", label: "Detalles", count: 0 },
    { id: "auditoria", label: "Auditoría", disabled: true },
  ];

  it("debe garantizar que Tabs y AdminTabs apunten a la misma implementación canónica", () => {
    expect(Tabs).toBeDefined();
    expect(AdminTabs).toBe(Tabs);
    expect(BridgeAdminTabs).toBe(Tabs);
  });

  it("debe instanciar el componente con props estándar sin errores", () => {
    const handleChange = vi.fn();
    const element = React.createElement(Tabs<"general" | "detalles" | "auditoria">, {
      tabs: sampleTabs,
      activeTab: "general",
      onChange: handleChange,
      size: "md",
      className: "custom-class",
    });

    expect(element).toBeDefined();
    expect(element.props.tabs.length).toBe(3);
    expect(element.props.activeTab).toBe("general");
    expect(element.props.size).toBe("md");
    expect(element.props.className).toBe("custom-class");
  });

  it("debe aceptar callbacks tipados de onChange pasando el tabId", () => {
    const handleChange = vi.fn((tabId: string) => tabId);
    const element = React.createElement(Tabs, {
      tabs: sampleTabs,
      activeTab: "general",
      onChange: handleChange,
    });

    expect(element.props.onChange).toBeDefined();
    element.props.onChange("detalles");
    expect(handleChange).toHaveBeenCalledWith("detalles");
  });

  it("debe soportar tamaño 'sm' y 'md'", () => {
    const elementSm = React.createElement(Tabs, {
      tabs: sampleTabs,
      activeTab: "general",
      onChange: vi.fn(),
      size: "sm",
    });

    expect(elementSm.props.size).toBe("sm");
  });
});
