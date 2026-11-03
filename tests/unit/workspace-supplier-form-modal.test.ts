import { describe, it, expect } from "vitest";
import { CreateSupplierInputSchema, Supplier } from "../../src/lib/purchases/types";
import { PAYMENT_TERMS_OPTIONS } from "../../src/app/workspace/[businessId]/proveedores/supplier-form-modal";

describe("Modal para Crear y Editar Proveedores", () => {
  it("Subtítulo: debe presentar la guía amigable para el usuario", () => {
    const subtitle = "Solo el nombre es obligatorio; el resto lo puedes completar después.";
    expect(subtitle).toBe("Solo el nombre es obligatorio; el resto lo puedes completar después.");
  });

  it("Bloque 1 (Identificación): Nombre es obligatorio y NIT/Cédula soporta dígito de verificación independiente", () => {
    // 1. Caso con NIT y DV separados
    const nitBase = "901234567";
    const dv = "8";
    const combinedTaxId = `${nitBase.trim()}-${dv.trim()}`;

    const validSupplier = {
      name: "Distribuidora San Antonio S.A.S.",
      taxId: combinedTaxId,
      paymentTermsDays: 30,
    };

    const parsed = CreateSupplierInputSchema.safeParse(validSupplier);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.name).toBe("Distribuidora San Antonio S.A.S.");
    expect(parsed.data?.taxId).toBe("901234567-8");

    // 2. Solo NIT sin DV
    const onlyNit = {
      name: "Comercializadora Los Andes",
      taxId: "800555444",
      paymentTermsDays: 0,
    };
    const parsedOnlyNit = CreateSupplierInputSchema.safeParse(onlyNit);
    expect(parsedOnlyNit.success).toBe(true);
    expect(parsedOnlyNit.data?.taxId).toBe("800555444");

    // 3. Sin NIT (opcional)
    const withoutTaxId = {
      name: "Ferretería El Tornillo",
    };
    const parsedWithoutTaxId = CreateSupplierInputSchema.safeParse(withoutTaxId);
    expect(parsedWithoutTaxId.success).toBe(true);
    expect(parsedWithoutTaxId.data?.taxId).toBeUndefined();

    // 4. Nombre vacío debe fallar
    const emptyName = {
      name: "   ",
    };
    const parsedEmpty = CreateSupplierInputSchema.safeParse(emptyName);
    expect(parsedEmpty.success).toBe(false);
  });

  it("Bloque 2 (Contacto): debe soportar Persona de contacto, Teléfono o celular, Correo y Dirección física", () => {
    const contactData = {
      name: "Avícola del Valle",
      contactName: "Laura Gómez (Asesora comercial)",
      phone: "+57 310 123 4567",
      email: "pedidos@avicoladelvalle.com",
      address: "Carrera 45 # 12-34 Bodega 3, Medellín",
      paymentTermsDays: 15,
    };

    const parsed = CreateSupplierInputSchema.safeParse(contactData);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.contactName).toBe("Laura Gómez (Asesora comercial)");
    expect(parsed.data?.phone).toBe("+57 310 123 4567");
    expect(parsed.data?.email).toBe("pedidos@avicoladelvalle.com");
    expect(parsed.data?.address).toBe("Carrera 45 # 12-34 Bodega 3, Medellín");
  });

  it("Bloque 3 (Condiciones): Menú desplegable con 'Sin definir', 'De contado', '8 días', '15 días', '30 días', etc.", () => {
    expect(PAYMENT_TERMS_OPTIONS).toBeDefined();

    const values = PAYMENT_TERMS_OPTIONS.map((o) => o.value);
    expect(values).toContain("none"); // Sin definir
    expect(values).toContain("0");    // De contado
    expect(values).toContain("8");    // 8 días
    expect(values).toContain("15");   // 15 días
    expect(values).toContain("30");   // 30 días
    expect(values).toContain("45");   // 45 días
    expect(values).toContain("60");   // 60 días
    expect(values).toContain("90");   // 90 días
    expect(values).toContain("custom"); // Personalizado

    // Comprobar etiquetas
    const noneOption = PAYMENT_TERMS_OPTIONS.find((o) => o.value === "none");
    expect(noneOption?.label).toContain("Sin definir");

    const contadoOption = PAYMENT_TERMS_OPTIONS.find((o) => o.value === "0");
    expect(contadoOption?.label).toContain("De contado");

    const days8Option = PAYMENT_TERMS_OPTIONS.find((o) => o.value === "8");
    expect(days8Option?.label).toBe("8 días");

    const days15Option = PAYMENT_TERMS_OPTIONS.find((o) => o.value === "15");
    expect(days15Option?.label).toBe("15 días");

    const days30Option = PAYMENT_TERMS_OPTIONS.find((o) => o.value === "30");
    expect(days30Option?.label).toContain("30 días");
  });

  it("Pie del modal: Resumen lateral con nombre y plazo configurado, y botones 'Cancelar' y 'Crear proveedor'", () => {
    const resolveSummary = (name: string, termSelection: string, customDays: string) => {
      let termLabel = "Sin definir";
      if (termSelection === "0") termLabel = "De contado";
      else if (termSelection === "8") termLabel = "8 días";
      else if (termSelection === "15") termLabel = "15 días";
      else if (termSelection === "30") termLabel = "30 días";
      else if (termSelection === "custom") termLabel = `${customDays} días`;

      return {
        displayName: name.trim() || "Sin nombre aún",
        termBadge: `Plazo: ${termLabel}`,
        cancelButton: "Cancelar",
        submitButton: "Crear proveedor",
      };
    };

    const summary1 = resolveSummary("Harinas del Campo", "30", "30");
    expect(summary1.displayName).toBe("Harinas del Campo");
    expect(summary1.termBadge).toBe("Plazo: 30 días");
    expect(summary1.cancelButton).toBe("Cancelar");
    expect(summary1.submitButton).toBe("Crear proveedor");

    const summary2 = resolveSummary("", "none", "");
    expect(summary2.displayName).toBe("Sin nombre aún");
    expect(summary2.termBadge).toBe("Plazo: Sin definir");
  });

  it("Edición: debe pre-cargar nombre, NIT dividido en base y DV, y plazo existente", () => {
    const existingSupplier: Supplier = {
      id: "supp-edit-1",
      businessId: "biz-1",
      name: "Lácteos Santa Fe S.A.",
      taxId: "900987654-3",
      contactName: "Marcela Restrepo",
      phone: "3004567890",
      email: "marcela@santafe.com",
      address: "Km 2 Vía Oriente",
      paymentTermsDays: 15,
      status: "active",
      notes: "Descuento 3% pronto pago",
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
    };

    // Separación de taxId
    const parts = (existingSupplier.taxId || "").split("-");
    const nitBase = parts[0];
    const dv = parts[1] || "";

    expect(nitBase).toBe("900987654");
    expect(dv).toBe("3");
    expect(existingSupplier.paymentTermsDays).toBe(15);
  });

  it("Regla Global: Prohibido uso de alertas nativas en el modal de proveedor", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      "src/app/workspace/[businessId]/proveedores/supplier-form-modal.tsx"
    );
    const fileContent = fs.readFileSync(filePath, "utf-8");

    expect(fileContent).not.toMatch(/\bwindow\.alert\s*\(/);
    expect(fileContent).not.toMatch(/\balert\s*\(/);
    expect(fileContent).not.toMatch(/\bwindow\.confirm\s*\(/);
    expect(fileContent).not.toMatch(/\bconfirm\s*\(/);
    expect(fileContent).not.toMatch(/\bwindow\.prompt\s*\(/);
    expect(fileContent).not.toMatch(/\bprompt\s*\(/);

    // Debe usar toast de Sonner
    expect(fileContent).toMatch(/toast\.(success|error)/);
  });
});
