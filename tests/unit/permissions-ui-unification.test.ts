import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { UserPermissionsMatrixEditor } from "../../src/components/permissions/user-permissions-matrix-editor";
import { UserEffectivePermissionsDetail } from "../../src/lib/auth/user-permissions-service";

describe("NEGOVA — Unificación Visual de Permisos (UserPermissionsMatrixEditor)", () => {
  const mockPermissionsData: UserEffectivePermissionsDetail = {
    userId: "usr-auxiliar-01",
    roleCode: "auxiliar",
    businessId: "biz-test-01",
    businessType: "retail",
    effectivePermissions: ["sales.view", "sales.create", "expenses.view"],
    inheritedPermissions: ["sales.view", "sales.create"],
    customGrantedPermissions: ["expenses.view"],
    customRevokedPermissions: [],
    moduleBreakdown: [
      {
        moduleId: "sales",
        moduleName: "Ventas y Facturación",
        description: "Operaciones de venta directa",
        permissions: [
          {
            code: "sales.view",
            name: "Consultar Ventas",
            description: "Permite listar y ver ventas",
            isAssignable: true,
            isEffective: true,
            isInherited: true,
            isCustomGranted: false,
            isCustomRevoked: false,
            status: "inherited",
          },
          {
            code: "sales.delete",
            name: "Anular o Eliminar Ventas",
            description: "Permite eliminar facturas emitidas",
            isAssignable: false,
            isEffective: false,
            isInherited: false,
            isCustomGranted: false,
            isCustomRevoked: false,
            status: "restricted",
          },
        ],
      },
      {
        moduleId: "expenses",
        moduleName: "Gastos y Egresos",
        description: "Control de egresos",
        permissions: [
          {
            code: "expenses.view",
            name: "Ver Gastos",
            description: "Permite consultar gastos registrados",
            isAssignable: true,
            isEffective: true,
            isInherited: false,
            isCustomGranted: true,
            isCustomRevoked: false,
            status: "custom_granted",
          },
        ],
      },
    ],
  };

  it("1. Renderiza el encabezado unificado con 'Matriz de Permisos Efectivos' y badge del rol", () => {
    const html = renderToString(
      React.createElement(UserPermissionsMatrixEditor, {
        permissionsData: mockPermissionsData,
        userName: "Juan Auxiliar",
        userRoleName: "Auxiliar",
        isOwnerOrSuperAdmin: false,
        isCurrentUser: false,
        canEdit: true,
        onSave: vi.fn(),
      })
    );

    expect(html).toContain("Matriz de Permisos Efectivos");
    expect(html).toContain("Rol: auxiliar");
    expect(html).toContain("Permisos calculados con excepciones individuales en el comercio.");
  });

  it("2. Renderiza las 4 tarjetas KPI con los contadores numéricos exactos", () => {
    const html = renderToString(
      React.createElement(UserPermissionsMatrixEditor, {
        permissionsData: mockPermissionsData,
        userName: "Juan Auxiliar",
        userRoleName: "Auxiliar",
        isOwnerOrSuperAdmin: false,
        isCurrentUser: false,
        canEdit: true,
        onSave: vi.fn(),
      })
    );

    expect(html).toContain("Total Efectivos");
    expect(html).toContain("Heredados por Rol");
    expect(html).toContain("Excepciones Concedidas");
    expect(html).toContain("Excepciones Revocadas");

    // Total efectivos = 3 (sales.view, sales.create, expenses.view)
    expect(html).toContain("3");
    // Heredados = 2
    expect(html).toContain("2");
    // Excepciones concedidas = +1 (expenses.view)
    expect(html).toContain("+1");
    // Excepciones revocadas = -0
    expect(html).toContain("-0");
  });

  it("3. Renderiza las etiquetas de procedencia '+ Concedido', 'Heredado' y 'Solo Dueño'", () => {
    const html = renderToString(
      React.createElement(UserPermissionsMatrixEditor, {
        permissionsData: mockPermissionsData,
        userName: "Juan Auxiliar",
        userRoleName: "Auxiliar",
        isOwnerOrSuperAdmin: false,
        isCurrentUser: false,
        canEdit: true,
        onSave: vi.fn(),
      })
    );

    expect(html).toContain("+ Concedido");
    expect(html).toContain("Heredado");
    expect(html).toContain("Solo Dueño");
  });

  it("4. Renderiza los botones de acción 'Restablecer al Rol' y 'Guardar Permisos' cuando canEdit es true", () => {
    const html = renderToString(
      React.createElement(UserPermissionsMatrixEditor, {
        permissionsData: mockPermissionsData,
        userName: "Juan Auxiliar",
        userRoleName: "Auxiliar",
        isOwnerOrSuperAdmin: false,
        isCurrentUser: false,
        canEdit: true,
        onSave: vi.fn(),
      })
    );

    expect(html).toContain("Restablecer al Rol");
    expect(html).toContain("Guardar Permisos");
  });

  it("5. Muestra banner informativo de 'Rol con facultades completas' cuando el rol destino es Owner", () => {
    const html = renderToString(
      React.createElement(UserPermissionsMatrixEditor, {
        permissionsData: mockPermissionsData,
        userName: "Alexander Smith",
        userRoleName: "Dueño de Negocio",
        isOwnerOrSuperAdmin: true,
        isCurrentUser: false,
        canEdit: false,
        onSave: vi.fn(),
      })
    );

    expect(html).toContain("Rol con facultades completas");
    expect(html).toContain("no admite restricciones individuales");
  });

  it("6. Muestra banner de 'Cuenta personal en sesión' cuando se edita a uno mismo", () => {
    const html = renderToString(
      React.createElement(UserPermissionsMatrixEditor, {
        permissionsData: mockPermissionsData,
        userName: "Yo Mismo",
        userRoleName: "Auxiliar",
        isOwnerOrSuperAdmin: false,
        isCurrentUser: true,
        canEdit: false,
        onSave: vi.fn(),
      })
    );

    expect(html).toContain("Cuenta personal en sesión");
    expect(html).toContain("no puedes alterar tus propios permisos de usuario");
  });
});
