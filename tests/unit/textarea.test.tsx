import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Textarea } from "../../src/components/ui/textarea";

describe("Textarea Component", () => {
  it("renders with label, placeholder and rows", () => {
    const html = renderToStaticMarkup(
      <Textarea
        label="Observaciones"
        placeholder="Detalles adicionales..."
        rows={4}
      />
    );

    expect(html).toContain("Observaciones");
    expect(html).toContain('placeholder="Detalles adicionales..."');
    expect(html).toContain('rows="4"');
  });

  it("renders required indicator when required", () => {
    const html = renderToStaticMarkup(
      <Textarea
        label="Descripción del motivo"
        required
      />
    );

    expect(html).toContain("Descripción del motivo");
    expect(html).toContain("*");
  });

  it("renders error state when error is provided", () => {
    const html = renderToStaticMarkup(
      <Textarea
        error="El campo es obligatorio"
      />
    );

    expect(html).toContain("El campo es obligatorio");
    expect(html).toContain("border-red-500");
  });
});

