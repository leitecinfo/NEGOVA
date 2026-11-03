import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  getLocalDateString,
  getEmployeeReportData,
} from "@/lib/reports/reports-service";
import { generateEmployeeReportPdf } from "@/lib/reports/employee-report-pdf";
import { generateEmployeeReportCsv } from "@/lib/reports/employee-report-csv";
import { EmployeeReportFilterParams, EmployeeReportData } from "@/lib/reports/types";

// Mock de Supabase para pruebas unitarias deterministas
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

describe("[REP-003] Reporte de Empleados con Ranking, Turnos y Exportación PDF/Excel", () => {
  const businessId = "biz-emp-rep-003";
  const timezone = "America/Bogota";

  const now = new Date();
  const todayStr = getLocalDateString(now, timezone);
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getLocalDateString(yesterdayDate, timezone);

  // Mocks de Base de Datos
  const mockBusinessUsers = [
    {
      id: "bu-1",
      user_id: "user-1",
      business_id: businessId,
      role_id: "role-cajero",
      status: "active",
      joined_at: "2026-01-01T00:00:00Z",
      roles: { id: "role-cajero", code: "cajero", name: "Cajero Principal" },
    },
    {
      id: "bu-2",
      user_id: "user-2",
      business_id: businessId,
      role_id: "role-mesero",
      status: "active",
      joined_at: "2026-02-01T00:00:00Z",
      roles: { id: "role-mesero", code: "mesero", name: "Mesero de Salón" },
    },
    {
      id: "bu-3",
      user_id: "user-3",
      business_id: businessId,
      role_id: "role-auxiliar",
      status: "active",
      joined_at: "2026-03-01T00:00:00Z",
      roles: { id: "role-auxiliar", code: "auxiliar", name: "Auxiliar Operativo" },
    },
    {
      id: "bu-inactive",
      user_id: "user-inactive",
      business_id: businessId,
      role_id: "role-mesero",
      status: "inactive", // Inactivo: NO debe listarse como activo
      joined_at: "2025-01-01T00:00:00Z",
      roles: { id: "role-mesero", code: "mesero", name: "Mesero de Salón" },
    },
  ];

  const mockProfiles = [
    { id: "user-1", full_name: "Carlos Cajero", email: "carlos@negova.test", avatar_url: null },
    { id: "user-2", full_name: "María Mesera", email: "maria@negova.test", avatar_url: null },
    { id: "user-3", full_name: "Andrés Auxiliar", email: "andres@negova.test", avatar_url: null },
    { id: "user-inactive", full_name: "Pedro Inactivo", email: "pedro@negova.test", avatar_url: null },
  ];

  const mockRoles = [
    { id: "role-cajero", code: "cajero", name: "Cajero Principal" },
    { id: "role-mesero", code: "mesero", name: "Mesero de Salón" },
    { id: "role-auxiliar", code: "auxiliar", name: "Auxiliar Operativo" },
  ];

  const mockLocations = [
    { id: "loc-central", name: "Sede Central", type: "point_of_sale", is_active: true },
    { id: "loc-norte", name: "Sede Norte", type: "point_of_sale", is_active: true },
  ];

  const mockRegisters = [
    { id: "reg-1", business_id: businessId, name: "Caja 1 Central", location_id: "loc-central", is_active: true },
    { id: "reg-2", business_id: businessId, name: "Caja 2 Norte", location_id: "loc-norte", is_active: true },
  ];

  // Sesiones de caja: Carlos tiene 2 turnos (4 hrs y 5 hrs), María 0 turnos
  const mockSessions = [
    {
      id: "sess-1",
      business_id: businessId,
      register_id: "reg-1",
      opened_by: "user-1",
      opened_at: `${todayStr}T08:00:00Z`,
      closed_by: "user-1",
      closed_at: `${todayStr}T12:00:00Z`, // 4 horas
      status: "closed",
    },
    {
      id: "sess-2",
      business_id: businessId,
      register_id: "reg-1",
      opened_by: "user-1",
      opened_at: `${todayStr}T14:00:00Z`,
      closed_by: "user-1",
      closed_at: `${todayStr}T19:00:00Z`, // 5 horas
      status: "closed",
    },
  ];

  // Documentos de venta:
  // Carlos: 2 ventas hoy ($100.000 y $50.000 = $150.000)
  // María: 1 venta hoy ($200.000) -> Top 1 en ventas
  // Andrés: 0 ventas hoy ($0)
  // 1 venta anulada de Carlos ($40.000) -> no se cuenta
  const mockSaleDocs = [
    {
      id: "doc-1",
      business_id: businessId,
      document_number: "POS-001",
      total: 100000,
      subtotal: 84034,
      status: "completed",
      issued_at: `${todayStr}T10:00:00Z`,
      created_by: "user-1",
    },
    {
      id: "doc-2",
      business_id: businessId,
      document_number: "POS-002",
      total: 50000,
      subtotal: 42017,
      status: "completed",
      issued_at: `${todayStr}T11:30:00Z`,
      created_by: "user-1",
    },
    {
      id: "doc-3",
      business_id: businessId,
      document_number: "POS-003",
      total: 200000,
      subtotal: 168067,
      status: "completed",
      issued_at: `${todayStr}T13:00:00Z`,
      created_by: "user-2",
    },
    {
      id: "doc-cancelled",
      business_id: businessId,
      document_number: "POS-004-CANC",
      total: 40000,
      subtotal: 33613,
      status: "cancelled", // No debe sumarse
      issued_at: `${todayStr}T14:00:00Z`,
      created_by: "user-1",
    },
  ];

  // Comandas para propinas:
  // María recibió $20.000 de propina
  const mockOrders = [
    {
      id: "ord-1",
      business_id: businessId,
      created_by: "user-2",
      tip_amount: 20000,
      notes: "Atención mesa 5. Propina: +$20.000 (10%)",
      status: "delivered",
      created_at: `${todayStr}T13:00:00Z`,
      total: 200000,
    },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    const mockSupabase = {
      from: vi.fn((tableName: string) => {
        let currentData: any[] = [];
        if (tableName === "business_users") currentData = [...mockBusinessUsers];
        else if (tableName === "profiles") currentData = [...mockProfiles];
        else if (tableName === "roles") currentData = [...mockRoles];
        else if (tableName === "locations") currentData = [...mockLocations];
        else if (tableName === "cash_registers") currentData = [...mockRegisters];
        else if (tableName === "cash_sessions") currentData = [...mockSessions];
        else if (tableName === "business_sale_documents") currentData = [...mockSaleDocs];
        else if (tableName === "restaurant_orders") currentData = [...mockOrders];
        else if (tableName === "businesses") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: businessId, name: "Restaurante Don Negova", commercial_name: "Don Negova Gourmet" },
              error: null,
            }),
          };
        }

        const queryObj: any = {
          select: vi.fn().mockImplementation(() => queryObj),
          eq: vi.fn().mockImplementation((col: string, val: any) => {
            currentData = currentData.filter((r) => r[col] === val);
            return queryObj;
          }),
          neq: vi.fn().mockImplementation((col: string, val: any) => {
            currentData = currentData.filter((r) => r[col] !== val);
            return queryObj;
          }),
          then: (resolve: any) => Promise.resolve({ data: currentData, error: null }).then(resolve),
        };

        return queryObj;
      }),
    };

    const { createClient } = await import("@/lib/supabase/server");
    (createClient as any).mockResolvedValue(mockSupabase);

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    (createAdminClient as any).mockReturnValue(mockSupabase);
  });

  // ==========================================
  // CRITERIO 1: Se listan todos los empleados activos del negocio
  // ==========================================
  it("Criterio 1: Se listan todos los empleados activos del negocio (incluso si tienen 0 ventas)", async () => {
    const report = await getEmployeeReportData(businessId, { preset: "today" }, timezone);

    expect(report.employees).toBeDefined();
    // Deben listarse los 3 empleados activos (Carlos, María, Andrés)
    expect(report.employees.length).toBe(3);

    const names = report.employees.map((e) => e.name);
    expect(names).toContain("Carlos Cajero");
    expect(names).toContain("María Mesera");
    expect(names).toContain("Andrés Auxiliar");

    // El empleado inactivo NO debe listarse
    expect(names).not.toContain("Pedro Inactivo");

    // Andrés no tiene ventas pero debe estar listado con $0 y 0 transacciones
    const andres = report.employees.find((e) => e.name === "Andrés Auxiliar")!;
    expect(andres).toBeDefined();
    expect(andres.salesCount).toBe(0);
    expect(andres.totalSalesAmount).toBe(0);
    expect(andres.averageTicketAmount).toBe(0);
  });

  // ==========================================
  // CRITERIO 2: Las ventas por empleado coinciden con la suma de business_sale_documents donde created_by = empleado
  // ==========================================
  it("Criterio 2: Las ventas por empleado coinciden exactamente con la suma de business_sale_documents donde created_by = empleado", async () => {
    const report = await getEmployeeReportData(businessId, { preset: "today" }, timezone);

    // Carlos: doc-1 ($100.000) + doc-2 ($50.000) = $150.000. Doc cancelado ($40.000) excluido.
    const carlos = report.employees.find((e) => e.userId === "user-1")!;
    expect(carlos.salesCount).toBe(2);
    expect(carlos.totalSalesAmount).toBe(150000);
    expect(carlos.averageTicketAmount).toBe(75000); // 150.000 / 2

    // María: doc-3 ($200.000)
    const maria = report.employees.find((e) => e.userId === "user-2")!;
    expect(maria.salesCount).toBe(1);
    expect(maria.totalSalesAmount).toBe(200000);
    expect(maria.averageTicketAmount).toBe(200000);

    // Verificación de suma total del equipo en el resumen
    expect(report.summary.totalTeamSalesAmount).toBe(350000);
    expect(report.summary.totalTeamSalesCount).toBe(3);
    expect(report.summary.averageTeamTicketAmount).toBe(Number((350000 / 3).toFixed(2)));
  });

  // ==========================================
  // CRITERIO 3: El ranking ordena de mayor a menor por monto vendido
  // ==========================================
  it("Criterio 3: El ranking ordena estrictamente de mayor a menor por monto vendido", async () => {
    const report = await getEmployeeReportData(businessId, { preset: "today" }, timezone);

    // Orden esperado:
    // 1. María ($200.000) -> Rank 1
    // 2. Carlos ($150.000) -> Rank 2
    // 3. Andrés ($0) -> Rank 3
    expect(report.employees[0].name).toBe("María Mesera");
    expect(report.employees[0].rank).toBe(1);
    expect(report.employees[0].totalSalesAmount).toBe(200000);

    expect(report.employees[1].name).toBe("Carlos Cajero");
    expect(report.employees[1].rank).toBe(2);
    expect(report.employees[1].totalSalesAmount).toBe(150000);

    expect(report.employees[2].name).toBe("Andrés Auxiliar");
    expect(report.employees[2].rank).toBe(3);
    expect(report.employees[2].totalSalesAmount).toBe(0);

    // Top Performer en el resumen coincide con el primer lugar
    expect(report.summary.topPerformerName).toBe("María Mesera");
    expect(report.summary.topPerformerSalesAmount).toBe(200000);
  });

  // ==========================================
  // TURNOS, HORAS Y PROPINAS
  // ==========================================
  it("Métricas operativas: turnos trabajados, horas y propinas se acumulan correctamente", async () => {
    const report = await getEmployeeReportData(businessId, { preset: "today" }, timezone);

    // Carlos tiene 2 turnos cerrados: 4 horas + 5 horas = 9 horas
    const carlos = report.employees.find((e) => e.userId === "user-1")!;
    expect(carlos.shiftsCount).toBe(2);
    expect(carlos.totalHoursWorked).toBe(9);

    // María tiene 0 turnos pero recibió $20.000 de propinas
    const maria = report.employees.find((e) => e.userId === "user-2")!;
    expect(maria.shiftsCount).toBe(0);
    expect(maria.totalHoursWorked).toBe(0);
    expect(maria.totalTipsAmount).toBe(20000);

    // Resumen consolidado del equipo
    expect(report.summary.totalShiftsWorked).toBe(2);
    expect(report.summary.totalHoursWorked).toBe(9);
    expect(report.summary.totalTipsAmount).toBe(20000);
  });

  // ==========================================
  // FILTRO POR ROL
  // ==========================================
  it("Filtros: filtrar por rol devuelve únicamente los colaboradores con ese rol", async () => {
    const reportMesero = await getEmployeeReportData(
      businessId,
      { preset: "today", roleCode: "mesero" },
      timezone
    );

    expect(reportMesero.employees.length).toBe(1);
    expect(reportMesero.employees[0].name).toBe("María Mesera");
    expect(reportMesero.employees[0].roleCode).toBe("mesero");
  });

  // ==========================================
  // CRITERIO 4: El PDF incluye período y resumen de totales
  // ==========================================
  it("Criterio 4: Generación de PDF formal con período, resumen de totales y tabla de colaboradores", () => {
    const mockReportData: EmployeeReportData = {
      employees: [
        {
          id: "bu-1",
          userId: "user-1",
          name: "María Mesera",
          email: "maria@negova.test",
          roleId: "r-1",
          roleCode: "mesero",
          roleName: "Mesero de Salón",
          avatarUrl: null,
          status: "active",
          salesCount: 5,
          totalSalesAmount: 500000,
          averageTicketAmount: 100000,
          shiftsCount: 1,
          totalHoursWorked: 8,
          totalTipsAmount: 50000,
          locations: ["Sede Central"],
          rank: 1,
          salesPercentage: 66.7,
        },
        {
          id: "bu-2",
          userId: "user-2",
          name: "Carlos Cajero",
          email: "carlos@negova.test",
          roleId: "r-2",
          roleCode: "cajero",
          roleName: "Cajero Principal",
          avatarUrl: null,
          status: "active",
          salesCount: 3,
          totalSalesAmount: 250000,
          averageTicketAmount: 83333.33,
          shiftsCount: 2,
          totalHoursWorked: 12,
          totalTipsAmount: 0,
          locations: ["Sede Central"],
          rank: 2,
          salesPercentage: 33.3,
        },
      ],
      summary: {
        totalEmployees: 2,
        activeEmployeesCount: 2,
        totalTeamSalesAmount: 750000,
        totalTeamSalesCount: 8,
        averageTeamTicketAmount: 93750,
        totalShiftsWorked: 3,
        totalHoursWorked: 20,
        totalTipsAmount: 50000,
        topPerformerName: "María Mesera",
        topPerformerSalesAmount: 500000,
      },
      dateRange: {
        preset: "this_month",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
      },
      filterParams: { preset: "this_month" },
      availableRoles: [
        { code: "all", name: "Todos los roles" },
        { code: "mesero", name: "Mesero de Salón" },
      ],
      availableLocations: [{ id: "all", name: "Todas las ubicaciones" }],
      businessName: "Don Negova Gourmet",
    };

    const pdfResult = generateEmployeeReportPdf({
      businessName: "Don Negova Gourmet",
      businessNit: "900.888.777-1",
      businessAddress: "Calle 100 # 15-20",
      businessPhone: "+57 310 999 8888",
      reportData: mockReportData,
    });

    expect(pdfResult).toBeDefined();
    expect(pdfResult.buffer).toBeInstanceOf(Buffer);
    expect(pdfResult.buffer.length).toBeGreaterThan(1000); // PDF con contenido binario real
    expect(pdfResult.filename).toContain("reporte_empleados_");
    expect(pdfResult.contentType).toBe("application/pdf");
  });

  // ==========================================
  // EXPORTACIÓN EXCEL (CSV CON BOM)
  // ==========================================
  it("Exportación Excel: genera CSV con UTF-8 BOM, encabezados en español y fila de totales", () => {
    const mockReportData: EmployeeReportData = {
      employees: [
        {
          id: "bu-1",
          userId: "user-1",
          name: "María Mesera",
          email: "maria@negova.test",
          roleId: "r-1",
          roleCode: "mesero",
          roleName: "Mesero de Salón",
          avatarUrl: null,
          status: "active",
          salesCount: 5,
          totalSalesAmount: 500000,
          averageTicketAmount: 100000,
          shiftsCount: 1,
          totalHoursWorked: 8,
          totalTipsAmount: 50000,
          locations: ["Sede Central"],
          rank: 1,
          salesPercentage: 100,
        },
      ],
      summary: {
        totalEmployees: 1,
        activeEmployeesCount: 1,
        totalTeamSalesAmount: 500000,
        totalTeamSalesCount: 5,
        averageTeamTicketAmount: 100000,
        totalShiftsWorked: 1,
        totalHoursWorked: 8,
        totalTipsAmount: 50000,
        topPerformerName: "María Mesera",
        topPerformerSalesAmount: 500000,
      },
      dateRange: { preset: "today" },
      filterParams: { preset: "today" },
      availableRoles: [{ code: "all", name: "Todos" }],
      availableLocations: [{ id: "all", name: "Todas" }],
      businessName: "Don Negova Gourmet",
    };

    const csvResult = generateEmployeeReportCsv(mockReportData);

    expect(csvResult).toBeDefined();
    expect(csvResult.content.startsWith("\uFEFF")).toBe(true); // UTF-8 BOM para Excel
    expect(csvResult.content).toContain("Puesto Ranking");
    expect(csvResult.content).toContain("Colaborador");
    expect(csvResult.content).toContain("Total Vendido (COP)");
    expect(csvResult.content).toContain("Turnos de Caja");
    expect(csvResult.content).toContain("Propinas Recibidas (COP)");
    expect(csvResult.content).toContain("María Mesera");
    expect(csvResult.content).toContain("500000.00");
    expect(csvResult.content).toContain("TOTALES DEL EQUIPO");
  });

  // ==========================================
  // REGLA GLOBAL: Cero Alertas Nativas
  // ==========================================
  it("Regla Global: Prohibido el uso de alertas nativas (window.alert, window.confirm, window.prompt)", () => {
    const clientFilePath = path.join(
      process.cwd(),
      "src/app/workspace/[businessId]/reportes/empleados/employee-report-client.tsx"
    );
    expect(fs.existsSync(clientFilePath)).toBe(true);

    const clientContent = fs.readFileSync(clientFilePath, "utf8");

    expect(clientContent).not.toMatch(/\bwindow\.alert\b/);
    expect(clientContent).not.toMatch(/\bwindow\.confirm\b/);
    expect(clientContent).not.toMatch(/\bwindow\.prompt\b/);
    expect(clientContent).not.toMatch(/\bAlert\.alert\b/);
  });
});