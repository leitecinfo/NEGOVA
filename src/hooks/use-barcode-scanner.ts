"use client";

import { useEffect, useRef } from "react";
import { audioFeedback } from "@/lib/audio/beep";

export interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minChars?: number;
  maxDelayBetweenKeys?: number; // ms
  playBeep?: boolean;
  ignoreFocusedInputs?: boolean;
}

/**
 * Hook para capturar eventos de lectores de código de barras físicos (USB / Bluetooth / Wireless HID).
 * Los escáneres emulan un teclado ingresando ráfagas ultrarrápidas (<40ms por caracter) seguidas de Enter.
 */
export function useBarcodeScanner({
  onScan,
  enabled = true,
  minChars = 3,
  maxDelayBetweenKeys = 50,
  playBeep = true,
  ignoreFocusedInputs = false,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar teclas modificadoras solitarias
      if (
        e.key === "Shift" ||
        e.key === "Control" ||
        e.key === "Alt" ||
        e.key === "Meta" ||
        e.key === "CapsLock"
      ) {
        return;
      }

      // Si se encuentra en un campo de texto editable y está configurado para ignorar
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      const now = performance.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Si ha pasado demasiado tiempo entre teclas, reiniciar el buffer
      if (elapsed > maxDelayBetweenKeys && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }

      // El escáner usualmente termina su transmisión con 'Enter'
      if (e.key === "Enter") {
        const barcode = bufferRef.current.trim();
        bufferRef.current = "";

        if (barcode.length >= minChars) {
          // Prevenir envío de formularios o salto de línea por el Enter del escáner
          e.preventDefault();
          e.stopPropagation();

          if (playBeep) {
            audioFeedback.playSuccessBeep();
          }

          onScan(barcode);
        }
        return;
      }

      // Si solo es un carácter imprimible simple
      if (e.key.length === 1) {
        // Si el foco está en un input y no es una ráfaga rápida, no intervenir con la escritura normal
        if (isInputFocused && ignoreFocusedInputs && elapsed > maxDelayBetweenKeys) {
          bufferRef.current = "";
          return;
        }

        bufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [enabled, onScan, minChars, maxDelayBetweenKeys, playBeep, ignoreFocusedInputs]);
}

