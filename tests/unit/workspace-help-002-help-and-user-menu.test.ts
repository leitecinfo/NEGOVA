import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("[HELP-002] Componentes de Ayuda y Menú de Usuario", () => {
  const helpDir = path.resolve(__dirname, "../../src/components/help");
  const layoutDir = path.resolve(__dirname, "../../src/components/layout");
  const posPath = path.resolve(__dirname, "../../src/components/pos/pos-screen-client.tsx");
  const shellPath = path.resolve(__dirname, "../../src/components/workspace/workspace-shell.tsx");

  describe("1. Botón: Ver Video (module-video-button.tsx)", () => {
    it("debe existir con contorno de cápsula alargada (pill), destello y texto", () => {
      const filePath = path.join(helpDir, "module-video-button.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("export function ModuleVideoButton");
      expect(content).toContain("rounded-full");
      expect(content).toContain("Sparkles");
      expect(content).toContain("Ver video");
      expect(content).not.toContain("window.alert");
    });
  });

  describe("2. Modal: Videos del Módulo (module-videos-modal.tsx)", () => {
    it("debe existir con encabezado de Ventas y POS, conteo de 8 videos y lista vertical", () => {
      const filePath = path.join(helpDir, "module-videos-modal.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("export function ModuleVideosModal");
      expect(content).toContain("Ventas y POS");
      expect(content).toContain("videos disponibles para este módulo");
      expect(content).toContain("ShoppingCart");
      expect(content).toContain("Play");
      expect(content).toContain("ExternalLink");

      // Verificación de los 8 títulos de tutoriales especificados
      expect(content).toContain("Primera venta en el sistema POS");
      expect(content).toContain("Cómo realizar la primera venta");
      expect(content).toContain("Cómo vender con remisión y cerrar");
      expect(content).toContain("Cómo hacer una venta por remisión abierta");
      expect(content).toContain("Cómo realizar una venta de domicilio desde el mostrador");
      expect(content).toContain("Crear primer producto con modificadores y carrito");
      expect(content).toContain("Proceso de compra de productos con y sin modificadores");
      expect(content).toContain("Cómo aplicar descuentos y promociones en una venta");

      expect(content).not.toContain("window.alert");
    });
  });

  describe("3. Panel Lateral: Centro de Ayuda (help-center-drawer.tsx)", () => {
    it("debe existir con acordeón de los 16 módulos del sistema y recursos de pie", () => {
      const filePath = path.join(helpDir, "help-center-drawer.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("export function HelpCenterDrawer");
      expect(content).toContain("Centro de Ayuda");
      expect(content).toContain("Tutoriales en video organizados por módulo del sistema");

      // Verificación de los 16 módulos con sus nombres exactos
      expect(content).toContain("Configuración del sistema");
      expect(content).toContain("Ventas y POS");
      expect(content).toContain("Historial de Ventas");
      expect(content).toContain("Cierres de Caja");
      expect(content).toContain("Productos");
      expect(content).toContain("Recetas e Ingredientes");
      expect(content).toContain("Inventario y Ubicaciones");
      expect(content).toContain("Compras y Proveedores");
      expect(content).toContain("Domicilios");
      expect(content).toContain("Mesas y Restaurante");
      expect(content).toContain("Menú QR");
      expect(content).toContain("Facturación Electrónica");
      expect(content).toContain("Clientes");
      expect(content).toContain("Empleados y Permisos");
      expect(content).toContain("Notificaciones WhatsApp");
      expect(content).toContain("Reportes y Analítica");

      // Verificación de botones de pie
      expect(content).toContain("Documentación");
      expect(content).toContain("Soporte / FAQ");
      expect(content).toContain("BookOpen");
      expect(content).toContain("HelpCircle");

      expect(content).not.toContain("window.alert");
    });
  });

  describe("4. Menú Desplegable: Perfil de Usuario (user-profile-dropdown.tsx)", () => {
    it("debe contener el encabezado con avatar, JJCOMIDA, correo, rol ADMINISTRADOR y las 6 opciones", () => {
      const filePath = path.join(layoutDir, "user-profile-dropdown.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("export function UserProfileDropdown");
      expect(content).toContain("JJCOMIDA");
      expect(content).toContain("xigenap350@playfine.com");
      expect(content).toContain("ADMINISTRADOR");

      // Las 6 opciones de navegación
      expect(content).toContain("Perfil");
      expect(content).toContain("Tu información personal");

      expect(content).toContain("Configuración");
      expect(content).toContain("Ajustes del negocio");

      expect(content).toContain("Apps");
      expect(content).toContain("Integraciones y herramientas");

      expect(content).toContain("Documentación");
      expect(content).toContain("Guías y ayuda");

      expect(content).toContain("Nuestros Links");
      expect(content).toContain("Links del negocio");

      expect(content).toContain("Suscripción");
      expect(content).toContain("Ver plan activo");

      // Pie con Cerrar Sesión
      expect(content).toContain("Cerrar sesión");
      expect(content).toContain("AdminLogoutModal");

      expect(content).not.toContain("window.alert");
    });
  });

  describe("5. Integración en la Cabecera (Header) y POS Limpio", () => {
    it("debe conectar Ver Video en workspace-shell.tsx y no duplicar usuario/ayuda en pos-screen-client.tsx", () => {
      const shellContent = fs.readFileSync(shellPath, "utf-8");
      const posContent = fs.readFileSync(posPath, "utf-8");

      // Ver video en el header
      expect(shellContent).toContain("ModuleVideoButton");
      expect(shellContent).toContain("ModuleVideosModal");
      expect(shellContent).toContain("isModuleVideosModalOpen");

      // En el POS no debe estar duplicado el perfil de usuario ni el drawer redundante
      expect(posContent).not.toContain("UserProfileDropdown");
    });
  });
});
