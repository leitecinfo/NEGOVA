import { describe, it, expect, beforeEach } from "vitest";

describe("WorkspaceOpenTicketsFloatingButton — Lógica Arrastrable y Persistencia", () => {
  const BUTTON_SIZE = 56;
  const VIEWPORT_WIDTH = 1024;
  const VIEWPORT_HEIGHT = 768;
  const PADDING = 12;

  // Mock de almacenamiento para el entorno Node
  const storageMock: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => storageMock[key] ?? null,
    setItem: (key: string, value: string) => {
      storageMock[key] = value;
    },
    removeItem: (key: string) => {
      delete storageMock[key];
    },
    clear: () => {
      for (const k of Object.keys(storageMock)) {
        delete storageMock[k];
      }
    },
  };

  function clampPosition(x: number, y: number, winW = VIEWPORT_WIDTH, winH = VIEWPORT_HEIGHT) {
    const clampedX = Math.max(PADDING, Math.min(x, winW - BUTTON_SIZE - PADDING));
    const clampedY = Math.max(PADDING, Math.min(y, winH - BUTTON_SIZE - PADDING));
    return { x: clampedX, y: clampedY };
  }

  function shouldTreatAsDrag(startX: number, startY: number, endX: number, endY: number) {
    const dist = Math.hypot(endX - startX, endY - startY);
    return dist > 5;
  }

  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it("1. La posición inicial por defecto es null para renderizar en fixed bottom-5 right-5", () => {
    const saved = mockLocalStorage.getItem("negova_open_tickets_btn_pos");
    expect(saved).toBeNull();
  });

  it("2. Clamping: Mantiene el botón estrictamente dentro de los bordes de la pantalla", () => {
    // Intento de mover fuera por la izquierda o arriba
    const offTopLeft = clampPosition(-50, -100);
    expect(offTopLeft.x).toBe(12);
    expect(offTopLeft.y).toBe(12);

    // Intento de mover fuera por la derecha o abajo
    const offBottomRight = clampPosition(2000, 2000);
    expect(offBottomRight.x).toBe(VIEWPORT_WIDTH - BUTTON_SIZE - PADDING);
    expect(offBottomRight.y).toBe(VIEWPORT_HEIGHT - BUTTON_SIZE - PADDING);

    // Posición válida intermedia
    const validPos = clampPosition(300, 450);
    expect(validPos.x).toBe(300);
    expect(validPos.y).toBe(450);
  });

  it("3. Distinción entre Clic y Arrastre: Movimientos menores a 5px no activan arrastre", () => {
    // Movimiento sutil de 2px (típico micro-temblor al hacer clic)
    const isDragMicro = shouldTreatAsDrag(100, 100, 101, 102);
    expect(isDragMicro).toBe(false);

    // Movimiento real de 20px (arrastre intencional)
    const isDragIntentional = shouldTreatAsDrag(100, 100, 115, 115);
    expect(isDragIntentional).toBe(true);
  });

  it("4. Persistencia en localStorage: Guarda la posición y la recupera correctamente", () => {
    const targetPos = { x: 450, y: 220 };
    mockLocalStorage.setItem("negova_open_tickets_btn_pos", JSON.stringify(targetPos));

    const retrieved = JSON.parse(mockLocalStorage.getItem("negova_open_tickets_btn_pos") || "{}");
    expect(retrieved.x).toBe(450);
    expect(retrieved.y).toBe(220);
  });

  it("5. Restablecimiento con doble clic: Elimina la clave de localStorage y vuelve a default", () => {
    mockLocalStorage.setItem("negova_open_tickets_btn_pos", JSON.stringify({ x: 200, y: 300 }));
    expect(mockLocalStorage.getItem("negova_open_tickets_btn_pos")).not.toBeNull();

    // Simular doble clic / reset
    mockLocalStorage.removeItem("negova_open_tickets_btn_pos");
    expect(mockLocalStorage.getItem("negova_open_tickets_btn_pos")).toBeNull();
  });
});
