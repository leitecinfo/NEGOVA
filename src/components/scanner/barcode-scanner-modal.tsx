"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  X,
  Flashlight,
  SwitchCamera,
  Barcode as BarcodeIcon,
  CheckCircle2,
  AlertCircle,
  Keyboard,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { audioFeedback } from "@/lib/audio/beep";

// Declaración de tipos para la Barcode Detection API (W3C Draft)
declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): {
        detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string; format: string }>>;
      };
      getSupportedFormats?(): Promise<string[]>;
    };
  }
}

export interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  description?: string;
  allowManualInput?: boolean;
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "Escanear Código de Barras",
  description = "Apunta la cámara al código de barras del producto o ingrésalo manualmente.",
  allowManualInput = true,
}: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  // Entrada manual de respaldo
  const [manualCode, setManualCode] = useState<string>("");
  const [showManualInput, setShowManualInput] = useState<boolean>(false);

  // Detener la cámara y bucle de detección
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Manejar el resultado de un escaneo exitoso
  const handleDetectedBarcode = useCallback(
    (code: string) => {
      const cleanCode = code.trim();
      if (!cleanCode || cleanCode === lastScannedCode) return;

      setLastScannedCode(cleanCode);
      audioFeedback.playSuccessBeep();

      // Pequeño retardo visual para mostrar el código detectado antes de cerrar
      setTimeout(() => {
        stopCamera();
        onScan(cleanCode);
        onClose();
      }, 350);
    },
    [lastScannedCode, onScan, onClose, stopCamera]
  );

  // Iniciar la cámara
  const startCamera = useCallback(async () => {
    setCameraError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Tu navegador no soporta acceso a la cámara.");
      setHasCameraPermission(false);
      setShowManualInput(true);
      return;
    }

    try {
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setHasCameraPermission(true);

      // Comprobar si la pista soporta linterna / torch
      const track = stream.getVideoTracks()[0];
      const capabilities = (track.getCapabilities?.() as any) || {};
      setHasTorch(Boolean(capabilities.torch));

      // Iniciar el bucle de detección con BarcodeDetector si está disponible
      if (window.BarcodeDetector) {
        try {
          const barcodeDetector = new window.BarcodeDetector({
            formats: [
              "ean_13",
              "ean_8",
              "code_128",
              "code_39",
              "code_93",
              "upc_a",
              "upc_e",
              "itf",
              "qr_code",
              "data_matrix",
            ],
          });

          const scanLoop = async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) {
              animationFrameRef.current = requestAnimationFrame(scanLoop);
              return;
            }

            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const detected = barcodes[0].rawValue;
                if (detected) {
                  handleDetectedBarcode(detected);
                  return; // Salir del bucle
                }
              }
            } catch {
              // Error de lectura de fotograma silencioso
            }

            animationFrameRef.current = requestAnimationFrame(scanLoop);
          };

          animationFrameRef.current = requestAnimationFrame(scanLoop);
        } catch (e) {
          console.warn("[BarcodeDetector init error]", e);
        }
      }
    } catch (err: any) {
      console.warn("[Camera start error]", err);
      setHasCameraPermission(false);
      setCameraError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Permiso de cámara denegado. Puedes escribir o usar un lector físico."
          : "No se pudo acceder a la cámara del dispositivo."
      );
      setShowManualInput(true);
    }
  }, [facingMode, handleDetectedBarcode, stopCamera]);

  // Alternar linterna
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setIsTorchOn(nextState);
    } catch {
      // No soportado
    }
  };

  // Alternar cámara (frontal / trasera)
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Enviar código manual
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;

    audioFeedback.playSuccessBeep();
    stopCamera();
    onScan(code);
    onClose();
  };

  // Ciclo de vida cuando se abre / cierra el modal
  useEffect(() => {
    if (isOpen) {
      setLastScannedCode(null);
      setManualCode("");
      setShowManualInput(false);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Cerrar al presionar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scanner-modal-title"
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150"
      >
        <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 text-white font-body">
          {/* Cabecera */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#ED500A]/15 border border-[#ED500A]/30 flex items-center justify-center text-[#ED500A]">
                <BarcodeIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 id="scanner-modal-title" className="text-sm font-bold font-title">
                  {title}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {hasCameraPermission ? "Cámara activa lista" : "Lector de código"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Cerrar scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cuerpo del Visor / Cámara */}
          <div className="relative bg-black flex items-center justify-center min-h-[300px] overflow-hidden">
            {/* Elemento de video en tiempo real */}
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-[320px] object-cover transition-opacity ${
                hasCameraPermission ? "opacity-100" : "opacity-0"
              }`}
            />

            {/* Retícula y Guía Visual de Escaneo */}
            {hasCameraPermission && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                <div className="relative w-64 h-40 border-2 border-[#ED500A] rounded-2xl shadow-[0_0_20px_rgba(237,80,10,0.4)]">
                  {/* Esquinas destacadas */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-white rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-white rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-white rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-white rounded-br-lg" />

                  {/* Línea láser de escaneo animada */}
                  <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_red] animate-pulse" style={{
                    top: "50%",
                    transform: "translateY(-50%)",
                  }} />

                  {/* Estado de detección exitosa */}
                  {lastScannedCode && (
                    <div className="absolute inset-0 bg-[#ED500A]/30 backdrop-blur-2xs flex flex-col items-center justify-center rounded-2xl animate-in zoom-in-90">
                      <CheckCircle2 className="w-10 h-10 text-white animate-bounce" />
                      <span className="mt-2 text-xs font-mono font-bold bg-black/70 px-3 py-1 rounded-lg">
                        {lastScannedCode}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Controles sobre el visor de cámara */}
            {hasCameraPermission && (
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-xl text-[11px] font-mono text-slate-300 border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Enfoca la barra</span>
                </div>

                <div className="flex items-center gap-2">
                  {hasTorch && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-2 rounded-xl transition-colors cursor-pointer ${
                        isTorchOn
                          ? "bg-amber-400 text-slate-900 shadow-lg"
                          : "bg-black/60 text-white hover:bg-black/80 border border-white/10"
                      }`}
                      title={isTorchOn ? "Apagar linterna" : "Encender linterna"}
                    >
                      <Flashlight className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="p-2 rounded-xl bg-black/60 text-white hover:bg-black/80 border border-white/10 transition-colors cursor-pointer"
                    title="Cambiar cámara (Frontal/Trasera)"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Mensaje de Error / Cámara no disponible */}
            {cameraError && (
              <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-slate-900/95 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white mb-1">Cámara no disponible</h4>
                  <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                    {cameraError}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Reintentar Cámara
                </button>
              </div>
            )}
          </div>

          {/* Pie: Entrada Manual y Compatibilidad con Escáner Físico */}
          <div className="p-4 bg-slate-900 border-t border-white/10 space-y-3">
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              {description}
            </p>

            {allowManualInput && (
              <div className="pt-1">
                {!showManualInput && hasCameraPermission ? (
                  <button
                    type="button"
                    onClick={() => setShowManualInput(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                  >
                    <Keyboard className="w-3.5 h-3.5 text-slate-400" />
                    <span>Ingresar código manualmente</span>
                  </button>
                ) : (
                  <form onSubmit={handleManualSubmit} className="flex gap-2">
                    <div className="relative flex-1">
                      <BarcodeIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        placeholder="Ej. 770123456789 o REF-001..."
                        autoFocus
                        className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#ED500A]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!manualCode.trim()}
                      className="px-4 py-2 rounded-xl bg-[#ED500A] hover:bg-[#D44405] disabled:opacity-50 text-xs font-bold text-white transition-colors cursor-pointer shrink-0"
                    >
                      Aceptar
                    </button>
                  </form>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-mono">
              <span>💡 Compatible con pistolas lectoras USB / Bluetooth en tiempo real</span>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

