import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DatePicker } from "../../src/components/ui/date-picker";

describe("DatePicker Component", () => {
  it("renders with formatted date, label and calendar icon", () => {
    const html = renderToStaticMarkup(
      <DatePicker
        label="Fecha de la merma"
        value="2026-11-07"
        onChange={() => {}}
      />
    );

    expect(html).toContain("Fecha de la merma");
    // Formato legible DD/MM/YYYY
    expect(html).toContain("07/11/2026");
    // No debe ser un input HTML5 nativo type="date"
    expect(html).not.toContain('type="date"');
    // Debe tener el rol y accesibilidad de diálogo
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it("renders placeholder when no date is selected", () => {
    const html = renderToStaticMarkup(
      <DatePicker
        label="Fecha opcional"
        placeholder="Elegir día..."
        onChange={() => {}}
      />
    );

    expect(html).toContain("Fecha opcional");
    expect(html).toContain("Elegir día...");
  });

  it("renders required indicator when required", () => {
    const html = renderToStaticMarkup(
      <DatePicker
        label="Fecha obligatoria"
        required
        onChange={() => {}}
      />
    );

    expect(html).toContain("Fecha obligatoria");
    expect(html).toContain("*");
  });

  it("renders clear button when date is selected and clearable is true", () => {
    const html = renderToStaticMarkup(
      <DatePicker
        value="2026-11-07"
        clearable={true}
        onChange={() => {}}
      />
    );

    expect(html).toContain('title="Borrar fecha"');
  });

  it("renders error state when error message is passed", () => {
    const html = renderToStaticMarkup(
      <DatePicker
        error="Fecha inválida"
        onChange={() => {}}
      />
    );

    expect(html).toContain("Fecha inválida");
    expect(html).toContain("border-red-500");
  });

  it("supports right alignment prop without crashing", () => {
    const html = renderToStaticMarkup(
      <DatePicker
        label="Fecha derecha"
        value="2026-11-07"
        align="right"
        onChange={() => {}}
      />
    );

    expect(html).toContain("Fecha derecha");
    expect(html).toContain("07/11/2026");
  });
});

