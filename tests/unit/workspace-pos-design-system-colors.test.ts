import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("[POS-DESIGN] Alineación de Colores y Superficies al Sistema de Diseño NEGOVA", () => {
  const posClientPath = path.resolve(__dirname, "../../src/components/pos/pos-screen-client.tsx");
  const ticketsDrawerPath = path.resolve(__dirname, "../../src/components/pos/pos-open-tickets-drawer.tsx");

  it("pos-screen-client.tsx no debe tener colores de superficie fuera del sistema (#111420)", () => {
    const content = fs.readFileSync(posClientPath, "utf-8");
    expect(content).not.toContain("#111420");
    expect(content).toContain("dark:bg-white/[0.03]");
  });

  it("pos-screen-client.tsx debe utilizar el naranja insignia #ED500A para los botones de venta y cobro", () => {
    const content = fs.readFileSync(posClientPath, "utf-8");
    // Botón Completar compra
    expect(content).toMatch(/bg-\[#ED500A\].*Completar compra/s);
    // Botón Confirmar y cobrar
    expect(content).toMatch(/bg-\[#ED500A\].*Confirmar y cobrar/s);
    // Botón móvil Ver Venta
    expect(content).toMatch(/bg-\[#ED500A\].*Ver Venta/s);
    // Botón móvil Continuar Cobro
    expect(content).toMatch(/bg-\[#ED500A\].*Continuar Cobro/s);
  });

  it("pos-screen-client.tsx debe utilizar #ED500A en los pills de categoría activa y precios", () => {
    const content = fs.readFileSync(posClientPath, "utf-8");
    expect(content).toContain('selectedCategory === "all"\n                  ? "bg-[#ED500A] text-white shadow-xs');
    expect(content).toContain('text-[#ED500A] font-mono');
  });

  it("pos-open-tickets-drawer.tsx no debe contener #111420 y debe usar acentos #ED500A", () => {
    const content = fs.readFileSync(ticketsDrawerPath, "utf-8");
    expect(content).not.toContain("#111420");
    expect(content).toContain("text-[#ED500A]");
    expect(content).toContain("bg-[#ED500A] text-white font-semibold");
  });

  it("pos-screen-client.tsx debe renderizar la miniatura de la imagen del producto en las líneas del pedido", () => {
    const content = fs.readFileSync(posClientPath, "utf-8");
    expect(content).toContain("itemImage ? (");
    expect(content).toContain("alt={item.productName}");
    expect(content).toContain("className=\"w-full h-full object-cover\"");
  });

  it("ningún componente POS debe utilizar alertas nativas", () => {
    const posContent = fs.readFileSync(posClientPath, "utf-8");
    const drawerContent = fs.readFileSync(ticketsDrawerPath, "utf-8");
    expect(posContent).not.toContain("window.alert");
    expect(posContent).not.toContain("window.confirm");
    expect(drawerContent).not.toContain("window.alert");
    expect(drawerContent).not.toContain("window.confirm");
  });
});

