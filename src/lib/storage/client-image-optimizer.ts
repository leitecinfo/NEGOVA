/**
 * Utilidad de optimización y compresión de imágenes en el cliente (Browser).
 * Diseñado para NEGOVA para reducir costos y almacenamiento en Supabase Storage.
 */

export async function compressImageForUpload(
  file: File,
  maxDimension: number = 800,
  quality: number = 0.82
): Promise<File> {
  if (typeof window === "undefined" || (!window.createImageBitmap && !window.Image)) {
    return file;
  }
  // No alterar vectores SVG ni GIFs animados
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const outputMime = "image/webp";
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            const baseName = file.name.replace(/\.[^/.]+$/, "");
            const optimizedFile = new File([blob], `${baseName}.webp`, {
              type: outputMime,
              lastModified: Date.now(),
            });

            // Usar el archivo comprimido si es más ligero que el original
            if (optimizedFile.size < file.size) {
              resolve(optimizedFile);
            } else {
              resolve(file);
            }
          },
          outputMime,
          quality
        );
      };

      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

