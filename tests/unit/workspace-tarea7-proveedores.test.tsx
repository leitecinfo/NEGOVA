import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs";
import { Supplier, Purchase } from "@/lib/purchases/types";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  toggleSupplierStatus,
  deleteSupplier,
  findDuplicateSupplier,
} from "@/lib/purchases/purchases-service";
import { SupplierSelector } from "@/components/purchases/supplier-selector";

describe("TAREA 7 — Proveedores: Integridad, Aislamiento y Experiencia de Usuario", () => {
  const businessAlex = "a8e2612f-4acc-4c84-a420-220131b70d66";
  const businessOther = "542dbff2-7a4e-4f1e-beec-b852928f592b";

  describe("1. Detección y prevención de duplicados dentro del mismo negocio", () => {
    const existingList: Supplier[] = [
      {
        id: "sup-1",
        businessId: businessAlex,
        name: "Avícola del Norte S.A.S.",
        taxId: "900123456-1",
        contactName: "Pedro Páramo",
        phone: "3001112233",
        email: "ventas@avicola.com",
        address: "Calle 10 # 5-20",
        paymentTermsDays: 15,
        notes: null,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    it("detecta duplicado exacto por nombre ignorando mayúsculas y espacios", () => {
      const dup = findDuplicateSupplier(existingList, "  avícola del norte s.a.s.  ");
      expect(dup).not.toBeNull();
      expect(dup?.id).toBe("sup-1");
    });

    it("detecta duplicado por número de identificación (NIT)", () => {
      const dup = findDuplicateSupplier(existingList, "Otro Nombre Comercial", "900123456-1");
      expect(dup).not.toBeNull();
      expect(dup?.id).toBe("sup-1");
    });

    it("no marca duplicado si se excluye el ID propio durante edición", () => {
      const dup = findDuplicateSupplier(
        existingList,
        "Avícola del Norte S.A.S.",
        "900123456-1",
        "sup-1"
      );
      expect(dup).toBeNull();
    });

    it("permite proveedores con nombres distintos e identificaciones diferentes", () => {
      const dup = findDuplicateSupplier(existingList, "Distribuidora Láctea", "800999000-2");
      expect(dup).toBeNull();
    });
  });

  describe("2. Aislamiento multi-tenant y persistencia en Supabase", () => {
    it("los proveedores registrados para un negocio solo son visibles para ese business_id", async () => {
      const uniqueName = `Proveedor Alex MultiTenant ${Date.now()}`;
      const created = await createSupplier(businessAlex, {
        name: uniqueName,
        taxId: "901999888-7",
      });

      try {
        // En Alex debe existir
        const listAlex = await getSuppliers(businessAlex);
        const inAlex = listAlex.some((s) => s.id === created.id);
        expect(inAlex).toBe(true);

        // En Otro Negocio NO debe figurar
        const listOther = await getSuppliers(businessOther);
        const inOther = listOther.some((s) => s.id === created.id);
        expect(inOther).toBe(false);
      } finally {
        await deleteSupplier(businessAlex, created.id);
      }
    });
  });

  describe("3. Desactivación lógica e integridad de compras históricas", () => {
    it("desactivar un proveedor conserva su registro pero lo marca como inactivo", async () => {
      const uniqueName = `Proveedor Inactivo Test ${Date.now()}`;
      const created = await createSupplier(businessAlex, {
        name: uniqueName,
        phone: "3115556677",
      });

      try {
        expect(created.status).toBe("active");

        const deactivated = await toggleSupplierStatus(businessAlex, created.id, "inactive");
        expect(deactivated.status).toBe("inactive");

        const suppliers = await getSuppliers(businessAlex);
        const found = suppliers.find((s) => s.id === created.id);
        expect(found?.status).toBe("inactive");
      } finally {
        await deleteSupplier(businessAlex, created.id);
      }
    });
  });

  describe("4. Selector de proveedores en Compras (SupplierSelector)", () => {
    const mockSuppliers: Supplier[] = [
      {
        id: "sup-active-1",
        businessId: businessAlex,
        name: "Distribuidora Los Andes",
        taxId: "900.555.111",
        contactName: "Andrés López",
        phone: "3004445566",
        email: "losandes@test.com",
        address: "Av 30 # 20",
        paymentTermsDays: 30,
        notes: null,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "sup-inactive-2",
        businessId: businessAlex,
        name: "Distribuidora El Porvenir (Inactivo)",
        taxId: "800.222.333",
        contactName: null,
        phone: null,
        email: null,
        address: null,
        paymentTermsDays: 0,
        notes: null,
        status: "inactive",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    it("renderiza correctamente el selector con el proveedor activo y no utiliza un HTML select nativo", () => {
      const html = renderToStaticMarkup(
        <SupplierSelector
          suppliers={mockSuppliers}
          value="sup-active-1"
          onChange={() => {}}
          onOpenCreateSupplier={() => {}}
        />
      );

      // Debe mostrar el nombre del proveedor seleccionado
      expect(html).toContain("Distribuidora Los Andes");
      expect(html).toContain("NIT: 900.555.111");
      // No debe ser un elemento select nativo
      expect(html).not.toContain("<select");
    });

    it("muestra placeholder descriptivo y botón de creación rápida de proveedor", () => {
      const html = renderToStaticMarkup(
        <SupplierSelector
          suppliers={mockSuppliers}
          value=""
          onChange={() => {}}
          onOpenCreateSupplier={() => {}}
          placeholder="Seleccionar distribuidor..."
        />
      );

      expect(html).toContain("Seleccionar distribuidor...");
      expect(html).toContain("Nuevo");
    });
  });

  describe("5. Regla Global de Código: Prohibición de alertas nativas", () => {
    it("no debe contener referencias a window.alert, window.confirm o window.prompt", () => {
      const files = [
        "src/app/workspace/[businessId]/proveedores/workspace-proveedores-client.tsx",
        "src/app/workspace/[businessId]/proveedores/supplier-form-modal.tsx",
        "src/app/workspace/[businessId]/proveedores/supplier-detail-modal.tsx",
        "src/app/workspace/[businessId]/proveedores/confirm-toggle-status-modal.tsx",
        "src/app/workspace/[businessId]/proveedores/confirm-delete-supplier-modal.tsx",
        "src/components/purchases/supplier-selector.tsx",
        "src/app/workspace/[businessId]/compras/quick-supplier-modal.tsx",
      ];

      for (const f of files) {
        const content = fs.readFileSync(f, "utf8");
        expect(content).not.toMatch(/window\.(alert|confirm|prompt)/);
        expect(content).not.toMatch(/\balert\s*\(/);
        expect(content).not.toMatch(/\bconfirm\s*\(/);
        expect(content).not.toMatch(/\bprompt\s*\(/);
      }
    });
  });
});
