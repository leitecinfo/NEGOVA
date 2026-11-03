import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

// Mock de Supabase Client (admin y server)
const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

// Mock de auth & verifyWorkspaceAction
const mockVerifyWorkspaceAction = vi.fn();
vi.mock("@/lib/auth/workspace-context", () => ({
  verifyWorkspaceAction: (...args: any[]) => mockVerifyWorkspaceAction(...args),
  requireWorkspaceSession: vi.fn(async () => ({
    user: { id: "user-123" },
    business: { id: "11111111-1111-4111-8111-111111111111" },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createReservation,
  getReservations,
  getReservationById,
  updateReservation,
  assignReservationTable,
  updateReservationStatus,
  deleteReservation,
  getReservationMetrics,
} from "@/lib/reservations/reservations-service";
import {
  CreateReservationSchema,
  RESERVATION_STATUSES,
  RESERVATION_ORIGINS,
} from "@/lib/reservations/types";
import {
  getReservationsAction,
  createReservationAction,
  updateReservationAction,
  assignReservationTableAction,
  updateReservationStatusAction,
  deleteReservationAction,
  getReservationMetricsAction,
} from "@/app/workspace/[businessId]/reservas/actions";

describe("[RES-001] Módulo de Reservas de Restaurante", () => {
  const businessId = "11111111-1111-4111-8111-111111111111";
  const salaPrincipalId = "22222222-2222-4222-8222-222222222222";
  const mesa04Id = "33333333-3333-4333-8333-333333333333";
  const reservationId = "44444444-4444-4444-8444-444444444444";

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyWorkspaceAction.mockResolvedValue({ success: true, authorized: true });
  });

  it("1. La migración SQL de reservas existe y define la tabla y políticas RLS", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20261101180000_reservations_schema.sql"
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sql = fs.readFileSync(migrationPath, "utf-8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.reservations");
    expect(sql).toContain("customer_name TEXT NOT NULL");
    expect(sql).toContain("party_size INTEGER NOT NULL DEFAULT 2");
    expect(sql).toContain("date DATE NOT NULL");
    expect(sql).toContain("time TIME NOT NULL");
    expect(sql).toContain("room_id UUID REFERENCES public.restaurant_rooms(id)");
    expect(sql).toContain("table_id UUID REFERENCES public.restaurant_tables(id)");
    expect(sql).toContain("ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("tenant_reservations_read");
    expect(sql).toContain("tenant_reservations_insert");
    expect(sql).toContain("tenant_reservations_update");
    expect(sql).toContain("tenant_reservations_delete");
  });

  it("2. Valida la creación de una reserva para 4 personas a las 8PM (20:00) en la Sala Principal", async () => {
    const input = {
      customer_name: "Familia Gómez",
      phone: "+573001234567",
      email: "gomez@example.com",
      party_size: 4,
      date: "2026-11-05",
      time: "20:00",
      room_id: salaPrincipalId,
      special_requests: "Celebración de cumpleaños, mesa junto a la ventana",
      allergies: "Sin mariscos",
      status: "confirmed" as const,
      origin: "phone" as const,
    };

    // Validar esquema
    const parsed = CreateReservationSchema.parse(input);
    expect(parsed.party_size).toBe(4);
    expect(parsed.time).toBe("20:00");
    expect(parsed.room_id).toBe(salaPrincipalId);

    // Mock supabase insert
    mockFrom.mockImplementation((table: string) => {
      if (table === "reservations") {
        return {
          insert: vi.fn().mockImplementation((payload: any) => {
            expect(payload.business_id).toBe(businessId);
            expect(payload.customer_name).toBe("Familia Gómez");
            expect(payload.party_size).toBe(4);
            expect(payload.time).toBe("20:00:00");
            expect(payload.room_id).toBe(salaPrincipalId);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: reservationId,
                    ...payload,
                    min_spend: 0,
                    deposit_amount: 0,
                    created_at: "2026-11-01T12:00:00.000Z",
                    updated_at: "2026-11-01T12:00:00.000Z",
                    restaurant_rooms: { name: "Sala Principal" },
                    restaurant_tables: null,
                  },
                  error: null,
                }),
              }),
            };
          }),
        };
      }
      throw new Error(`Tabla no mockeada: ${table}`);
    });

    const res = await createReservation(businessId, input);
    expect(res.id).toBe(reservationId);
    expect(res.customer_name).toBe("Familia Gómez");
    expect(res.party_size).toBe(4);
    expect(res.time).toBe("20:00");
    expect(res.room_name).toBe("Sala Principal");
    expect(res.status).toBe("confirmed");
  });

  it("3. La reserva aparece en la consulta para vista de calendario y lista", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "reservations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: reservationId,
                      business_id: businessId,
                      customer_name: "Familia Gómez",
                      phone: "+573001234567",
                      email: "gomez@example.com",
                      party_size: 4,
                      date: "2026-11-05",
                      time: "20:00:00",
                      room_id: salaPrincipalId,
                      table_id: null,
                      status: "confirmed",
                      origin: "phone",
                      special_requests: "Celebración de cumpleaños",
                      allergies: null,
                      notes: null,
                      min_spend: 0,
                      deposit_amount: 0,
                      created_at: "2026-11-01T12:00:00.000Z",
                      updated_at: "2026-11-01T12:00:00.000Z",
                      restaurant_rooms: { name: "Sala Principal" },
                      restaurant_tables: null,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Tabla no mockeada: ${table}`);
    });

    const list = await getReservations(businessId);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(reservationId);
    expect(list[0].date).toBe("2026-11-05");
    expect(list[0].time).toBe("20:00");
    expect(list[0].customer_name).toBe("Familia Gómez");
  });

  it("4. Permite asignar una mesa a la reserva", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "restaurant_tables") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { room_id: salaPrincipalId },
                }),
              }),
            }),
          }),
        };
      }
      if (table === "reservations") {
        return {
          update: vi.fn().mockImplementation((fields: any) => {
            expect(fields.table_id).toBe(mesa04Id);
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: reservationId,
                        business_id: businessId,
                        customer_name: "Familia Gómez",
                        party_size: 4,
                        date: "2026-11-05",
                        time: "20:00:00",
                        room_id: salaPrincipalId,
                        table_id: mesa04Id,
                        status: "confirmed",
                        origin: "phone",
                        created_at: "2026-11-01T12:00:00.000Z",
                        updated_at: "2026-11-01T12:30:00.000Z",
                        restaurant_rooms: { name: "Sala Principal" },
                        restaurant_tables: { name_or_number: "04", capacity: 4 },
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }),
        };
      }
      throw new Error(`Tabla no mockeada: ${table}`);
    });

    const assigned = await assignReservationTable(businessId, {
      reservationId,
      tableId: mesa04Id,
    });

    expect(assigned.table_id).toBe(mesa04Id);
    expect(assigned.table_name_or_number).toBe("04");
  });

  it("5. Al llegar el cliente, la reserva cambia a 'checked_in'", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "reservations") {
        return {
          update: vi.fn().mockImplementation((fields: any) => {
            expect(fields.status).toBe("checked_in");
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: reservationId,
                        business_id: businessId,
                        customer_name: "Familia Gómez",
                        party_size: 4,
                        date: "2026-11-05",
                        time: "20:00:00",
                        room_id: salaPrincipalId,
                        table_id: mesa04Id,
                        status: "checked_in",
                        origin: "phone",
                        created_at: "2026-11-01T12:00:00.000Z",
                        updated_at: "2026-11-05T19:55:00.000Z",
                        restaurant_rooms: { name: "Sala Principal" },
                        restaurant_tables: { name_or_number: "04", capacity: 4 },
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }),
        };
      }
      throw new Error(`Tabla no mockeada: ${table}`);
    });

    const checkedIn = await updateReservationStatus(
      businessId,
      reservationId,
      "checked_in"
    );

    expect(checkedIn.status).toBe("checked_in");
  });

  it("6. Calcula indicadores de reservas: Hoy, Próximos 7 Días, Walk-ins y Ocupación", async () => {
    const today = "2026-11-05";

    mockFrom.mockImplementation((table: string) => {
      if (table === "reservations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  neq: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "r1",
                        date: today,
                        status: "confirmed",
                        origin: "phone",
                        party_size: 4,
                        table_id: "t1",
                      },
                      {
                        id: "r2",
                        date: today,
                        status: "checked_in",
                        origin: "walk_in",
                        party_size: 2,
                        table_id: "t2",
                      },
                      {
                        id: "r3",
                        date: "2026-11-08",
                        status: "confirmed",
                        origin: "web",
                        party_size: 6,
                        table_id: null,
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "restaurant_tables") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "t1", capacity: 4 },
                { id: "t2", capacity: 2 },
                { id: "t3", capacity: 4 },
                { id: "t4", capacity: 6 },
              ],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`Tabla no mockeada: ${table}`);
    });

    const metrics = await getReservationMetrics(businessId, today);

    // 2 reservas hoy (r1 y r2)
    expect(metrics.todayCount).toBe(2);
    // 3 reservas en los próximos 7 días (r1, r2, r3)
    expect(metrics.next7DaysCount).toBe(3);
    // 1 walk-in hoy (r2)
    expect(metrics.walkInsCount).toBe(1);
    // 2 mesas reservadas (t1, t2) de 4 totales = 50%
    expect(metrics.occupancyRate).toBe(50);
    expect(metrics.totalGuestsToday).toBe(6);
    expect(metrics.confirmedTodayCount).toBe(1);
    expect(metrics.checkedInTodayCount).toBe(1);
  });

  it("7. Server Actions verifican permisos y ejecutan flujos de negocio", async () => {
    // getReservationsAction
    mockFrom.mockImplementation((table: string) => {
      if (table === "reservations") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Tabla no mockeada: ${table}`);
    });

    const res = await getReservationsAction(businessId);
    expect(res.success).toBe(true);

    // Permiso denegado
    mockVerifyWorkspaceAction.mockResolvedValueOnce({
      success: false,
      error: "Acceso no autorizado",
    });
    mockVerifyWorkspaceAction.mockResolvedValueOnce({
      success: false,
      error: "Acceso no autorizado",
    });

    const unauthorizedRes = await getReservationsAction(businessId);
    expect(unauthorizedRes.success).toBe(false);
    expect(unauthorizedRes.error?.toLowerCase()).toContain("no autorizado");
  });

  it("8. Regla de Oro: Prohibido uso de alertas nativas en módulo de reservas", () => {
    const reservasDir = path.resolve(
      process.cwd(),
      "src/app/workspace/[businessId]/reservas"
    );
    const libDir = path.resolve(process.cwd(), "src/lib/reservations");

    const scanFiles = (dir: string): string[] => {
      const results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat && stat.isDirectory()) {
          results.push(...scanFiles(full));
        } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
          results.push(full);
        }
      });
      return results;
    };

    const allFiles = [...scanFiles(reservasDir), ...scanFiles(libDir)];
    expect(allFiles.length).toBeGreaterThan(0);

    const alertRegex = /\b(window\.)?alert\(|\b(window\.)?confirm\(|\b(window\.)?prompt\(/;

    for (const filePath of allFiles) {
      const content = fs.readFileSync(filePath, "utf-8");
      const hasNativeAlert = alertRegex.test(content);
      if (hasNativeAlert) {
        throw new Error(`Alerta nativa encontrada en: ${filePath}`);
      }
      expect(hasNativeAlert).toBe(false);
    }
  });

  it("9. Valida que CreateReservationSchema rechaza comensales menores a 1 o nombres vacíos", () => {
    expect(() =>
      CreateReservationSchema.parse({
        customer_name: "",
        party_size: 0,
        date: "2026-11-05",
        time: "20:00",
      })
    ).toThrow();

    expect(() =>
      CreateReservationSchema.parse({
        customer_name: "Cliente Válido",
        party_size: -2,
        date: "2026-11-05",
        time: "20:00",
      })
    ).toThrow();
  });

  it("10. createReservationAction, updateReservationAction y deleteReservationAction funcionan con permisos", async () => {
    // Mock insert
    mockFrom.mockImplementation((table: string) => {
      if (table === "reservations") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: reservationId,
                  business_id: businessId,
                  customer_name: "Test Cliente",
                  party_size: 2,
                  date: "2026-11-05",
                  time: "21:00:00",
                  status: "confirmed",
                  origin: "direct",
                  created_at: "2026-11-01T12:00:00.000Z",
                  updated_at: "2026-11-01T12:00:00.000Z",
                },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: reservationId,
                      business_id: businessId,
                      customer_name: "Test Cliente Actualizado",
                      party_size: 3,
                      date: "2026-11-05",
                      time: "21:00:00",
                      status: "confirmed",
                      origin: "direct",
                      created_at: "2026-11-01T12:00:00.000Z",
                      updated_at: "2026-11-01T12:00:00.000Z",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      throw new Error(`Tabla no mockeada: ${table}`);
    });

    const createRes = await createReservationAction(businessId, {
      customer_name: "Test Cliente",
      party_size: 2,
      date: "2026-11-05",
      time: "21:00",
    });
    expect(createRes.success).toBe(true);
    expect(createRes.data?.customer_name).toBe("Test Cliente");

    const updateRes = await updateReservationAction(businessId, reservationId, {
      customer_name: "Test Cliente Actualizado",
      party_size: 3,
    });
    expect(updateRes.success).toBe(true);
    expect(updateRes.data?.customer_name).toBe("Test Cliente Actualizado");

    const deleteRes = await deleteReservationAction(businessId, reservationId);
    expect(deleteRes.success).toBe(true);
  });

  it("11. Renderiza estáticamente la interfaz de usuario de Reservas (Dashboard)", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { ReservationsDashboardClient } = await import(
      "@/app/workspace/[businessId]/reservas/reservations-dashboard-client"
    );

    const mockReservations = [
      {
        id: reservationId,
        business_id: businessId,
        customer_name: "Familia Gómez",
        phone: "+573001234567",
        email: "gomez@example.com",
        party_size: 4,
        date: "2026-11-05",
        time: "20:00",
        room_id: salaPrincipalId,
        room_name: "Sala Principal",
        table_id: mesa04Id,
        table_name_or_number: "04",
        table_capacity: 4,
        status: "confirmed" as const,
        origin: "phone" as const,
        special_requests: "Cumpleaños",
        allergies: null,
        notes: null,
        min_spend: 0,
        deposit_amount: 0,
        created_at: "2026-11-01T12:00:00.000Z",
        updated_at: "2026-11-01T12:00:00.000Z",
      },
    ];

    const mockMetrics = {
      todayCount: 5,
      next7DaysCount: 12,
      walkInsCount: 2,
      occupancyRate: 60,
      totalGuestsToday: 18,
      confirmedTodayCount: 3,
      checkedInTodayCount: 2,
      seatedTodayCount: 0,
    };

    const mockRooms = [
      {
        id: salaPrincipalId,
        business_id: businessId,
        name: "Sala Principal",
        description: "Salón central",
        status: "active" as const,
        sort_order: 1,
        created_at: "2026-11-01T00:00:00.000Z",
        updated_at: "2026-11-01T00:00:00.000Z",
      },
    ];

    const mockTables = [
      {
        id: mesa04Id,
        business_id: businessId,
        room_id: salaPrincipalId,
        name_or_number: "04",
        capacity: 4,
        status: "available" as const,
        created_at: "2026-11-01T00:00:00.000Z",
        updated_at: "2026-11-01T00:00:00.000Z",
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(ReservationsDashboardClient, {
        businessId,
        initialReservations: mockReservations,
        initialMetrics: mockMetrics,
        initialRooms: mockRooms,
        initialTables: mockTables,
      })
    );

    expect(html).toContain("Sistema de Reservas");
    expect(html).toContain("Gestiona reservas, walk-ins y ocupación del restaurante.");
    expect(html).toContain("Vista Calendario");
    expect(html).toContain("Lista Reservas");
    expect(html).toContain("Asignar Mesas");
    expect(html).toContain("+ Nueva Reserva");
    expect(html).toContain("Reservas Hoy");
    expect(html).toContain("Próximos 7 Días");
    expect(html).toContain("Walk-ins Hoy");
    expect(html).toContain("Ocupación");
    expect(html).toContain("60%");
  });
});
