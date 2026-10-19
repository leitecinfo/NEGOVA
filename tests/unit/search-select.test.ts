import { describe, it, expect, vi } from "vitest";
import React from "react";
import {
  SearchSelect,
  AdminSearchSelect,
  SearchSelectOption,
  SearchSelectProps,
} from "@/components/ui/search-select";
import {
  AdminSearchSelect as BridgeAdminSearchSelect,
} from "@/components/admin/ui/admin-search-select";

describe("SearchSelect — Componente Neutral y Puente de Compatibilidad", () => {
  const sampleOptions: SearchSelectOption[] = [
    { value: "antioquia", label: "Antioquia", description: "Departamento de Colombia" },
    { value: "cundinamarca", label: "Cundinamarca", description: "Región Central" },
    { value: "valle", label: "Valle del Cauca", description: "Región Pacífica", disabled: true },
  ];

  it("debe garantizar que SearchSelect y AdminSearchSelect apunten a la misma implementación canónica", () => {
    expect(SearchSelect).toBeDefined();
    expect(AdminSearchSelect).toBe(SearchSelect);
    expect(BridgeAdminSearchSelect).toBe(SearchSelect);
  });

  it("debe instanciar el componente con props estándar sin errores", () => {
    const handleChange = vi.fn();
    const element = React.createElement(SearchSelect, {
      label: "Departamento",
      options: sampleOptions,
      value: "antioquia",
      onChange: handleChange,
      placeholder: "Seleccionar departamento...",
      searchPlaceholder: "Buscar departamento...",
      emptyText: "Sin resultados",
      required: true,
      clearable: true,
      disabled: false,
    });

    expect(element).toBeDefined();
    expect(element.props.label).toBe("Departamento");
    expect(element.props.options.length).toBe(3);
    expect(element.props.value).toBe("antioquia");
    expect(element.props.required).toBe(true);
    expect(element.props.clearable).toBe(true);
  });

  it("debe aceptar callbacks tipados de onChange con string directo", () => {
    const handleChange = vi.fn((val: string) => val);
    const element = React.createElement(SearchSelect, {
      options: sampleOptions,
      onChange: handleChange,
    });

    expect(element.props.onChange).toBeDefined();
    element.props.onChange("antioquia");
    expect(handleChange).toHaveBeenCalledWith("antioquia");
  });

  it("debe manejar opciones con iconos, descripciones y estado disabled", () => {
    const element = React.createElement(SearchSelect, {
      options: sampleOptions,
      onChange: vi.fn(),
      value: "valle",
      disabled: true,
      isLoading: true,
    });

    expect(element.props.disabled).toBe(true);
    expect(element.props.isLoading).toBe(true);
    expect(element.props.options[2].disabled).toBe(true);
    expect(element.props.options[2].description).toBe("Región Pacífica");
  });
});
