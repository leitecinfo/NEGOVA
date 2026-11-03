import { describe, it, expect, vi, beforeEach } from "vitest";

// ==============================================================================
// MOCKS DE SUPABASE Y AUTENTICACIÓN PARA PRUEBAS UNITARIAS DE SERVER ACTIONS
// ==============================================================================

const BUSINESS_RESTAURANT = "a8e2612f-4acc-4c84-a420-220131b70d66";

let mockAuthUser: { id: string; email: string } | null = null;
let mockUserRole: "owner" | "auxiliar" | null = null;

// Mock de Supabase Client para supabase.auth.getUser()
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn().mockImplementation(async () => {
        if (!mockAuthUser) {
          return { data: { user: null }, error: new Error("No session") };
        }
        return { data: { user: mockAuthUser }, error: null };
      }),
    },
  })),
}));

// Mock de Supabase Admin Client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "businesses") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: BUSINESS_RESTAURANT,
                  name: "Burger Fast Food",
                  status: "active",
                  business_type: "restaurant",
                  commercial_activities: ["sell_products"],
                  settings: {},
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: mockAuthUser?.id || "user-1", platform_role: "customer", status: "active" },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "business_users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockImplementation(async () => {
                  if (!mockAuthUser || !mockUserRole) return { data: null, error: null };
                  return {
                    data: {
                      id: "bu-test-1",
                      status: "active",
                      role_id: `role-${mockUserRole}`,
                      roles: {
                        id: `role-${mockUserRole}`,
                        code: mockUserRole,
                        name: mockUserRole === "owner" ? "Dueño / Propietario" : "Auxiliar / Ayudante",
                      },
                    },
                    error: null,
                  };
                }),
              }),
            }),
          }),
        };
      }

      if (table === "subscriptions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "sub-1",
                      status: "active",
                      plan_id: "negocio",
                      current_period_end: new Date(Date.now() + 86400000).toISOString(),
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }

      if (table === "role_permissions" || table === "business_user_permissions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }

      // Default mock for mutational operations (cash, inventory, suppliers, etc.)
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "inserted-1" }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: "updated-1" }, error: null }),
              }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  })),
}));

// Mock de revalidatePath de Next.js
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock de cash-service e inventory-service para aislar la autorización del server action
vi.mock("@/lib/cash/cash-service", () => ({
  getCashRegisters: vi.fn().mockResolvedValue([{ id: "reg-1", name: "Caja 1" }]),
  createCashRegister: vi.fn().mockResolvedValue({ id: "reg-new", name: "Caja 2" }),
  getActiveCashSession: vi.fn().mockResolvedValue(null),
  openCashSession: vi.fn().mockResolvedValue({ id: "ses-1", status: "open" }),
  closeCashSession: vi.fn().mockResolvedValue({ id: "ses-1", status: "closed" }),
  recordCashMovement: vi.fn().mockResolvedValue({ id: "mov-1", amount: 100 }),
  getCashMovements: vi.fn().mockResolvedValue([]),
  getCashSessionSummary: vi.fn().mockResolvedValue({ totalCash: 100 }),
}));

vi.mock("@/lib/inventory/inventory-service", () => ({
  getBusinessLocations: vi.fn().mockResolvedValue([{ id: "loc-1", name: "Bodega Principal" }]),
  createLocation: vi.fn().mockResolvedValue({ id: "loc-new", name: "Barra 2" }),
  getInventoryStock: vi.fn().mockResolvedValue([]),
  upsertInventoryStock: vi.fn().mockResolvedValue({ id: "stock-1", quantity: 50 }),
  recordInventoryMovement: vi.fn().mockResolvedValue({ id: "inv-mov-1", quantity: 10 }),
}));

// ==============================================================================
// IMPORTACIÓN DE LAS SERVER ACTIONS PROTEGIDAS
// ==============================================================================

import {
  createCashRegisterAction,
  openCashSessionAction,
  closeCashSessionAction,
  recordCashMovementAction,
  getCashRegistersAction,
} from "@/app/workspace/[businessId]/cajas/actions";

import {
  createLocationAction,
  recordInventoryMovementAction,
  transferStockAction,
  getBusinessLocationsAction,
} from "@/app/workspace/[businessId]/inventario/actions";

import {
  createSupplierAction,
  deleteSupplierAction,
} from "@/app/workspace/[businessId]/proveedores/actions";

import {
  createPurchaseAction,
  cancelPurchaseAction,
} from "@/app/workspace/[businessId]/compras/actions";

import {
  createExpenseAction,
  deleteExpenseAction,
} from "@/app/workspace/[businessId]/gastos/actions";

import {
  createRecipeAction,
  deleteRecipeAction,
} from "@/app/workspace/[businessId]/recetas/actions";

// ==============================================================================
// SUITE DE PRUEBAS DE AUTORIZACIÓN GRANULAR [PERM-001]
// ==============================================================================

describe("PERM-001: Auditoría y Aplicación de Permisos Granulares en Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----------------------------------------------------------------------------
  // CRITERIO DE ACEPTACIÓN 1: Sin sesión activa -> 401 / No autenticado
  // ----------------------------------------------------------------------------
  describe("1. [Criterio de Aceptación] Llamar action sensible sin sesión activa debe fallar (401)", () => {
    beforeEach(() => {
      mockAuthUser = null;
      mockUserRole = null;
    });

    it("rechaza createCashRegisterAction sin autenticación", async () => {
      const res = await createCashRegisterAction(BUSINESS_RESTAURANT, { name: "Caja No Auth" });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/No autenticado|inicie sesión/i);
    });

    it("rechaza openCashSessionAction sin autenticación", async () => {
      const res = await openCashSessionAction(BUSINESS_RESTAURANT, {
        registerId: "00000000-0000-0000-0000-000000000001",
        initialAmount: 50000,
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/No autenticado|inicie sesión/i);
    });

    it("rechaza transferStockAction sin autenticación", async () => {
      const res = await transferStockAction(BUSINESS_RESTAURANT, {
        productId: "00000000-0000-0000-0000-000000000001",
        fromLocationId: "00000000-0000-0000-0000-000000000001",
        toLocationId: "00000000-0000-0000-0000-000000000002",
        quantity: 5,
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/No autenticado|inicie sesión/i);
    });

    it("rechaza createSupplierAction sin autenticación", async () => {
      const res = await createSupplierAction(BUSINESS_RESTAURANT, { name: "Proveedor X" });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/No autenticado|inicie sesión/i);
    });

    it("rechaza cancelPurchaseAction sin autenticación", async () => {
      const res = await cancelPurchaseAction(BUSINESS_RESTAURANT, "purchase-1");
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/No autenticado|inicie sesión/i);
    });

    it("rechaza deleteExpenseAction sin autenticación", async () => {
      const res = await deleteExpenseAction(BUSINESS_RESTAURANT, "expense-1");
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/No autenticado|inicie sesión/i);
    });

    it("rechaza createRecipeAction sin autenticación", async () => {
      const res = await createRecipeAction(BUSINESS_RESTAURANT, {
        productId: "00000000-0000-0000-0000-000000000001",
        yieldPortions: 1,
        ingredients: [{ name: "Carne", quantity: 200, unit: "g", unitCost: 10 }],
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/No autenticado|inicie sesión/i);
    });
  });

  // ----------------------------------------------------------------------------
  // CRITERIO DE ACEPTACIÓN 2: Rol sin permiso suficiente -> 403 / Permisos insuficientes
  // ----------------------------------------------------------------------------
  describe("2. [Criterio de Aceptación] Llamar action sensible con rol sin permiso debe fallar (403)", () => {
    beforeEach(() => {
      mockAuthUser = { id: "user-auxiliar-456", email: "auxiliar@negova.com" };
      mockUserRole = "auxiliar"; // Rol Auxiliar carece de permisos de administración exclusivos de Owner
    });

    it("un Auxiliar NO puede crear cajas registradoras (cash.manage)", async () => {
      const res = await createCashRegisterAction(BUSINESS_RESTAURANT, { name: "Caja Auxiliar" });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Permisos insuficientes/i);
    });

    it("un Auxiliar NO puede transferir stock entre ubicaciones (inventory.transfer)", async () => {
      const res = await transferStockAction(BUSINESS_RESTAURANT, {
        productId: "00000000-0000-0000-0000-000000000001",
        fromLocationId: "00000000-0000-0000-0000-000000000001",
        toLocationId: "00000000-0000-0000-0000-000000000002",
        quantity: 10,
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Permisos insuficientes/i);
    });

    it("un Auxiliar NO puede realizar ajustes o mermas manuales (inventory.adjust)", async () => {
      const res = await recordInventoryMovementAction(BUSINESS_RESTAURANT, {
        productId: "00000000-0000-0000-0000-000000000001",
        locationId: "00000000-0000-0000-0000-000000000001",
        movementType: "adjustment",
        quantity: -5,
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Permisos insuficientes|No tienes autorización/i);
    });

    it("un Auxiliar NO puede anular compras ya registradas (purchases.cancel)", async () => {
      const res = await cancelPurchaseAction(BUSINESS_RESTAURANT, "purchase-1");
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Permisos insuficientes/i);
    });

    it("un Auxiliar NO puede eliminar proveedores (suppliers.delete)", async () => {
      const res = await deleteSupplierAction(BUSINESS_RESTAURANT, "supplier-1");
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Permisos insuficientes/i);
    });

    it("un Auxiliar NO puede eliminar gastos (expenses.delete)", async () => {
      const res = await deleteExpenseAction(BUSINESS_RESTAURANT, "expense-1");
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Permisos insuficientes/i);
    });

    it("un Auxiliar NO puede crear recetas o escandallos (recipes.create)", async () => {
      const res = await createRecipeAction(BUSINESS_RESTAURANT, {
        productId: "00000000-0000-0000-0000-000000000001",
        yieldPortions: 1,
        ingredients: [{ name: "Queso", quantity: 50, unit: "g", unitCost: 5 }],
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Permisos insuficientes/i);
    });
  });

  // ----------------------------------------------------------------------------
  // CRITERIO DE ACEPTACIÓN 3: Operaciones operativas autorizadas para Auxiliar
  // ----------------------------------------------------------------------------
  describe("3. Operaciones operativas permitidas para Auxiliar", () => {
    beforeEach(() => {
      mockAuthUser = { id: "user-auxiliar-456", email: "auxiliar@negova.com" };
      mockUserRole = "auxiliar";
    });

    it("un Auxiliar PUEDE abrir turno de caja (cash.open)", async () => {
      const res = await openCashSessionAction(BUSINESS_RESTAURANT, {
        registerId: "00000000-0000-0000-0000-000000000001",
        initialAmount: 100000,
      });
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
    });

    it("un Auxiliar PUEDE registrar movimientos de efectivo (cash.move)", async () => {
      const res = await recordCashMovementAction(BUSINESS_RESTAURANT, {
        sessionId: "00000000-0000-0000-0000-000000000001",
        movementType: "entry",
        amount: 20000,
        notes: "Cambio inicial extra",
      });
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
    });

    it("un Auxiliar PUEDE registrar entradas regulares de stock (inventory.create)", async () => {
      const res = await recordInventoryMovementAction(BUSINESS_RESTAURANT, {
        productId: "00000000-0000-0000-0000-000000000001",
        locationId: "00000000-0000-0000-0000-000000000001",
        movementType: "entry",
        quantity: 25,
      });
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
    });

    it("un Auxiliar PUEDE registrar nuevos proveedores (suppliers.create)", async () => {
      const res = await createSupplierAction(BUSINESS_RESTAURANT, {
        name: "Distribuidora Pan",
        phone: "3009998877",
      });
      expect(res.success).toBe(true);
    });

    it("un Auxiliar PUEDE registrar gastos operativos (expenses.create)", async () => {
      const res = await createExpenseAction(BUSINESS_RESTAURANT, {
        category: "servicios",
        amount: 15000,
        description: "Bolsas de papel para despacho",
      });
      expect(res.success).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // CRITERIO DE ACEPTACIÓN 4: Operaciones completas para Owner
  // ----------------------------------------------------------------------------
  describe("4. Acceso total para el rol Dueño / Owner", () => {
    beforeEach(() => {
      mockAuthUser = { id: "user-owner-123", email: "owner@negova.com" };
      mockUserRole = "owner";
    });

    it("el Dueño PUEDE crear cajas registradoras (cash.manage)", async () => {
      const res = await createCashRegisterAction(BUSINESS_RESTAURANT, { name: "Caja Barra Principal" });
      expect(res.success).toBe(true);
    });

    it("el Dueño PUEDE transferir stock entre bodegas (inventory.transfer)", async () => {
      const res = await transferStockAction(BUSINESS_RESTAURANT, {
        productId: "00000000-0000-0000-0000-000000000001",
        fromLocationId: "00000000-0000-0000-0000-000000000001",
        toLocationId: "00000000-0000-0000-0000-000000000002",
        quantity: 15,
      });
      expect(res.success).toBe(true);
    });

    it("el Dueño PUEDE anular compras (purchases.cancel)", async () => {
      const res = await cancelPurchaseAction(BUSINESS_RESTAURANT, "purchase-1");
      expect(res.success).toBe(true);
    });

    it("el Dueño PUEDE eliminar proveedores (suppliers.delete)", async () => {
      const res = await deleteSupplierAction(BUSINESS_RESTAURANT, "supplier-1");
      expect(res.success).toBe(true);
    });

    it("el Dueño PUEDE eliminar gastos (expenses.delete)", async () => {
      const res = await deleteExpenseAction(BUSINESS_RESTAURANT, "expense-1");
      expect(res.success).toBe(true);
    });

    it("el Dueño PUEDE crear recetas vinculadas a productos (recipes.create)", async () => {
      const res = await createRecipeAction(BUSINESS_RESTAURANT, {
        productId: "00000000-0000-0000-0000-000000000001",
        yieldPortions: 1,
        ingredients: [{ name: "Pan Brioche", quantity: 1, unit: "unidad", unitCost: 1500 }],
      });
      expect(res.success).toBe(true);
    });
  });
});
