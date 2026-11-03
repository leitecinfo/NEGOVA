import { describe, it, expect, beforeEach } from "vitest";
import {
  createEmployee,
  getEmployeesList,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
} from "@/lib/payroll/payroll-service";

describe("Personal de Servicio & Camareros [STAFF-002]", () => {
  const businessA = "biz_restaurant_001";
  const businessB = "biz_restaurant_002";
  const actorUser = "usr_manager_001";

  it("1. Debe registrar un camarero con código interno (#css1) y datos de contacto", async () => {
    const res = await createEmployee(
      {
        firstName: "Carlos",
        lastName: "Suárez",
        documentType: "CC",
        documentNumber: "#css1",
        phone: "+57 300 987 6543",
        email: "carlos.camarero@negocio.com",
        jobTitle: "Camarero",
        contractType: "indefinido",
        status: "active",
        compensationType: "fixed_salary",
        baseSalary: 0,
        payFrequency: "monthly",
        paymentMethod: "cash",
        notes: "[CODE:#css1]",
        hireDate: "2026-11-02",
      },
      actorUser,
      { businessId: businessA }
    );

    expect(res.success).toBe(true);
    expect(res.employee).toBeDefined();
    expect(res.employee?.firstName).toBe("Carlos");
    expect(res.employee?.documentNumber).toBe("#css1");
    expect(res.employee?.notes).toContain("[CODE:#css1]");
    expect(res.employee?.status).toBe("active");
  });

  it("2. Debe filtrar colaboradores por negocio y estado activo/inactivo", async () => {
    // Crear uno activo y uno inactivo en Business A
    const emp1 = await createEmployee(
      {
        firstName: "María",
        lastName: "López",
        documentType: "CC",
        documentNumber: "#CAM002",
        jobTitle: "Camarera",
        contractType: "indefinido",
        status: "active",
        compensationType: "fixed_salary",
        baseSalary: 0,
        payFrequency: "monthly",
        paymentMethod: "cash",
        hireDate: "2026-11-02",
      },
      actorUser,
      { businessId: businessA }
    );

    const emp2 = await createEmployee(
      {
        firstName: "Pedro",
        lastName: "Gómez",
        documentType: "CC",
        documentNumber: "#CAM003",
        jobTitle: "Camarero",
        contractType: "indefinido",
        status: "inactive",
        compensationType: "fixed_salary",
        baseSalary: 0,
        payFrequency: "monthly",
        paymentMethod: "cash",
        hireDate: "2026-11-02",
      },
      actorUser,
      { businessId: businessA }
    );

    expect(emp1.success).toBe(true);
    expect(emp2.success).toBe(true);

    const listAll = await getEmployeesList({ businessId: businessA });
    expect(listAll.employees.length).toBeGreaterThanOrEqual(2);

    const listActive = await getEmployeesList({ businessId: businessA }, { status: "active" });
    expect(listActive.employees.every((e) => e.status === "active")).toBe(true);

    const listInactive = await getEmployeesList({ businessId: businessA }, { status: "inactive" });
    expect(listInactive.employees.every((e) => e.status === "inactive")).toBe(true);
  });

  it("3. Debe alternar el estado del colaborador (toggle activo/inactivo)", async () => {
    const created = await createEmployee(
      {
        firstName: "Laura",
        lastName: "Mejía",
        documentType: "CC",
        documentNumber: "#CAM004",
        jobTitle: "Camarera",
        contractType: "indefinido",
        status: "active",
        compensationType: "fixed_salary",
        baseSalary: 0,
        payFrequency: "monthly",
        paymentMethod: "cash",
        hireDate: "2026-11-02",
      },
      actorUser,
      { businessId: businessA }
    );

    const empId = created.employee!.id;

    // Desactivar
    const updateRes = await updateEmployee(empId, { status: "inactive" }, actorUser, { businessId: businessA });
    expect(updateRes.success).toBe(true);
    expect(updateRes.employee?.status).toBe("inactive");

    // Reactivar
    const reactivateRes = await updateEmployee(empId, { status: "active" }, actorUser, { businessId: businessA });
    expect(reactivateRes.success).toBe(true);
    expect(reactivateRes.employee?.status).toBe("active");
  });

  it("4. Debe eliminar colaborador con deleteEmployee asegurando aislamiento de negocio", async () => {
    const created = await createEmployee(
      {
        firstName: "Javier",
        lastName: "Torres",
        documentType: "CC",
        documentNumber: "#CAM005",
        jobTitle: "Camarero",
        contractType: "indefinido",
        status: "active",
        compensationType: "fixed_salary",
        baseSalary: 0,
        payFrequency: "monthly",
        paymentMethod: "cash",
        hireDate: "2026-11-02",
      },
      actorUser,
      { businessId: businessA }
    );

    const empId = created.employee!.id;

    // Intento de eliminación desde otro negocio debe fallar
    const deleteOtherBiz = await deleteEmployee(empId, actorUser, { businessId: businessB });
    expect(deleteOtherBiz.success).toBe(false);

    // Eliminación legítima
    const deleteRes = await deleteEmployee(empId, actorUser, { businessId: businessA });
    expect(deleteRes.success).toBe(true);

    const check = await getEmployeeById(empId, { businessId: businessA });
    expect(check).toBeNull();
  });
});
