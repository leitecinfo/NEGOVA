/**
 * Seed Data and Test Fixtures for NEGOVA E2E Testing Suite [TEST-001]
 * Provides isolated mock datasets, credentials, and network interception utilities
 * to ensure deterministic, fast (<10s each, <10m total) execution with zero side-effects.
 */

import { Page, Route } from "@playwright/test";

export interface E2EEnvironmentConfig {
  baseUrl: string;
  businessId: string;
  businessName: string;
  userEmail: string;
  userName: string;
  userRole: string;
}

export const DEFAULT_E2E_CONFIG: E2EEnvironmentConfig = {
  baseUrl: process.env.TEST_BASE_URL || "http://localhost:3000",
  businessId: process.env.TEST_BUSINESS_ID || "e2e-biz-0001-aaaa-bbbb",
  businessName: "Restaurante Gourmet NEGOVA E2E",
  userEmail: process.env.TEST_USER_EMAIL || "cajero.e2e@negova-test.com",
  userName: "Cajero Principal E2E",
  userRole: "admin",
};

/**
 * Generador de datos únicos por ejecución para garantizar aislamiento de pruebas
 */
export function generateTestRunId(prefix: string = "run"): string {
  const timestamp = Date.now().toString(36);
  const randomSalt = Math.random().toString(36).substring(2, 6);
  return `${prefix}-${timestamp}-${randomSalt}`;
}

/**
 * Mock data fixtures para los 7 flujos de prueba
 */
export function createMockE2EData(runId: string = generateTestRunId()) {
  const businessId = `biz-${runId}`;

  return {
    runId,
    business: {
      id: businessId,
      name: `Restaurante E2E ${runId}`,
      slug: `restaurante-${runId}`,
      currency: "COP",
      status: "active",
    },
    user: {
      id: `usr-${runId}`,
      email: `user.${runId}@negova-test.com`,
      fullName: `Usuario Tester ${runId}`,
      role: "admin",
      pin: "1234",
    },
    products: [
      {
        id: `prod-burger-${runId}`,
        business_id: businessId,
        name: "Hamburguesa Gourmet Doble",
        price: 28000,
        cost: 14000,
        current_stock: 40,
        track_inventory: true,
        category: "Hamburguesas",
        modifiers: [
          {
            id: `mod-term-${runId}`,
            name: "Término de la carne",
            required: true,
            min: 1,
            max: 1,
            options: [
              { id: "opt-1", name: "Término Medio", price: 0 },
              { id: "opt-2", name: "3/4", price: 0 },
              { id: "opt-3", name: "Bien Asada", price: 0 },
            ],
          },
          {
            id: `mod-extras-${runId}`,
            name: "Adiciones",
            required: false,
            min: 0,
            max: 3,
            options: [
              { id: "opt-cheese", name: "Queso Cheddar Fundido", price: 3500 },
              { id: "opt-bacon", name: "Tocineta Ahumada", price: 4000 },
            ],
          },
        ],
      },
      {
        id: `prod-beer-${runId}`,
        business_id: businessId,
        name: "Cerveza Artesanal IPA",
        price: 12000,
        cost: 5000,
        current_stock: 60,
        track_inventory: true,
        category: "Bebidas",
      },
      {
        id: `prod-dessert-${runId}`,
        business_id: businessId,
        name: "Volcán de Chocolate",
        price: 15000,
        cost: 6500,
        current_stock: 25,
        track_inventory: true,
        category: "Postres",
      },
    ],
    tables: [
      {
        id: `tbl-01-${runId}`,
        business_id: businessId,
        number: "Mesa 01",
        capacity: 4,
        status: "available", // available | occupied | billing
        current_order_id: null,
      },
      {
        id: `tbl-02-${runId}`,
        business_id: businessId,
        number: "Mesa 02",
        capacity: 2,
        status: "available",
        current_order_id: null,
      },
    ],
    customers: [
      {
        id: `cust-cred-${runId}`,
        business_id: businessId,
        full_name: "Carlos Mendoza Corporativo",
        phone: "+573001234567",
        email: `carlos.${runId}@empresa.com`,
        document_number: "1098765432",
        credit_limit: 300000,
        credit_used: 0,
        credit_available: 300000,
        has_credit: true,
      },
    ],
    suppliers: [
      {
        id: `supp-01-${runId}`,
        business_id: businessId,
        name: "Distribuidora Mayorista Central S.A.S",
        nit: "900.876.543-1",
        contact_name: "Mariana Rojas",
        phone: "+573109876543",
        email: `pedidos.${runId}@distribuidora.com`,
      },
    ],
    cashShift: {
      id: `shift-${runId}`,
      business_id: businessId,
      user_id: `usr-${runId}`,
      opened_at: new Date().toISOString(),
      initial_amount: 150000, // $150.000 COP base inicial
      status: "open",
    },
  };
}

/**
 * Inyecta estado de sesión autenticado y configuración base en la página
 */
export async function setupAuthenticatedContext(
  page: Page,
  config: E2EEnvironmentConfig = DEFAULT_E2E_CONFIG
) {
  // Simulación de cookies y headers de autenticación
  await page.context().addCookies([
    {
      name: "sb-access-token",
      value: "mock-e2e-jwt-access-token",
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "negova-business-id",
      value: config.businessId,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

/**
 * Interceptor genérico de rutas para emular respuestas de servidor de forma instantánea
 */
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  responseBody: any,
  status: number = 200
) {
  await page.route(urlPattern, async (route: Route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(responseBody),
    });
  });
}
