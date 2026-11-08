import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NumberInput } from "../../src/components/ui/number-input";

describe("NumberInput Component", () => {
  it("renders with initial value, label and unit", () => {
    const html = renderToStaticMarkup(
      <NumberInput
        label="Cantidad de merma"
        value={15}
        onChange={() => {}}
        unit="kg"
        min={0}
        max={100}
      />
    );

    expect(html).toContain("Cantidad de merma");
    expect(html).toContain('value="15"');
    expect(html).toContain("kg");
    expect(html).toContain('role="spinbutton"');
    expect(html).toContain('aria-valuenow="15"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toContain('aria-label="Aumentar cantidad"');
    expect(html).toContain('aria-label="Disminuir cantidad"');
  });

  it("disables minus button when value equals min", () => {
    const html = renderToStaticMarkup(
      <NumberInput
        value={0}
        min={0}
        onChange={() => {}}
      />
    );

    // El botón Disminuir debe tener el atributo disabled
    expect(html).toMatch(/<button[^>]*disabled[^>]*aria-label="Disminuir cantidad"/);
  });

  it("disables plus button when value equals max", () => {
    const html = renderToStaticMarkup(
      <NumberInput
        value={50}
        max={50}
        onChange={() => {}}
      />
    );

    // El botón Aumentar debe tener el atributo disabled
    expect(html).toMatch(/<button[^>]*disabled[^>]*aria-label="Aumentar cantidad"/);
  });

  it("renders error message and applies error styles", () => {
    const html = renderToStaticMarkup(
      <NumberInput
        value={-5}
        error="La cantidad no puede ser negativa"
        onChange={() => {}}
      />
    );

    expect(html).toContain("La cantidad no puede ser negativa");
    expect(html).toContain("border-red-500");
  });

  it("renders helper text when provided", () => {
    const html = renderToStaticMarkup(
      <NumberInput
        value={10}
        helperText="Introduce la cantidad contada en almacén"
        onChange={() => {}}
      />
    );

    expect(html).toContain("Introduce la cantidad contada en almacén");
  });
});
