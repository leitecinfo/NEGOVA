import { defineConfig, devices } from "@playwright/test";

/**
 * Configuración oficial de Playwright E2E para NEGOVA [TEST-001]
 * Cumple con:
 * - Ejecución consecutiva y ordenada de los 7 flujos operativos
 * - Límite de tiempo total < 10 minutos
 * - Variables de entorno parametrizables (TEST_BASE_URL, etc.)
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
