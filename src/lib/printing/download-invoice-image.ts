import { toPng, toBlob } from "html-to-image";

export interface InvoiceImageOptions {
  pixelRatio?: number;
  backgroundColor?: string;
  quality?: number;
  filename?: string;
}

/**
 * Convierte un elemento DOM (recibo, factura térmica o comprobante) en una imagen PNG de alta resolución
 * y la descarga automáticamente en el dispositivo del usuario o la comparte mediante Web Share API en móviles.
 */
export async function downloadElementAsImage(
  element: HTMLElement,
  rawFilename: string,
  options?: InvoiceImageOptions
): Promise<"downloaded" | "shared"> {
  if (!element) {
    throw new Error("El elemento de la factura no está disponible para captura.");
  }

  const filename = rawFilename.endsWith(".png") ? rawFilename : `${rawFilename}.png`;
  const pixelRatio = options?.pixelRatio ?? 2; // Factor 2x para nitidez HD en pantallas retina y WhatsApp
  const backgroundColor = options?.backgroundColor ?? "#ffffff";

  try {
    // 1. Intentar generar Blob para verificar soporte de Web Share API en dispositivos móviles
    const blob = await toBlob(element, {
      pixelRatio,
      backgroundColor,
      cacheBust: true,
      skipAutoScale: true,
    });

    if (!blob) {
      throw new Error("No fue posible generar el archivo de imagen de la factura.");
    }

    const file = new File([blob], filename, { type: "image/png" });

    // 2. Si el navegador admite compartir archivos nativamente (Chrome Android, Safari iOS)
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] }) &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({
          files: [file],
          title: `Factura ${filename.replace(".png", "")}`,
          text: `Comprobante de factura ${filename.replace(".png", "")}`,
        });
        return "shared";
      } catch (shareErr: any) {
        // Si el usuario canceló el diálogo nativo de compartir
        if (shareErr?.name === "AbortError") {
          return "shared";
        }
        // Si falló por restricciones de permisos, continuar con descarga estándar
        console.warn("[downloadElementAsImage] Web Share no completado, recurriendo a descarga:", shareErr);
      }
    }

    // 3. Descarga directa en el navegador vía Data URL o Blob URL
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return "downloaded";
  } catch (err: any) {
    console.error("[downloadElementAsImage] Error al capturar imagen:", err);
    throw err;
  }
}
