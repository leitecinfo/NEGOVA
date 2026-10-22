"use client";

import React from "react";
import {
  BusinessDigitalMenu,
  DigitalMenuModality,
  DigitalMenuTemplateId,
  DigitalMenuCustomSettings,
  DigitalMenuPublicBusiness,
} from "@/lib/menu/types";
import { Product, Category } from "@/lib/products/types";
import { UrbanaMenuTemplate } from "./urbana-template";
import { EleganteMenuTemplate } from "./elegante-template";
import { ComercialMenuTemplate } from "./comercial-template";
import { VisualMenuTemplate } from "./visual-template";
import { PdfViewerComponent } from "./pdf-viewer";
import { ImageViewerComponent } from "./image-viewer";
import { FileQuestion, AlertCircle } from "lucide-react";

import { PublicPaymentMethodDTO } from "@/lib/payments/types";

interface Props {
  business: DigitalMenuPublicBusiness;
  menu: BusinessDigitalMenu;
  categories: Category[];
  products: Product[];
  paymentMethods?: PublicPaymentMethodDTO[];
  isPreview?: boolean;
  isMobile?: boolean;
  overrideModality?: DigitalMenuModality;
  overrideTemplateId?: DigitalMenuTemplateId;
  overrideSettings?: DigitalMenuCustomSettings;
  overrideFileUrl?: string | null;
  overrideFileType?: "pdf" | "image" | null;
  overrideFileName?: string | null;
  activeTable?: { id: string; name_or_number: string } | null;
  tableToken?: string | null;
}

export function TemplateRenderer({
  business,
  menu,
  categories,
  products,
  paymentMethods,
  isPreview = false,
  isMobile = false,
  overrideModality,
  overrideTemplateId,
  overrideSettings,
  overrideFileUrl,
  overrideFileType,
  overrideFileName,
  activeTable,
  tableToken,
}: Props) {
  const modality = overrideModality || menu.modality || "template";
  const templateId = overrideTemplateId || menu.template_id || "urbana";
  const settings = overrideSettings || menu.custom_settings;
  const fileUrl = overrideFileUrl !== undefined ? overrideFileUrl : menu.file_url;
  const fileType = overrideFileType !== undefined ? overrideFileType : menu.file_type;
  const fileName = overrideFileName !== undefined ? overrideFileName : menu.file_name;

  // 1. MODALIDAD C: Archivo propio (PDF o Imagen)
  if (modality === "file") {
    if (!fileUrl) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center bg-slate-900 text-white rounded-2xl border border-white/10 m-4">
          <FileQuestion className="w-12 h-12 text-slate-500 mb-3" />
          <h3 className="text-lg font-bold text-white">Ningún archivo cargado</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            El comercio ha seleccionado la modalidad de archivo propio pero aún no ha subido su PDF o imagen de menú.
          </p>
        </div>
      );
    }

    if (fileType === "pdf" || fileUrl.toLowerCase().endsWith(".pdf")) {
      return (
        <PdfViewerComponent
          business={business}
          fileUrl={fileUrl}
          fileName={fileName}
          fileSizeBytes={menu.file_size_bytes}
          isPreview={isPreview}
        />
      );
    }

    return (
      <ImageViewerComponent
        business={business}
        fileUrl={fileUrl}
        fileName={fileName}
        fileSizeBytes={menu.file_size_bytes}
        isPreview={isPreview}
      />
    );
  }

  // 2. MODALIDADES A Y B: Plantilla prediseñada o personalizada
  switch (templateId) {
    case "elegante":
      return (
        <EleganteMenuTemplate
          business={business}
          categories={categories}
          products={products}
          settings={settings}
          paymentMethods={paymentMethods}
          isPreview={isPreview}
          isMobile={isMobile}
          activeTable={activeTable}
          tableToken={tableToken}
        />
      );

    case "comercial":
      return (
        <ComercialMenuTemplate
          business={business}
          categories={categories}
          products={products}
          settings={settings}
          paymentMethods={paymentMethods}
          isPreview={isPreview}
          isMobile={isMobile}
          activeTable={activeTable}
          tableToken={tableToken}
        />
      );

    case "visual":
      return (
        <VisualMenuTemplate
          business={business}
          categories={categories}
          products={products}
          settings={settings}
          paymentMethods={paymentMethods}
          isPreview={isPreview}
          isMobile={isMobile}
          activeTable={activeTable}
          tableToken={tableToken}
        />
      );

    case "urbana":
    default:
      return (
        <UrbanaMenuTemplate
          business={business}
          categories={categories}
          products={products}
          settings={settings}
          paymentMethods={paymentMethods}
          isPreview={isPreview}
          isMobile={isMobile}
          activeTable={activeTable}
          tableToken={tableToken}
        />
      );
  }
}
