import { describe, it, expect, vi, beforeEach } from "vitest";
import { getWorkspaceStaff } from "@/lib/restaurant/staff-service";
import { readFileSync } from "fs";
import { join } from "path";

// Mock Supabase Admin Client
const mockBusinessUsers = [
  {
    user_id: "usr-owner-1",
    status: "active",
    role_id: "role-1",
    roles: { id: "role-1", code: "owner", name: "Propietario del Negocio" },
  },
  {
    user_id: "usr-waiter-2",
    status: "active",
    role_id: "role-2",
    roles: { id: "role-2", code: "auxiliar", name: "Auxiliar" },
  },
];

const mockProfiles = [
  {
    id: "usr-owner-1",
    full_name: "Eva Maria Lopez Mejia",
    phone: "3103699076",
    avatar_url: null,
  },
  {
    id: "usr-waiter-2",
    full_name: "Juan Carlos Gómez Díaz",
    phone: "3123456701",
    avatar_url: null,
  },
];

const mockEmployees = [
  {
    id: "emp-3",
    user_id: null,
    first_name: "Pedro",
    last_name: "Pérez",
    job_title: "Domiciliario",
    status: "active",
    phone: "3009876543",
    email: null,
  },
];

const mockAuthUsers = [
  { id: "usr-owner-1", email: "alexandersmithh2002@gmail.com" },
  { id: "usr-waiter-2", email: "lucashoyos2002@gmail.com" },
];

vi.mock("@/lib/auth/users-service", () => ({
  getSupabaseAdminClient: vi.fn(async () => ({
    auth: {
      admin: {
        listUsers: () => Promise.resolve({ data: { users: mockAuthUsers }, error: null }),
      },
    },
    from: (table: string) => {
      if (table === "business_employees") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: mockEmployees, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "business_users") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: mockBusinessUsers, error: null }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: mockProfiles, error: null }),
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "users") {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: mockAuthUsers, error: null }),
          }),
        };
      }
      return {
        select: () => Promise.resolve({ data: [], error: null }),
      };
    },
  })),
}));

vi.mock("@/lib/auth/cargos-service", () => ({
  getBusinessEmployeeCargos: vi.fn(async () => ({
    "usr-waiter-2": ["Mesero"],
  })),
}));

describe("Módulo de Personal y Responsables de Pedido (getWorkspaceStaff)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unifica usuarios reales del negocio con perfiles, emails, roles y cargos operativos", async () => {
    const staff = await getWorkspaceStaff("biz-1", "usr-owner-1");

    expect(staff.length).toBe(3);

    // 1. Usuario actual (dueño) debe quedar de primero con nombre real y email
    expect(staff[0].userId).toBe("usr-owner-1");
    expect(staff[0].name).toBe("Eva Maria Lopez Mejia");
    expect(staff[0].email).toBe("alexandersmithh2002@gmail.com");
    expect(staff[0].isCurrentUser).toBe(true);
    expect(staff[0].roles).toContain("Propietario del Negocio");

    // 2. Auxiliar con nombre real completo, email, teléfono y cargo Mesero
    const waiter = staff.find((s) => s.userId === "usr-waiter-2");
    expect(waiter).toBeDefined();
    expect(waiter?.name).toBe("Juan Carlos Gómez Díaz");
    expect(waiter?.email).toBe("lucashoyos2002@gmail.com");
    expect(waiter?.phone).toBe("3123456701");
    expect(waiter?.roles).toContain("Mesero");
    expect(waiter?.roles).toContain("Auxiliar");

    // 3. Empleado de nómina/personal sin cuenta de usuario (Domiciliario)
    const delivery = staff.find((s) => s.id === "emp-3");
    expect(delivery).toBeDefined();
    expect(delivery?.name).toBe("Pedro Pérez");
    expect(delivery?.roles).toContain("Domiciliario");
  });

  it("verifica que no se utilicen alertas nativas en el selector de responsables", () => {
    const filePath = join(
      process.cwd(),
      "src/components/pos/pos-responsible-selector.tsx"
    );
    const content = readFileSync(filePath, "utf-8");

    expect(content).not.toMatch(/window\.alert/);
    expect(content).not.toMatch(/window\.confirm/);
    expect(content).not.toMatch(/window\.prompt/);
  });
});
