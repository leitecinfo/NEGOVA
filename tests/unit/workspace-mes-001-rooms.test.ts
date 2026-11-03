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
  createServerSupabaseClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

import {
  createRestaurantRoom,
  getRestaurantRoomsWithTables,
  createRestaurantTable,
  updateRestaurantTable,
  getRestaurantTablesWithOrders,
} from "@/lib/restaurant/restaurant-service";

describe("[MES-001] Salas de Restaurante y Agrupación de Mesas", () => {
  const businessId = "11111111-1111-4111-8111-111111111111";
  const roomTerrazaId = "22222222-2222-4222-8222-222222222222";
  const roomInteriorId = "33333333-3333-4333-8333-333333333333";
  const locationId = "44444444-4444-4444-8444-444444444444";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Permite crear la sala 'Terraza' y otra 'Interior' con ubicación y descripción", async () => {
    let createdCount = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === "restaurant_rooms") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockImplementation((payload: any) => ({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockImplementation(async () => {
                createdCount += 1;
                return {
                  data: {
                    id: createdCount === 1 ? roomTerrazaId : roomInteriorId,
                    business_id: payload.business_id,
                    name: payload.name,
                    description: payload.description,
                    location_id: payload.location_id,
                    status: payload.status,
                    sort_order: payload.sort_order,
                    created_at: "2026-10-30T10:00:00.000Z",
                    updated_at: "2026-10-30T10:00:00.000Z",
                  },
                  error: null,
                };
              }),
            }),
          })),
        };
      }
      throw new Error(`Tabla inesperada: ${table}`);
    });

    const terrazaRes = await createRestaurantRoom(businessId, {
      name: "Terraza",
      description: "Zona exterior al aire libre",
      location_id: locationId,
      status: "active",
      sort_order: 1,
    });

    const interiorRes = await createRestaurantRoom(businessId, {
      name: "Interior",
      description: "Salón climatizado principal",
      location_id: locationId,
      status: "active",
      sort_order: 2,
    });

    expect(terrazaRes.success).toBe(true);
    expect(terrazaRes.room?.id).toBe(roomTerrazaId);
    expect(terrazaRes.room?.name).toBe("Terraza");
    expect(terrazaRes.room?.location_id).toBe(locationId);

    expect(interiorRes.success).toBe(true);
    expect(interiorRes.room?.id).toBe(roomInteriorId);
    expect(interiorRes.room?.name).toBe("Interior");
    expect(interiorRes.room?.description).toBe("Salón climatizado principal");
  });

  it("2. Rechaza crear una sala duplicada con el mismo nombre en el mismo negocio", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "restaurant_rooms") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: roomTerrazaId },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Tabla inesperada: ${table}`);
    });

    const dupRes = await createRestaurantRoom(businessId, {
      name: "Terraza",
      description: "Duplicada",
      status: "active",
      sort_order: 1,
    });

    expect(dupRes.success).toBe(false);
    expect(dupRes.error).toMatch(/Ya existe una sala con el nombre «Terraza»/i);
  });

  it("3. Permite asignar una mesa a una sala al crearla o actualizarla", async () => {
    const insertedPayloads: any[] = [];
    const updatedPayloads: any[] = [];
    const tableId = "55555555-5555-4555-8555-555555555555";

    mockFrom.mockImplementation((table: string) => {
      if (table === "restaurant_tables") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: tableId,
                    business_id: businessId,
                    name_or_number: "Mesa T1",
                    room_id: roomTerrazaId,
                    capacity: 4,
                    sort_order: 1,
                    status: "available",
                  },
                  error: null,
                }),
              }),
            }),
          }),
          insert: vi.fn().mockImplementation((payload: any) => {
            insertedPayloads.push(payload);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: tableId,
                    business_id: businessId,
                    room_id: payload.room_id,
                    name_or_number: payload.name_or_number,
                    capacity: payload.capacity,
                    status: "available",
                    is_active: true,
                    sort_order: payload.sort_order,
                    created_at: "2026-10-30T10:00:00.000Z",
                    updated_at: "2026-10-30T10:00:00.000Z",
                  },
                  error: null,
                }),
              }),
            };
          }),
          update: vi.fn().mockImplementation((payload: any) => {
            updatedPayloads.push(payload);
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        id: tableId,
                        business_id: businessId,
                        room_id: payload.room_id,
                        name_or_number: "Mesa T1",
                        capacity: 4,
                        status: "available",
                        is_active: true,
                        sort_order: 1,
                        created_at: "2026-10-30T10:00:00.000Z",
                        updated_at: "2026-10-30T10:05:00.000Z",
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
      throw new Error(`Tabla inesperada: ${table}`);
    });

    // Crear mesa asignada a Terraza
    const createdRes = await createRestaurantTable(businessId, {
      name_or_number: "Mesa T1",
      capacity: 4,
      sort_order: 1,
      room_id: roomTerrazaId,
    });

    expect(createdRes.success).toBe(true);
    expect(createdRes.table?.room_id).toBe(roomTerrazaId);
    expect(insertedPayloads[0].room_id).toBe(roomTerrazaId);

    // Reasignar mesa a Interior
    const updatedRes = await updateRestaurantTable(businessId, tableId, {
      room_id: roomInteriorId,
    });

    expect(updatedRes.success).toBe(true);
    expect(updatedRes.table?.room_id).toBe(roomInteriorId);
    expect(updatedPayloads[0].room_id).toBe(roomInteriorId);
  });

  it("4. Agrupa las mesas por sala calculando estados visuales (libres y ocupadas) y enriquece roomName", async () => {
    const roomsMock = [
      {
        id: roomTerrazaId,
        business_id: businessId,
        location_id: locationId,
        name: "Terraza",
        description: "Exterior",
        status: "active",
        sort_order: 1,
        created_at: "2026-10-30T10:00:00.000Z",
        updated_at: "2026-10-30T10:00:00.000Z",
      },
      {
        id: roomInteriorId,
        business_id: businessId,
        location_id: locationId,
        name: "Interior",
        description: "Salón principal",
        status: "active",
        sort_order: 2,
        created_at: "2026-10-30T10:00:00.000Z",
        updated_at: "2026-10-30T10:00:00.000Z",
      },
    ];

    const tablesMock = [
      {
        id: "t1",
        business_id: businessId,
        room_id: roomTerrazaId,
        name_or_number: "Terraza 1",
        capacity: 4,
        status: "available",
        current_order_id: null,
        sort_order: 1,
      },
      {
        id: "t2",
        business_id: businessId,
        room_id: roomTerrazaId,
        name_or_number: "Terraza 2",
        capacity: 2,
        status: "occupied",
        current_order_id: "ord-1",
        sort_order: 2,
      },
      {
        id: "t3",
        business_id: businessId,
        room_id: roomInteriorId,
        name_or_number: "Interior 1",
        capacity: 6,
        status: "available",
        current_order_id: null,
        sort_order: 3,
      },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === "restaurant_rooms") {
        const chain: any = {
          eq: vi.fn(() => chain),
          neq: vi.fn(() => chain),
          order: vi.fn(() => chain),
          then: (resolve: any) => resolve({ data: roomsMock, error: null }),
        };
        return {
          select: vi.fn(() => chain),
        };
      }
      if (table === "restaurant_tables") {
        const chain: any = {
          eq: vi.fn(() => chain),
          neq: vi.fn(() => chain),
          order: vi.fn(() => chain),
          then: (resolve: any) => resolve({ data: tablesMock, error: null }),
        };
        return {
          select: vi.fn(() => chain),
        };
      }
      if (table === "restaurant_orders") {
        const chain: any = {
          eq: vi.fn(() => chain),
          in: vi.fn(() => chain),
          then: (resolve: any) =>
            resolve({
              data: [
                {
                  id: "ord-1",
                  order_number: 105,
                  customer_name: "Cliente Terraza",
                  status: "preparing",
                  payment_status: "pending",
                  total: 48000,
                  created_at: "2026-10-30T10:15:00.000Z",
                  restaurant_order_items: [{ quantity: 2 }],
                },
              ],
              error: null,
            }),
        };
        return {
          select: vi.fn(() => chain),
        };
      }
      throw new Error(`Tabla inesperada: ${table}`);
    });

    const roomsWithStats = await getRestaurantRoomsWithTables(businessId);
    expect(roomsWithStats).toHaveLength(2);

    const terrazaStats = roomsWithStats.find((r) => r.name === "Terraza")!;
    expect(terrazaStats.tablesCount).toBe(2);
    expect(terrazaStats.availableTablesCount).toBe(1);
    expect(terrazaStats.occupiedTablesCount).toBe(1);

    const interiorStats = roomsWithStats.find((r) => r.name === "Interior")!;
    expect(interiorStats.tablesCount).toBe(1);
    expect(interiorStats.availableTablesCount).toBe(1);
    expect(interiorStats.occupiedTablesCount).toBe(0);

    const tablesWithOrders = await getRestaurantTablesWithOrders(businessId);
    expect(tablesWithOrders.find((t) => t.id === "t1")?.roomName).toBe("Terraza");
    expect(tablesWithOrders.find((t) => t.id === "t2")?.roomName).toBe("Terraza");
    expect(tablesWithOrders.find((t) => t.id === "t2")?.status).toBe("occupied");
    expect(tablesWithOrders.find((t) => t.id === "t2")?.activeOrder?.order_number).toBe(105);
    expect(tablesWithOrders.find((t) => t.id === "t3")?.roomName).toBe("Interior");
  });

  it("5. Cumple prohibición estricta de alertas nativas en componentes y servicios de salas/mesas", () => {
    const filesToCheck = [
      "src/components/mesas/create-room-modal.tsx",
      "src/app/workspace/[businessId]/mesas/tables-dashboard-client.tsx",
      "src/app/workspace/[businessId]/mesas/actions.ts",
      "src/lib/restaurant/restaurant-service.ts",
    ];

    const forbiddenPatterns = [
      /\bwindow\.alert\s*\(/,
      /\bwindow\.confirm\s*\(/,
      /\bwindow\.prompt\s*\(/,
      /\bAlert\.alert\s*\(/,
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const pattern of forbiddenPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });
});
