import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Nombre del Bucket Raíz para medios de la plataforma NEGOVA
 */
export const NEGOVA_STORAGE_BUCKET = "negova-storage";

/**
 * Estructura organizada de rutas y carpetas dentro del bucket de Supabase Storage.
 * Permite escalar a futuro para negocios, productos, documentos y marcas.
 */
export const STORAGE_PATHS = {
  // 1. Avatares de Usuarios de Plataforma y Clientes
  userAvatarDir: (userId: string) => `avatars/users/${userId}`,
  userAvatarFile: (userId: string, filename: string) => `avatars/users/${userId}/${filename}`,

  // 2. Recursos de Negocios Multi-Tenant (Empresas registradas)
  businessDir: (businessId: string) => `businesses/${businessId}`,
  businessLogosDir: (businessId: string) => `businesses/${businessId}/logos`,
  businessLogoFile: (businessId: string, filename: string) => `businesses/${businessId}/logos/${filename}`,
  businessCoversDir: (businessId: string) => `businesses/${businessId}/covers`,
  businessProductsDir: (businessId: string) => `businesses/${businessId}/products`,
  productMainDir: (businessId: string, productId: string) => `businesses/${businessId}/catalog/products/${productId}/main`,
  productMainFile: (businessId: string, productId: string, filename: string) => `businesses/${businessId}/catalog/products/${productId}/main/${filename}`,
  productGalleryDir: (businessId: string, productId: string) => `businesses/${businessId}/catalog/products/${productId}/gallery`,
  productGalleryFile: (businessId: string, productId: string, filename: string) => `businesses/${businessId}/catalog/products/${productId}/gallery/${filename}`,

  // 3. Documentación y Facturación
  documentsDir: (businessId: string) => `businesses/${businessId}/documents`,
  invoicesDir: () => `platform/invoices`,

  // 4. Menú Digital
  businessMenuDir: (businessId: string) => `businesses/${businessId}/menu`,
  businessMenuFile: (businessId: string, filename: string) => `businesses/${businessId}/menu/${filename}`,

  // 4.1 Métodos de Pago y QR
  businessPaymentQrDir: (businessId: string) => `businesses/${businessId}/payments/qr`,
  businessPaymentQrFile: (businessId: string, filename: string) => `businesses/${businessId}/payments/qr/${filename}`,

  // 5. Recursos Institucionales de NEGOVA
  platformBrandingDir: () => `platform/branding`,
} as const;

/**
 * Garantiza que el bucket público exista en Supabase Storage.
 * Si no existe, lo crea automáticamente con visibilidad pública y límites de tamaño.
 */
export async function ensureNegovaBucket(adminClient: SupabaseClient): Promise<boolean> {
  try {
    const { data: bucket, error: getError } = await adminClient.storage.getBucket(NEGOVA_STORAGE_BUCKET);

    if (bucket && !getError) {
      return true;
    }

    const { error: createError } = await adminClient.storage.createBucket(NEGOVA_STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: 10485760, // 10MB máximo
      allowedMimeTypes: [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "image/gif",
        "image/svg+xml",
        "application/pdf",
      ],
    });

    if (createError) {
      console.warn("Aviso al verificar/crear bucket de almacenamiento:", createError.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("Excepción al verificar bucket de almacenamiento:", err);
    return false;
  }
}

/**
/**
 * Extrae la ruta relativa de un archivo en Supabase Storage a partir de su URL pública.
 */
export function extractStoragePathFromUrl(publicUrl: string, bucket: string = NEGOVA_STORAGE_BUCKET): string | null {
  try {
    if (!publicUrl) return null;
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = publicUrl.indexOf(marker);
    if (index !== -1) {
      return decodeURIComponent(publicUrl.substring(index + marker.length).split("?")[0]);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sube una imagen de avatar para un usuario específico y retorna la URL pública.
 * Limpia avatares anteriores del usuario físicamente del Storage para no dejar archivos huérfanos.
 */
export async function uploadUserAvatarFile(
  adminClient: SupabaseClient,
  userId: string,
  file: File,
  previousAvatarUrl?: string | null
): Promise<{ url: string | null; error: string | null }> {
  try {
    await ensureNegovaBucket(adminClient);

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return {
        url: null,
        error: "Formato no válido. Utilice JPG, PNG, WEBP o GIF.",
      };
    }

    const maxSizeBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeBytes) {
      return {
        url: null,
        error: "El archivo supera el tamaño máximo permitido de 5MB.",
      };
    }

    // 1. Limpiar físicamente imágenes previas del Storage (tanto de la carpeta como por URL)
    await deleteUserAvatarFiles(adminClient, userId, previousAvatarUrl);

    // 2. Generar nombre de archivo único
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `avatar-${Date.now()}.${fileExtension}`;
    const filePath = STORAGE_PATHS.userAvatarFile(userId, fileName);

    // 3. Convertir File a ArrayBuffer / Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Subir al storage
    const { error: uploadError } = await adminClient.storage
      .from(NEGOVA_STORAGE_BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return {
        url: null,
        error: `Error al subir al Storage: ${uploadError.message}`,
      };
    }

    // 5. Obtener URL pública
    const { data: publicUrlData } = adminClient.storage
      .from(NEGOVA_STORAGE_BUCKET)
      .getPublicUrl(filePath);

    return {
      url: publicUrlData.publicUrl,
      error: null,
    };
  } catch (err: any) {
    return {
      url: null,
      error: err?.message || "Error inesperado al subir la imagen.",
    };
  }
}

/**
 * Elimina físicamente los avatares existentes de un usuario en Storage
 */
export async function deleteUserAvatarFiles(
  adminClient: SupabaseClient,
  userId: string,
  explicitUrl?: string | null
): Promise<void> {
  try {
    const userDir = STORAGE_PATHS.userAvatarDir(userId);
    const filesToRemove: Set<string> = new Set();

    // 1. Listar y recopilar archivos existentes en el directorio del usuario
    const { data: existingFiles } = await adminClient.storage.from(NEGOVA_STORAGE_BUCKET).list(userDir);
    if (existingFiles && existingFiles.length > 0) {
      existingFiles.forEach((f) => {
        if (f.name && f.name !== ".emptyFolderPlaceholder") {
          filesToRemove.add(`${userDir}/${f.name}`);
        }
      });
    }

    // 2. Si se pasó una URL explícita previa, extraer la ruta y agregarla a la eliminación
    if (explicitUrl) {
      const explicitPath = extractStoragePathFromUrl(explicitUrl, NEGOVA_STORAGE_BUCKET);
      if (explicitPath) {
        filesToRemove.add(explicitPath);
      }
    }

    // 3. Ejecutar borrado físico en el bucket de Storage
    if (filesToRemove.size > 0) {
      await adminClient.storage.from(NEGOVA_STORAGE_BUCKET).remove(Array.from(filesToRemove));
    }
  } catch (err) {
    console.warn("Aviso al limpiar archivos físicos de avatar en Storage:", err);
  }
}

/**
 * Sube un PDF de comprobante de cobro de NEGOVA al Storage
 */
export async function uploadInvoicePdfBuffer(
  adminClient: SupabaseClient,
  invoiceNumber: string,
  pdfBuffer: Buffer
): Promise<{ url: string | null; storagePath: string | null; error: string | null }> {
  try {
    await ensureNegovaBucket(adminClient);

    const filename = `comprobante-${invoiceNumber}.pdf`;
    const storagePath = `platform/invoices/${filename}`;

    const { error: uploadError } = await adminClient.storage
      .from(NEGOVA_STORAGE_BUCKET)
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return { url: null, storagePath: null, error: uploadError.message };
    }

    const { data: publicUrlData } = adminClient.storage
      .from(NEGOVA_STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    return {
      url: publicUrlData.publicUrl,
      storagePath,
      error: null,
    };
  } catch (err: any) {
    return {
      url: null,
      storagePath: null,
      error: err?.message || "Error al subir PDF de cobro a Storage",
    };
  }
}

/**
 * Sube un PDF de documento comercial de un negocio cliente al Storage (Aislado por businessId)
 */
export async function uploadBusinessDocumentPdfBuffer(
  adminClient: SupabaseClient,
  businessId: string,
  documentNumber: string,
  pdfBuffer: Buffer
): Promise<{ url: string | null; storagePath: string | null; error: string | null }> {
  try {
    await ensureNegovaBucket(adminClient);

    const filename = `${documentNumber}.pdf`;
    const storagePath = `businesses/${businessId}/documents/${filename}`;

    const { error: uploadError } = await adminClient.storage
      .from(NEGOVA_STORAGE_BUCKET)
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return { url: null, storagePath: null, error: uploadError.message };
    }

    const { data: publicUrlData } = adminClient.storage
      .from(NEGOVA_STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    return {
      url: publicUrlData.publicUrl,
      storagePath,
      error: null,
    };
  } catch (err: any) {
    return {
      url: null,
      storagePath: null,
      error: err?.message || "Error al subir PDF de documento comercial a Storage",
    };
  }
}

/**
 * Sube la imagen principal de un producto al Storage de Supabase (Aislado por businessId).
 * Limpia la imagen previa si existía en Storage para no dejar archivos huérfanos.
 */
export async function uploadProductImageFile(
  adminClient: SupabaseClient,
  businessId: string,
  productId: string,
  file: File,
  previousImageUrl?: string | null
): Promise<{ url: string | null; storagePath: string | null; error: string | null }> {
  try {
    await ensureNegovaBucket(adminClient);

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      return {
        url: null,
        storagePath: null,
        error: "Formato no válido. Utilice JPG, PNG o WEBP.",
      };
    }

    const maxSizeBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeBytes) {
      return {
        url: null,
        storagePath: null,
        error: "El archivo supera el tamaño máximo permitido de 5MB.",
      };
    }

    // Si se pasa una imagen previa del mismo negocio, eliminarla físicamente
    if (previousImageUrl) {
      const prevPath = extractStoragePathFromUrl(previousImageUrl, NEGOVA_STORAGE_BUCKET);
      if (prevPath && prevPath.startsWith(`businesses/${businessId}/`)) {
        await adminClient.storage.from(NEGOVA_STORAGE_BUCKET).remove([prevPath]);
      }
    }

    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "webp";
    const uniqueFileName = `main-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExtension}`;
    const storagePath = STORAGE_PATHS.productMainFile(businessId, productId, uniqueFileName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await adminClient.storage
      .from(NEGOVA_STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return {
        url: null,
        storagePath: null,
        error: `Error al subir imagen al Storage: ${uploadError.message}`,
      };
    }

    const { data: publicUrlData } = adminClient.storage
      .from(NEGOVA_STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    return {
      url: publicUrlData.publicUrl,
      storagePath,
      error: null,
    };
  } catch (err: any) {
    return {
      url: null,
      storagePath: null,
      error: err?.message || "Error inesperado al subir la imagen del producto.",
    };
  }
}

/**
 * Elimina la imagen de un producto en Storage asegurando el aislamiento por business_id
 */
export async function deleteProductImageFile(
  adminClient: SupabaseClient,
  businessId: string,
  imageUrl: string
): Promise<void> {
  try {
    const storagePath = extractStoragePathFromUrl(imageUrl, NEGOVA_STORAGE_BUCKET);
    if (storagePath && storagePath.startsWith(`businesses/${businessId}/`)) {
      await adminClient.storage.from(NEGOVA_STORAGE_BUCKET).remove([storagePath]);
    }
  } catch (err) {
    console.warn("Aviso al eliminar imagen de producto en Storage:", err);
  }
}

/**
 * Sube un archivo de menú digital (PDF o Imagen) para un negocio.
 * Aplica validaciones estrictas de tipo y tamaño (máx. 10MB) y permite
 * eliminar de inmediato el archivo anterior en Storage si se especifica.
 */
export async function uploadDigitalMenuFileStorage(
  adminClient: SupabaseClient,
  businessId: string,
  file: File,
  previousStoragePath?: string | null
): Promise<{
  url: string | null;
  storagePath: string | null;
  fileType: "pdf" | "image" | null;
  fileName: string | null;
  fileSizeBytes: number;
  error: string | null;
}> {
  try {
    await ensureNegovaBucket(adminClient);

    const validTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!validTypes.includes(file.type)) {
      return {
        url: null,
        storagePath: null,
        fileType: null,
        fileName: null,
        fileSizeBytes: 0,
        error: "Formato no válido. Solo se admiten archivos PDF, JPEG/JPG, PNG y WEBP.",
      };
    }

    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeBytes) {
      return {
        url: null,
        storagePath: null,
        fileType: null,
        fileName: null,
        fileSizeBytes: file.size,
        error: "El archivo supera el tamaño máximo permitido de 10MB.",
      };
    }

    const isPdf = file.type === "application/pdf";
    const fileType: "pdf" | "image" = isPdf ? "pdf" : "image";

    const fileExtension =
      file.name.split(".").pop()?.toLowerCase() || (isPdf ? "pdf" : "webp");
    const uniqueFileName = `menu-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExtension}`;
    const storagePath = STORAGE_PATHS.businessMenuFile(businessId, uniqueFileName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await adminClient.storage
      .from(NEGOVA_STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return {
        url: null,
        storagePath: null,
        fileType: null,
        fileName: null,
        fileSizeBytes: file.size,
        error: `Error al subir el archivo al almacenamiento: ${uploadError.message}`,
      };
    }

    // Si había un archivo anterior en este mismo tenant, eliminarlo físicamente
    if (previousStoragePath && previousStoragePath.startsWith(`businesses/${businessId}/`)) {
      await adminClient.storage.from(NEGOVA_STORAGE_BUCKET).remove([previousStoragePath]);
    }

    const { data: publicUrlData } = adminClient.storage
      .from(NEGOVA_STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    return {
      url: publicUrlData.publicUrl,
      storagePath,
      fileType,
      fileName: file.name,
      fileSizeBytes: file.size,
      error: null,
    };
  } catch (err: any) {
    return {
      url: null,
      storagePath: null,
      fileType: null,
      fileName: null,
      fileSizeBytes: file?.size || 0,
      error: err?.message || "Error inesperado al subir el archivo del menú digital.",
    };
  }
}

/**
 * Elimina físicamente el archivo propio del menú digital en Supabase Storage
 * respetando el aislamiento estricto del tenant.
 */
export async function deleteDigitalMenuFileStorage(
  adminClient: SupabaseClient,
  businessId: string,
  storagePathOrUrl: string
): Promise<void> {
  try {
    let path = storagePathOrUrl;
    if (path.startsWith("http")) {
      const extracted = extractStoragePathFromUrl(path, NEGOVA_STORAGE_BUCKET);
      if (extracted) path = extracted;
    }

    if (path && path.startsWith(`businesses/${businessId}/`)) {
      await adminClient.storage.from(NEGOVA_STORAGE_BUCKET).remove([path]);
    }
  } catch (err) {
    console.warn("Aviso al eliminar archivo de menú digital en Storage:", err);
  }
}



