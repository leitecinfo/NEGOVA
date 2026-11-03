import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

describe("[DS-001] Unificación del Sistema de Diseño (src/components/ui)", () => {
  const rootDir = process.cwd();

  // ==========================================
  // Criterio 1: Ningún archivo en Workspace importa desde Admin
  // ==========================================
  it("Criterio 1: Todos los módulos en src/app/workspace/ usan exclusivamente @/components/ui", () => {
    const workspaceAppDir = path.join(rootDir, "src/app/workspace");
    const workspaceFiles = getAllFiles(workspaceAppDir);

    expect(workspaceFiles.length).toBeGreaterThan(0);

    const violatingFiles: string[] = [];

    for (const filePath of workspaceFiles) {
      const content = fs.readFileSync(filePath, "utf8");
      // Buscar importaciones directas de components/admin
      if (/from\s+["'][^"']*components\/admin[^"']*["']/.test(content)) {
        violatingFiles.push(path.relative(rootDir, filePath));
      }
    }

    expect(violatingFiles).toEqual([]);
  });

  it("Criterio 1: Todos los componentes en src/components/workspace/ usan exclusivamente @/components/ui", () => {
    const workspaceCompDir = path.join(rootDir, "src/components/workspace");
    const compFiles = getAllFiles(workspaceCompDir);

    expect(compFiles.length).toBeGreaterThan(0);

    const violatingFiles: string[] = [];

    for (const filePath of compFiles) {
      const content = fs.readFileSync(filePath, "utf8");
      if (/from\s+["'][^"']*components\/admin[^"']*["']/.test(content)) {
        violatingFiles.push(path.relative(rootDir, filePath));
      }
    }

    expect(violatingFiles).toEqual([]);
  });

  // ==========================================
  // Criterio 2: Cobertura completa de componentes en src/components/ui/index.ts
  // ==========================================
  it("Criterio 2: src/components/ui/index.ts centraliza y exporta todos los componentes canónicos", async () => {
    const indexPath = path.join(rootDir, "src/components/ui/index.ts");
    expect(fs.existsSync(indexPath)).toBe(true);

    const uiModule = await import("@/components/ui");

    const requiredNamedExports = [
      "Button",
      "Input",
      "SearchInput",
      "Select",
      "SearchSelect",
      "KpiCard",
      "KpiGrid",
      "Tabs",
      "DataTable",
      "Pagination",
      "TableToolbar",
      "Badge",
      "StatusBadge",
      "EmptyState",
      "LoadingSkeleton",
      "ErrorState",
      "ConfirmDialog",
      "ConfirmModal",
      "CustomModal",
      "ModalPortal",
      "UserAvatar",
      "LogoutModal",
    ];

    for (const exp of requiredNamedExports) {
      expect((uiModule as any)[exp]).toBeDefined();
    }
  });

  // ==========================================
  // Criterio 3: ConfirmDialog y LogoutModal unificados en UI
  // ==========================================
  it("Criterio 3: ConfirmDialog y LogoutModal residen en src/components/ui con accesibilidad adecuada", () => {
    const confirmDialogPath = path.join(rootDir, "src/components/ui/confirm-dialog.tsx");
    const logoutModalPath = path.join(rootDir, "src/components/ui/logout-modal.tsx");

    expect(fs.existsSync(confirmDialogPath)).toBe(true);
    expect(fs.existsSync(logoutModalPath)).toBe(true);

    const confirmContent = fs.readFileSync(confirmDialogPath, "utf8");
    const logoutContent = fs.readFileSync(logoutModalPath, "utf8");

    // ModalPortal para montaje limpio en el body
    expect(confirmContent).toContain("ModalPortal");
    expect(logoutContent).toContain("ModalPortal");

    // Roles accesibles
    expect(confirmContent).toContain('role="dialog"');
    expect(logoutContent).toContain('role="alertdialog"');
  });

  // ==========================================
  // Criterio 4: Retrocompatibilidad del puente Admin UI
  // ==========================================
  it("Criterio 4: src/components/admin/ui mantiene puentes hacia src/components/ui sin romper el panel de administración", () => {
    const adminBridgeDir = path.join(rootDir, "src/components/admin/ui");
    expect(fs.existsSync(adminBridgeDir)).toBe(true);

    const bridgeFiles = [
      "admin-button.tsx",
      "admin-confirm-dialog.tsx",
      "admin-data-table.tsx",
      "admin-empty-state.tsx",
      "admin-error-state.tsx",
      "admin-input.tsx",
      "admin-kpi-card.tsx",
      "admin-loading-state.tsx",
      "admin-pagination.tsx",
      "admin-search-input.tsx",
      "admin-search-select.tsx",
      "admin-select.tsx",
      "admin-status-badge.tsx",
      "admin-table-toolbar.tsx",
      "admin-tabs.tsx",
    ];

    for (const bridgeFile of bridgeFiles) {
      const fullPath = path.join(adminBridgeDir, bridgeFile);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, "utf8");
      // Debe reexportar desde @/components/ui
      expect(content).toMatch(/from\s+["']@\/components\/ui/);
    }
  });

  // ==========================================
  // REGLA GLOBAL: Cero Alertas Nativas en todo src/components/ui/
  // ==========================================
  it("Regla Global: Prohibido el uso de alertas nativas (window.alert, window.confirm, window.prompt, Alert.alert)", () => {
    const uiFiles = getAllFiles(path.join(rootDir, "src/components/ui"));

    const prohibitedPatterns = [
      /\bwindow\.alert\s*\(/,
      /\balert\s*\(/,
      /\bwindow\.confirm\s*\(/,
      /\bconfirm\s*\(/,
      /\bwindow\.prompt\s*\(/,
      /\bprompt\s*\(/,
      /\bAlert\.alert\s*\(/,
    ];

    for (const filePath of uiFiles) {
      const content = fs.readFileSync(filePath, "utf8");
      for (const pattern of prohibitedPatterns) {
        expect(pattern.test(content)).toBe(false);
      }
    }
  });
});
