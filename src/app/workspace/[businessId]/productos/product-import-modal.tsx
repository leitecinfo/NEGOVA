"use client";

import React, { useState, useTransition, useRef } from "react";
import * as XLSX from "xlsx";
import { CustomModal } from "@/components/ui/custom-modal";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
  RefreshCw,
  Check,
  Tag,
  Layers,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import {
  validateProductsCSVAction,
  importProductsBatchAction,
  getProductsTemplateCSVAction,
} from "./actions";
import type { ParsedCSVResult, ValidatedProductRow } from "@/lib/products/csv-service";

interface Props {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const FALLBACK_TEMPLATE =
  "\uFEFFsku,nombre,precio_costo,precio_venta,stock_actual,stock_minimo,categoria,imagen_url,codigo_barras,con_impuesto,tipo_impuesto,precio_incluye_impuesto,con_variante,variante_name,variante_precio_costo,variante_precio_venta,variante_stock\r\n" +
  'HAM-001,Hamburguesa Clásica Artesanal,12000,28000,50,10,Hamburguesas,https://images.unsplash.com/photo-1568901346375-23c9450c58cd,7701234567890,Sí,19%,Sí,No,"","","",""\r\n' +
  'GAS-002,Gaseosa Personal 400ml,2200,4500,100,20,Bebidas,"",7709876543210,Sí,19%,Sí,No,"","","",""\r\n' +
  'PIZ-003,Pizza Suprema Especial,18000,42000,25,5,Pizzas,"",7705551234567,Sí,8%,Sí,Sí,Familiar 8 Porciones,18000,42000,25';

export function ProductImportModal({
  businessId,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedCSVResult | null>(null);
  const [activeTab, setActiveTab] = useState<"valid" | "invalid">("valid");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setIsDragging(false);
    setParsedResult(null);
    setActiveTab("valid");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await getProductsTemplateCSVAction(businessId);
      const content = res.success && res.data ? res.data : FALLBACK_TEMPLATE;
      const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "plantilla_importacion_productos.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Plantilla CSV descargada exitosamente");
    } catch {
      const blob = new Blob([FALLBACK_TEMPLATE], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "plantilla_importacion_productos.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Plantilla CSV descargada");
    }
  };

  const processFile = (selected: File) => {
    const fileName = selected.name.toLowerCase();
    const isCsv = fileName.endsWith(".csv");
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    if (!isCsv && !isExcel) {
      toast.error("Formato no compatible", {
        description: "Por favor selecciona un archivo con extensión .csv, .xlsx o .xls.",
      });
      return;
    }

    setFile(selected);

    startTransition(async () => {
      try {
        let csvContent = "";

        if (isExcel) {
          const buffer = await selected.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            throw new Error("El libro de Excel no contiene hojas de cálculo.");
          }
          const worksheet = workbook.Sheets[firstSheetName];
          csvContent = XLSX.utils.sheet_to_csv(worksheet, { FS: "," });
        } else {
          csvContent = await selected.text();
        }

        const res = await validateProductsCSVAction(businessId, csvContent);
        if (res.success && res.data) {
          setParsedResult(res.data);
          if (res.data.validRows.length === 0 && res.data.invalidRows.length > 0) {
            setActiveTab("invalid");
          } else {
            setActiveTab("valid");
          }
        } else {
          toast.error("Error al procesar archivo", {
            description: res.error || "No se pudieron interpretar las filas del catálogo.",
          });
          resetState();
        }
      } catch (err: any) {
        toast.error("Error al leer el archivo", {
          description: err?.message || "Ocurrió un problema al procesar los datos.",
        });
        resetState();
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processFile(selected);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleImport = () => {
    if (!parsedResult || parsedResult.validRows.length === 0) return;

    startTransition(async () => {
      const res = await importProductsBatchAction(businessId, parsedResult.validRows);
      if (res.success && res.data) {
        toast.success("Catálogo importado", {
          description: res.data.message,
        });
        if (onSuccess) onSuccess();
        handleClose();
      } else {
        toast.error("Error en la importación", {
          description: res.error || "Ocurrió un error al procesar el lote.",
        });
      }
    });
  };

  const formatCOP = (val?: number | null) => {
    if (val === null || val === undefined) return "—";
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Importar Productos desde CSV / Excel"
      description="Sube un archivo CSV o Excel (.xlsx) con tus productos para agregarlos masivamente."
      maxWidth="4xl"
      showConfirmButton={false}
    >
      <div className="space-y-4 py-1">
        {/* PASO 1: Subida de archivo / Drag & Drop */}
        {!parsedResult ? (
          <div className="space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-[#ED500A] bg-[#ED500A]/5 scale-[0.99]"
                  : "border-slate-200 dark:border-white/[0.1] hover:border-[#ED500A]/50 dark:hover:border-[#ED500A]/50 bg-slate-50/50 dark:bg-white/[0.02]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
                  isDragging
                    ? "bg-[#ED500A] text-white"
                    : "bg-[#ED500A]/10 text-[#ED500A]"
                }`}
              >
                {isPending ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-white">
                {isDragging
                  ? "Suelta tu archivo aquí"
                  : "Arrastra y suelta tu archivo aquí o haz clic para examinar"}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                Formatos soportados: <span className="font-semibold text-slate-700 dark:text-slate-300">.csv, .xlsx, .xls</span> (delimitado por comas, punto y coma o libros Excel).
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-2xs text-slate-400">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.04]">Limpieza automática de ($)</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.04]">Autocreación de categorías</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.04]">Actualización por SKU</span>
              </div>
            </div>

            {/* Botón secundario: Descargar plantilla */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] rounded-xl gap-3">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    ¿Necesitas una plantilla de ejemplo?
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Descarga nuestra plantilla estándar con columnas reconocibles (SKU, nombre, costo, venta, variantes, impuestos).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white dark:bg-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/[0.1] text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-lg transition-colors shadow-2xs shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar plantilla</span>
              </button>
            </div>
          </div>
        ) : (
          /* PASO 2: KPIs, Previsualización y Confirmación */
          <div className="space-y-4">
            {/* Tarjetas de estadísticas / KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Filas</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white mt-0.5">
                  {parsedResult.totalRows}
                </p>
              </div>

              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/30 rounded-xl">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Válidos (A importar)</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {parsedResult.validRows.length}
                </p>
              </div>

              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/30 rounded-xl">
                <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Actualizaciones SKU</p>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300 mt-0.5">
                  {parsedResult.existingSkusCount}
                </p>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  parsedResult.invalidRows.length > 0
                    ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/30"
                    : "bg-slate-50 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.08]"
                }`}
              >
                <p
                  className={`text-xs font-medium ${
                    parsedResult.invalidRows.length > 0
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  Filas con error
                </p>
                <p
                  className={`text-lg font-bold mt-0.5 ${
                    parsedResult.invalidRows.length > 0
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {parsedResult.invalidRows.length}
                </p>
              </div>
            </div>

            {/* Aviso de resiliencia si hay filas con error */}
            {parsedResult.invalidRows.length > 0 && (
              <div className="flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <span className="font-semibold">Regla de importación:</span> Se procesarán los registros válidos ({parsedResult.validRows.length}). Las filas con errores ({parsedResult.invalidRows.length}) serán omitidas y reportadas para que puedas corregirlas.
                </div>
              </div>
            )}

            {/* Pestañas: Válidos vs Errores */}
            <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-white/[0.08] pb-1">
              <button
                type="button"
                onClick={() => setActiveTab("valid")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === "valid"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Listos para importar ({parsedResult.validRows.length})</span>
              </button>

              {parsedResult.invalidRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("invalid")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === "invalid"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Filas con errores ({parsedResult.invalidRows.length})</span>
                </button>
              )}
            </div>

            {/* TABLA PREVIEW */}
            <div className="max-h-72 overflow-x-auto overflow-y-auto border border-slate-200/80 dark:border-white/[0.08] rounded-xl">
              {activeTab === "valid" ? (
                parsedResult.validRows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No se encontraron productos con formato válido para importar.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 min-w-[700px]">
                    <thead className="bg-slate-50 dark:bg-white/[0.02] sticky top-0 border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="py-2.5 px-3">Fila</th>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Producto</th>
                        <th className="py-2.5 px-3">Categoría</th>
                        <th className="py-2.5 px-3 text-right">Costo</th>
                        <th className="py-2.5 px-3 text-right">Precio Venta</th>
                        <th className="py-2.5 px-3 text-center">Stock</th>
                        <th className="py-2.5 px-3">Impuestos</th>
                        <th className="py-2.5 px-3">Variantes</th>
                        <th className="py-2.5 px-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                      {parsedResult.validRows.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                          <td className="py-2 px-3 font-mono text-slate-400 text-2xs">#{r.rowNumber}</td>
                          <td className="py-2 px-3 font-mono text-2xs text-slate-600 dark:text-slate-400">
                            {r.sku || "—"}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            <div>{r.name}</div>
                            {r.barcode && (
                              <div className="text-3xs font-mono text-slate-400">Barra: {r.barcode}</div>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 text-2xs">
                              <Tag className="w-2.5 h-2.5" />
                              {r.categoryName || "General"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-500 font-mono">
                            {formatCOP(r.cost)}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-800 dark:text-slate-100 font-mono">
                            {formatCOP(r.price)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {r.stockQuantity !== null && r.stockQuantity !== undefined ? (
                              <span className="font-mono font-medium">
                                {r.stockQuantity}
                                {r.minStock ? (
                                  <span className="text-3xs text-slate-400 block">mín: {r.minStock}</span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-2xs">
                            {r.taxType ? (
                              <span className="inline-flex items-center gap-0.5 text-slate-600 dark:text-slate-400">
                                <Percent className="w-2.5 h-2.5" />
                                {r.taxType} {r.taxIncludedInPrice ? "(Incl.)" : ""}
                              </span>
                            ) : r.hasTax === false ? (
                              <span className="text-slate-400">Exento</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-2xs">
                            {r.variantName ? (
                              <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                                <Layers className="w-2.5 h-2.5 text-blue-500" />
                                {r.variantName}
                              </span>
                            ) : r.hasVariants ? (
                              <span className="text-blue-600 dark:text-blue-400">Con variantes</span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {r.action === "update" ? (
                              <span className="inline-flex px-1.5 py-0.5 rounded-md text-2xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                Actualizar
                              </span>
                            ) : (
                              <span className="inline-flex px-1.5 py-0.5 rounded-md text-2xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                Crear
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                /* TABLA ERRORES */
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-white/[0.02] sticky top-0 border-b border-slate-200/80 dark:border-white/[0.08] text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2 px-3">Fila</th>
                      <th className="py-2 px-3">Producto Detectado</th>
                      <th className="py-2 px-3">Motivo del Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {parsedResult.invalidRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01]">
                        <td className="py-2 px-3 font-mono text-amber-600 font-semibold text-2xs">
                          #{r.rowNumber}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                          {r.name || "(Sin nombre)"}
                        </td>
                        <td className="py-2 px-3 text-amber-600 dark:text-amber-400 text-xs">
                          {r.errors.join("; ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* BOTONES FINALES */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-200/80 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={resetState}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Elegir otro archivo</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isPending || parsedResult.validRows.length === 0}
                  onClick={handleImport}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#ED500A] hover:bg-[#ED500A]/90 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Importando catálogo...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirmar Importación ({parsedResult.validRows.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CustomModal>
  );
}
