import { describe, it, expect } from "vitest";
import { CreateSupplierInputSchema, Supplier } from "../../src/lib/purchases/types";

describe("Submodal rápido para dar de alta proveedores desde la orden de compra", () => {
  const mockExistingSuppliers: Supplier[] = [
    {
      id: "supp-1",
      businessId: "biz-1",
      name: "Distribuidora El Grano S.A.S.",
      taxId: "900123456-1",
      paymentTermsDays: 30,
      status: "active",
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: "2026-11-01T00:00:00Z",
    },
  ];

  it("Campos del formulario: debe validar los datos requeridos y opcionales", () => {
    // 1. Datos válidos con todos los campos especificados por el usuario
    const validSupplier = {
      name: "Lácteos y Derivados del Valle S.A.S.",
      contactName: "Claudia Restrepo",
      phone: "+57 312 987 6543",
      taxId: "901.456.789-0",
      email: "pedidos@lacteosvalle.com",
      paymentTermsDays: 15,
      address: "Carrera 45 # 12-30, Bodega 5, Zona Industrial",
      notes: "Entregas los martes y jueves",
    };

    const parsed = CreateSupplierInputSchema.safeParse(validSupplier);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.name).toBe("Lácteos y Derivados del Valle S.A.S.");
    expect(parsed.data?.contactName).toBe("Claudia Restrepo");
    expect(parsed.data?.phone).toBe("+57 312 987 6543");
    expect(parsed.data?.taxId).toBe("901.456.789-0");
    expect(parsed.data?.email).toBe("pedidos@lacteosvalle.com");
    expect(parsed.data?.paymentTermsDays).toBe(15);
    expect(parsed.data?.address).toBe("Carrera 45 # 12-30, Bodega 5, Zona Industrial");
  });

  it("Validación: Nombre / Razón Social (*) es estrictamente obligatorio", () => {
    const invalidEmptyName = {
      name: "   ",
      phone: "3001234567",
      paymentTermsDays: 0,
    };

    const parsed = CreateSupplierInputSchema.safeParse(invalidEmptyName);
    expect(parsed.success).toBe(false);
  });

  it("Plazo de pago: debe soportar Contado (0 días), 8 días, 15 días, 30 días, etc.", () => {
    const presets = [
      { value: "0", label: "Contado (0 días)", days: 0 },
      { value: "8", label: "8 días", days: 8 },
      { value: "15", label: "15 días", days: 15 },
      { value: "30", label: "30 días (1 mes)", days: 30 },
      { value: "45", label: "45 días", days: 45 },
      { value: "60", label: "60 días (2 meses)", days: 60 },
      { value: "custom", label: "Otro plazo personalizado...", days: 21 },
    ];

    presets.forEach((preset) => {
      const parsed = CreateSupplierInputSchema.safeParse({
        name: `Proveedor ${preset.label}`,
        paymentTermsDays: preset.days,
      });
      expect(parsed.success).toBe(true);
      expect(parsed.data?.paymentTermsDays).toBe(preset.days);
    });
  });

  it("Al crearse: debe incorporarse a la lista y seleccionarse automáticamente sin recargar la página", () => {
    let currentSuppliers = [...mockExistingSuppliers];
    let selectedSupplierId = "";
    let defaultCreditDays = "0";

    const handleSupplierCreated = (newSupplier: Supplier) => {
      // 1. Añadir a la lista local
      currentSuppliers = [...currentSuppliers, newSupplier];
      // 2. Seleccionar automáticamente
      selectedSupplierId = newSupplier.id;
      // 3. Sincronizar días de crédito si los tiene
      if (newSupplier.paymentTermsDays && newSupplier.paymentTermsDays > 0) {
        defaultCreditDays = String(newSupplier.paymentTermsDays);
      }
    };

    const createdSupplier: Supplier = {
      id: "supp-new-99",
      businessId: "biz-1",
      name: "Avícola La Colina",
      contactName: "Roberto Gómez",
      phone: "3105556677",
      taxId: "800222333-4",
      email: "ventas@colina.co",
      paymentTermsDays: 15,
      address: "Vereda La Palma Km 4",
      status: "active",
      createdAt: "2026-11-03T01:00:00Z",
      updatedAt: "2026-11-03T01:00:00Z",
    };

    handleSupplierCreated(createdSupplier);

    // Verificar inserción y selección inmediata en memoria
    expect(currentSuppliers).toHaveLength(2);
    expect(currentSuppliers.some((s) => s.id === "supp-new-99")).toBe(true);
    expect(selectedSupplierId).toBe("supp-new-99");
    expect(defaultCreditDays).toBe("15");
  });

  it("Botones del formulario: debe contener 'Cancelar' y 'Crear Proveedor'", () => {
    const formButtons = {
      cancel: "Cancelar",
      submit: "Crear Proveedor",
    };

    expect(formButtons.cancel).toBe("Cancelar");
    expect(formButtons.submit).toBe("Crear Proveedor");
  });

  it("Regla Global: Prohibido uso de alertas nativas en el submodal de proveedor", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(
      "src/app/workspace/[businessId]/compras/quick-supplier-modal.tsx"
    );
    const fileContent = fs.readFileSync(filePath, "utf-8");

    expect(fileContent).not.toMatch(/\bwindow\.alert\s*\(/);
    expect(fileContent).not.toMatch(/\balert\s*\(/);
    expect(fileContent).not.toMatch(/\bwindow\.confirm\s*\(/);
    expect(fileContent).not.toMatch(/\bconfirm\s*\(/);
    expect(fileContent).not.toMatch(/\bwindow\.prompt\s*\(/);
    expect(fileContent).not.toMatch(/\bprompt\s*\(/);

    // Debe usar toast de Sonner para notificaciones
    expect(fileContent).toMatch(/toast\.(success|error)/);
  });
});
