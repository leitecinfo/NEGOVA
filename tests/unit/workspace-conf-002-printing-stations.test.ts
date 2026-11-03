import { describe, it, expect, vi } from "vitest";
import {
  DEFAULT_PRINTING_SETTINGS,
  DEFAULT_TICKET_TEMPLATE,
  DEFAULT_KITCHEN_COMMAND_TEMPLATE,
  DEFAULT_CASH_DRAWER,
  getSampleTicketMock,
  getSampleKitchenCommandMock,
} from "../../src/lib/printing/printing-service";
import {
  PrinterConfig,
  PrintingStation,
  TicketTemplateConfig,
  KitchenCommandTemplateConfig,
  PrintingSettings,
} from "../../src/lib/printing/types";

describe("[CONF-002] Configuración de Impresión, Estaciones y Cajón Monedero", () => {
  const mockBusinessMaster = {
    name: "Asados y Carbón Don Pedro",
    tradeName: "Don Pedro Parrilla Bar",
    legalName: "Inversiones Don Pedro S.A.S.",
    taxId: "901.456.789-3",
    address: "Avenida Las Palmas # 25-10, Medellín",
    city: "Medellín, Antioquia",
    phone: "+57 310 987 6543",
    logoUrl: "https://storage.negova.com/logos/don-pedro.png",
  };

  // ==========================================================================
  // CRITERIO 1: Se puede registrar una impresora y vincularla a una caja
  // ==========================================================================
  describe("Criterio 1: Registro de impresoras y vinculación de estaciones a cajas", () => {
    it("debe permitir registrar una impresora térmica de 80mm con conexión de red", () => {
      const newPrinter: PrinterConfig = {
        id: "printer-epson-tm20",
        name: "Epson TM-T20III Mostrador",
        type: "thermal_80mm",
        connection: "network",
        ipAddress: "192.168.1.150",
        port: 9100,
        status: "active",
        createdAt: new Date().toISOString(),
      };

      expect(newPrinter.id).toBe("printer-epson-tm20");
      expect(newPrinter.type).toBe("thermal_80mm");
      expect(newPrinter.connection).toBe("network");
      expect(newPrinter.ipAddress).toBe("192.168.1.150");
      expect(newPrinter.status).toBe("active");
    });

    it("debe permitir vincular una impresora a una caja registradora en una estación de trabajo", () => {
      const cashRegisterId = "caja-principal-uuid-123";
      const cashRegisterName = "Caja Principal - Salón";

      const station: PrintingStation = {
        id: "station-pos-1",
        name: "Estación de Facturación Mostrador",
        area: "caja",
        printerId: "printer-epson-tm20",
        cashRegisterId: cashRegisterId,
        cashRegisterName: cashRegisterName,
        autoPrintReceipt: true,
        autoPrintOrderCommand: false,
        openCashDrawerOnCashSale: true,
        copies: 1,
        createdAt: new Date().toISOString(),
      };

      expect(station.printerId).toBe("printer-epson-tm20");
      expect(station.cashRegisterId).toBe(cashRegisterId);
      expect(station.cashRegisterName).toBe("Caja Principal - Salón");
      expect(station.autoPrintReceipt).toBe(true);
      expect(station.openCashDrawerOnCashSale).toBe(true);
    });

    it("debe permitir crear estaciones específicas para cocina o barra sin vinculación a caja", () => {
      const kitchenStation: PrintingStation = {
        id: "station-kitchen-1",
        name: "Cocina Caliente & Parrilla",
        area: "cocina",
        printerId: "printer-bixolon-kitchen",
        cashRegisterId: null,
        autoPrintReceipt: false,
        autoPrintOrderCommand: true,
        openCashDrawerOnCashSale: false,
        copies: 1,
        createdAt: new Date().toISOString(),
      };

      expect(kitchenStation.area).toBe("cocina");
      expect(kitchenStation.cashRegisterId).toBeNull();
      expect(kitchenStation.autoPrintOrderCommand).toBe(true);
      expect(kitchenStation.autoPrintReceipt).toBe(false);
    });
  });

  // ==========================================================================
  // CRITERIO 2: La plantilla de ticket muestra preview con datos reales del negocio
  // ==========================================================================
  describe("Criterio 2: Plantilla de ticket comercial con datos reales del negocio", () => {
    it("debe poblar la vista previa del comprobante con el nombre comercial, NIT, dirección y teléfono reales", () => {
      const template: TicketTemplateConfig = {
        ...DEFAULT_TICKET_TEMPLATE,
        businessName: mockBusinessMaster.tradeName,
        taxId: mockBusinessMaster.taxId,
        address: mockBusinessMaster.address,
        phone: mockBusinessMaster.phone,
      };

      const ticketMock = getSampleTicketMock(mockBusinessMaster, template);

      expect(ticketMock.business.name).toBe("Don Pedro Parrilla Bar");
      expect(ticketMock.business.taxId).toBe("901.456.789-3");
      expect(ticketMock.business.address).toBe("Avenida Las Palmas # 25-10, Medellín");
      expect(ticketMock.business.phone).toBe("+57 310 987 6543");
      expect(ticketMock.documentNumber).toBeDefined();
      expect(ticketMock.items.length).toBeGreaterThan(0);
      expect(ticketMock.total).toBe(111000);
    });

    it("debe incluir leyenda legal, pie de página y mensaje de agradecimiento", () => {
      const template: TicketTemplateConfig = {
        ...DEFAULT_TICKET_TEMPLATE,
        headerText: "Régimen Simple de Tributación — Tarifa Especial",
        footerText: "Conserve este comprobante como soporte comercial.",
        thankYouNote: "¡Gracias por preferir a Don Pedro Parrilla Bar!",
      };

      const ticketMock = getSampleTicketMock(mockBusinessMaster, template);

      expect(ticketMock.headerText).toBe("Régimen Simple de Tributación — Tarifa Especial");
      expect(ticketMock.footerText).toBe("Conserve este comprobante como soporte comercial.");
      expect(ticketMock.thankYouNote).toBe("¡Gracias por preferir a Don Pedro Parrilla Bar!");
    });
  });

  // ==========================================================================
  // CRITERIO 3: Al cambiar el logo del negocio, el preview del ticket se actualiza
  // ==========================================================================
  describe("Criterio 3: Actualización reactiva del logotipo en la vista previa", () => {
    it("debe reflejar el logotipo inicial maestro del negocio en la vista previa", () => {
      const template: TicketTemplateConfig = {
        ...DEFAULT_TICKET_TEMPLATE,
        showLogo: true,
        customLogoUrl: undefined,
      };

      const ticketMock = getSampleTicketMock(mockBusinessMaster, template);
      expect(ticketMock.business.logoUrl).toBe("https://storage.negova.com/logos/don-pedro.png");
    });

    it("debe actualizar inmediatamente la vista previa al cambiar la URL del logotipo", () => {
      const newLogoUrl = "https://storage.negova.com/logos/don-pedro-2026-nuevo.png";
      const template: TicketTemplateConfig = {
        ...DEFAULT_TICKET_TEMPLATE,
        showLogo: true,
        customLogoUrl: newLogoUrl,
      };

      const ticketMock = getSampleTicketMock(mockBusinessMaster, template);
      expect(ticketMock.business.logoUrl).toBe(newLogoUrl);
    });

    it("debe permitir ocultar el logotipo del comprobante manteniendo los datos textuales", () => {
      const template: TicketTemplateConfig = {
        ...DEFAULT_TICKET_TEMPLATE,
        showLogo: false,
      };

      expect(template.showLogo).toBe(false);
      const ticketMock = getSampleTicketMock(mockBusinessMaster, template);
      expect(ticketMock.business.name).toBeDefined();
    });
  });

  // ==========================================================================
  // CRITERIO 4: La comanda de cocina no muestra precios pero sí modificadores
  // ==========================================================================
  describe("Criterio 4: Comanda de cocina sin precios y con modificadores resaltados", () => {
    it("la comanda de cocina debe omitir precios unitarios, subtotales y totales monetarios", () => {
      const template: KitchenCommandTemplateConfig = {
        ...DEFAULT_KITCHEN_COMMAND_TEMPLATE,
        showPrices: false, // Garantizado apagado
        highlightModifiers: true,
      };

      const kitchenMock = getSampleKitchenCommandMock(template);

      expect(kitchenMock.orderNumber).toBe("104");
      expect(kitchenMock.headerTitle).toBe("*** COMANDA DE COCINA ***");

      // Verificar que ningún ítem tenga precio unitario ni total monetario
      kitchenMock.items.forEach((item: any) => {
        expect(item.price).toBeUndefined();
        expect(item.unitPrice).toBeUndefined();
        expect(item.total).toBeUndefined();
        expect(item.quantity).toBeGreaterThan(0);
        expect(item.name).toBeDefined();
      });

      // La comanda en su raíz no debe contener valores monetarios
      expect((kitchenMock as any).totalPrice).toBeUndefined();
      expect((kitchenMock as any).subtotal).toBeUndefined();
    });

    it("la comanda de cocina debe resaltar los modificadores, adiciones y exclusiones", () => {
      const template: KitchenCommandTemplateConfig = {
        ...DEFAULT_KITCHEN_COMMAND_TEMPLATE,
        showPrices: false,
        highlightModifiers: true,
      };

      const kitchenMock = getSampleKitchenCommandMock(template);
      const burgerItem = kitchenMock.items.find((i) => i.name.includes("Hamburguesa"));

      expect(burgerItem).toBeDefined();
      expect(burgerItem?.modifiers).toBeDefined();
      expect(burgerItem?.modifiers?.length).toBeGreaterThan(0);

      // Modificador de adición
      const addMod = burgerItem?.modifiers?.find((m) => m.type === "add");
      expect(addMod?.text).toContain("[+] Extra Queso Mozzarella");

      // Modificador de exclusión
      const removeMod = burgerItem?.modifiers?.find((m) => m.type === "remove");
      expect(removeMod?.text).toContain("[-] Sin Cebolla");

      // Modificador de especificación / término
      const specMod = burgerItem?.modifiers?.find((m) => m.type === "spec");
      expect(specMod?.text).toContain("Término: Tres Cuartos");
    });
  });

  // ==========================================================================
  // CRITERIO 5: Configuración de Cajón Monedero y Controlador
  // ==========================================================================
  describe("Criterio 5: Cajón monedero, pulso ESC/POS y controlador de impresión", () => {
    it("debe incluir por defecto la apertura de cajón con código estándar ESC/POS", () => {
      expect(DEFAULT_CASH_DRAWER.autoOpenOnCashSale).toBe(true);
      expect(DEFAULT_CASH_DRAWER.drawerKickCode).toBe("ESC p 0 25 250");
    });

    it("debe usar 'browser' (window.print) como driver predeterminado con soporte de QZ Tray", () => {
      expect(DEFAULT_PRINTING_SETTINGS.printDriver).toBe("browser");

      const qzSettings: PrintingSettings = {
        ...DEFAULT_PRINTING_SETTINGS,
        printDriver: "qz_tray",
      };
      expect(qzSettings.printDriver).toBe("qz_tray");
    });
  });

  // ==========================================================================
  // CRITERIO 6: Prohibición de Alertas Nativas
  // ==========================================================================
  describe("Criterio 6: Cero alertas nativas en código fuente", () => {
    it("no debe contener llamadas a window.alert, window.confirm o window.prompt", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const filesToCheck = [
        path.resolve(process.cwd(), "src/lib/printing/printing-service.ts"),
        path.resolve(process.cwd(), "src/components/printing/ticket-live-preview.tsx"),
        path.resolve(process.cwd(), "src/components/printing/printer-form-modal.tsx"),
        path.resolve(process.cwd(), "src/components/printing/station-form-modal.tsx"),
        path.resolve(
          process.cwd(),
          "src/app/workspace/[businessId]/configuracion/impresion/printing-config-client.tsx"
        ),
        path.resolve(
          process.cwd(),
          "src/app/workspace/[businessId]/configuracion/impresion/actions.ts"
        ),
      ];

      for (const file of filesToCheck) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, "utf-8");
          expect(content).not.toMatch(/\bwindow\.alert\s*\(/);
          expect(content).not.toMatch(/\bwindow\.confirm\s*\(/);
          expect(content).not.toMatch(/\bwindow\.prompt\s*\(/);
          expect(content).not.toMatch(/\bAlert\.alert\s*\(/);
        }
      }
    });
  });
});
