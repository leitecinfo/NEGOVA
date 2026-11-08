"use client";

import React, { useState, useRef, useTransition, useMemo } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Select } from "@/components/ui";
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
  UploadCloud,
  FileText,
  AlertTriangle,
  RefreshCw,
  FolderPlus,
  Layers,
  ArrowRight,
  Eye,
  Store,
  QrCode,
  UtensilsCrossed,
  Truck,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Location } from "@/lib/inventory/types";
import {
  parseFileRawRows,
  generateIngredientCSVTemplate,
  generateIngredientExcelTemplate,
  ValidatedIngredientRow,
  ParsedIngredientResult,
  RawIngredientImportRow,
} from "@/lib/recipes/ingredient-import-parser";
import {
  validateIngredientsImportAction,
  importIngredientsBatchAction,
} from "./actions";

interface Props {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  locations?: Location[];
}

export function IngredientImportModal({
  businessId,
  isOpen,
  onClose,
  onSuccess,
  locations = [],
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedIngredientResult | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "valid" | "invalid">("all");
  const [locationId, setLocationId] = useState<string>(locations[0]?.id || "");

  // Estado de progreso de importación masiva
  const [isImporting, setIsImporting] = useState(false);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setIsDragging(false);
    setIsValidating(false);
    setParsedResult(null);
    setFilterTab("all");
    setIsImporting(false);
    setProgressPercentage(0);
    setProgressMessage("");
  };

  const handleClose = () => {
    if (isImporting) return;
    resetState();
    onClose();
  };

  // Descarga de plantillas
  const handleDownloadExcelTemplate = () => {
    try {
      const buffer = generateIngredientExcelTemplate();
      const blob = new Blob([buffer as any], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "plantilla_importacion_ingredientes.xlsx");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Plantilla Excel (.xlsx) descargada.");
    } catch (err: any) {
      toast.error("Error al generar la plantilla Excel: " + err.message);
    }
  };

  const handleDownloadCSVTemplate = () => {
    try {
      const csvContent = generateIngredientCSVTemplate();
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "plantilla_importacion_ingredientes.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Plantilla CSV (.csv) descargada.");
    } catch (err: any) {
      toast.error("Error al generar la plantilla CSV: " + err.message);
    }
  };

  // Procesamiento de archivo seleccionado o soltado
  const processUploadedFile = async (selectedFile: File) => {
    const validExtensions = [".csv", ".xlsx", ".xls"];
    const fileName = selectedFile.name.toLowerCase();
    const isSupported = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isSupported) {
      toast.error("Formato no soportado", {
        description: "Por favor sube un archivo CSV (.csv) o Excel (.xlsx, .xls).",
      });
      return;
    }

    setFile(selectedFile);
    setIsValidating(true);
    setParsedResult(null);
    setProgressPercentage(0);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const rawRows: RawIngredientImportRow[] = parseFileRawRows(arrayBuffer);

      if (rawRows.length === 0) {
        toast.error("El archivo está vacío o no contiene registros válidos.");
        setIsValidating(false);
        return;
      }

      // Validar contra la base de datos (categorías e ingredientes existentes)
      const res = await validateIngredientsImportAction(businessId, rawRows);
      if (!res.success || !res.data) {
        throw new Error(res.error || "No se pudo validar el archivo.");
      }

      setParsedResult(res.data);

      if (res.data.invalidRows.length > 0 && res.data.validRows.length === 0) {
        setFilterTab("invalid");
        toast.warning(
          `Se detectaron errores en todas las filas (${res.data.invalidRows.length} filas inválidas). Revisa la previsualización.`
        );
      } else if (res.data.invalidRows.length > 0) {
        toast.warning(
          `Archivo analizado: ${res.data.validRows.length} filas válidas y ${res.data.invalidRows.length} filas con errores.`
        );
      } else {
        toast.success(`Archivo verificado: ${res.data.validRows.length} ingredientes listos para importar.`);
      }
    } catch (err: any) {
      toast.error("Error al procesar archivo: " + (err.message || "Error desconocido"));
      setFile(null);
    } finally {
      setIsValidating(false);
    }
  };

  // Manejo de Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processUploadedFile(droppedFile);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processUploadedFile(selectedFile);
    }
  };

  // Ejecución de importación masiva por lotes con barra de progreso
  const handleExecuteImport = async () => {
    if (!parsedResult || parsedResult.validRows.length === 0) {
      toast.error("No hay registros válidos para importar.");
      return;
    }

    setIsImporting(true);
    setProgressPercentage(5);
    setProgressMessage("Iniciando importación masiva de insumos...");

    const rowsToImport = parsedResult.validRows;
    const totalRows = rowsToImport.length;
    const chunkSize = 25; // Procesamiento en bloques para actualizar barra de progreso
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalFailed = 0;
    const accumulatedErrors: Array<{ rowNumber: number; name: string; error: string }> = [];

    try {
      for (let i = 0; i < totalRows; i += chunkSize) {
        const chunk = rowsToImport.slice(i, i + chunkSize);
        const currentBatch = Math.min(i + chunkSize, totalRows);

        setProgressPercentage(Math.round((i / totalRows) * 90) + 5);
        setProgressMessage(`Procesando insumos ${i + 1} a ${currentBatch} de ${totalRows}...`);

        const res = await importIngredientsBatchAction(businessId, chunk, locationId || null);

        if (res.success && res.data) {
          totalCreated += res.data.createdCount;
          totalUpdated += res.data.updatedCount;
          totalFailed += res.data.failedCount;
          if (res.data.errors) {
            accumulatedErrors.push(...res.data.errors);
          }
        } else {
          totalFailed += chunk.length;
          accumulatedErrors.push({
            rowNumber: i + 1,
            name: `Lote ${i + 1}-${currentBatch}`,
            error: res.error || "Error al procesar bloque",
          });
        }
      }

      setProgressPercentage(100);
      setProgressMessage("¡Importación finalizada con éxito!");

      if (totalCreated > 0 || totalUpdated > 0) {
        toast.success(
          `Importación masiva completada: ${totalCreated} creados, ${totalUpdated} actualizados.${
            totalFailed > 0 ? ` (${totalFailed} no pudieron ser procesados).` : ""
          }`
        );
        onSuccess();
        setTimeout(() => {
          handleClose();
        }, 800);
      } else {
        toast.error("No se pudo importar ningún ingrediente.", {
          description: accumulatedErrors[0]?.error || "Revisa los registros con errores.",
        });
      }
    } catch (err: any) {
      toast.error("Error durante la importación: " + (err.message || "Error desconocido"));
    } finally {
      setIsImporting(false);
    }
  };

  // Filtrado de filas en la tabla de previsualización
  const displayedRows = useMemo(() => {
    if (!parsedResult) return [];
    if (filterTab === "valid") return parsedResult.validRows;
    if (filterTab === "invalid") return parsedResult.invalidRows;
    return [...parsedResult.validRows, ...parsedResult.invalidRows].sort(
      (a, b) => a.rowNumber - b.rowNumber
    );
  }, [parsedResult, filterTab]);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-4xl bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Importar ingredientes
                </h3>
                <p className="text-xs text-muted-foreground">
                  Carga masiva para subir CSV o Excel (.xlsx, .xls) con materias primas, unidades y costos base.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={isImporting}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer text-sm font-bold flex items-center justify-center w-8 h-8"
              title="Cerrar modal"
              aria-label="Cerrar modal"
            >
              ✕
            </button>
          </div>

          {/* Cuerpo */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Barra de acción: Descargar Plantilla y Ubicación */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground block">
                  Plantilla de importación masiva
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Incluye las columnas estándar requeridas y datos de ejemplo para alimentos, bebidas y empaques.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadExcelTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-600/20 text-xs font-semibold hover:bg-emerald-600/20 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar plantilla (.xlsx)
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCSVTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                  Descargar CSV (.csv)
                </button>
              </div>
            </div>

            {/* Selector de archivo / Zona Drag & Drop Interactiva */}
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => {
                  if (!isImporting && !isValidating) {
                    fileInputRef.current?.click();
                  }
                }}
                className={`p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-primary bg-primary/10 ring-4 ring-primary/20 scale-[1.005]"
                    : file
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                {isValidating ? (
                  <div className="py-4 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      Analizando y validando estructura del archivo...
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Verificando nombres, unidades de medida y autogeneración de categorías.
                    </span>
                  </div>
                ) : file ? (
                  <div className="py-2 flex flex-col items-center justify-center gap-2">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                      <FileSpreadsheet className="w-8 h-8" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-foreground block">
                        {file.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB • Haz clic o arrastra otro archivo para reemplazar
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="mt-1 px-3 py-1 rounded-lg bg-card border border-border text-xs font-semibold text-foreground hover:bg-muted"
                    >
                      Seleccionar otro archivo
                    </button>
                  </div>
                ) : (
                  <div className="py-3 flex flex-col items-center justify-center gap-2">
                    <div className="p-3.5 rounded-2xl bg-primary/10 text-primary mb-1">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm font-bold text-foreground block">
                        Arrastra y suelta tu archivo aquí, o usa el explorador
                      </span>
                      <p className="text-xs text-muted-foreground max-w-md mx-auto">
                        Soporta archivos <strong>CSV (.csv)</strong> o <strong>Excel (.xlsx, .xls)</strong>.
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Seleccionar archivo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Barra de Progreso Interactiva durante la importación */}
            {isImporting && (
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-primary flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {progressMessage}
                  </span>
                  <span className="font-extrabold text-foreground">
                    {progressPercentage}%
                  </span>
                </div>

                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            )}

            {/* Previsualización y Análisis de Filas */}
            {parsedResult && !isImporting && (
              <div className="space-y-4 pt-1">
                {/* KPIs de Análisis */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl border border-border bg-card">
                    <span className="text-[11px] text-muted-foreground block">Total Filas</span>
                    <span className="text-base font-bold text-foreground mt-0.5 block">
                      {parsedResult.totalRows}
                    </span>
                    <span className="text-[10px] text-muted-foreground">registros detectados</span>
                  </div>

                  <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                      Filas Válidas
                    </span>
                    <span className="text-base font-bold text-foreground mt-0.5 block">
                      {parsedResult.validRows.length}
                    </span>
                    <span className="text-[10px] text-muted-foreground">listas para importar</span>
                  </div>

                  <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5">
                    <span className="text-[11px] text-red-600 dark:text-red-400 font-semibold block">
                      Con Errores
                    </span>
                    <span className="text-base font-bold text-foreground mt-0.5 block">
                      {parsedResult.invalidRows.length}
                    </span>
                    <span className="text-[10px] text-muted-foreground">requieren corrección</span>
                  </div>

                  <div className="p-3 rounded-xl border border-border bg-card">
                    <span className="text-[11px] text-muted-foreground block">Categorías Nuevas</span>
                    <span className="text-base font-bold text-primary mt-0.5 block">
                      {parsedResult.newCategoriesCount}
                    </span>
                    <span className="text-[10px] text-muted-foreground">se autogenerarán</span>
                  </div>
                </div>

                {/* Filtro de Pestañas de Previsualización */}
                <div className="flex items-center justify-between border-b border-border pb-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFilterTab("all")}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                        filterTab === "all"
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Todas ({parsedResult.totalRows})
                    </button>

                    <button
                      type="button"
                      onClick={() => setFilterTab("valid")}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                        filterTab === "valid"
                          ? "bg-emerald-600 text-white"
                          : "text-muted-foreground hover:text-emerald-600"
                      }`}
                    >
                      Válidas ({parsedResult.validRows.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setFilterTab("invalid")}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                        filterTab === "invalid"
                          ? "bg-red-600 text-white"
                          : "text-muted-foreground hover:text-red-600"
                      }`}
                    >
                      Con Errores ({parsedResult.invalidRows.length})
                    </button>
                  </div>

                  {locations.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground font-medium">Sede:</span>
                      <Select
                        selectSize="sm"
                        value={locationId}
                        onChange={(e) => setLocationId(e.target.value)}
                        className="w-36"
                      >
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>

                {/* Tabla de Previsualización */}
                <div className="border border-border rounded-xl overflow-hidden text-xs max-h-56 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-muted/40 text-muted-foreground font-semibold sticky top-0 border-b border-border">
                      <tr>
                        <th className="py-2 px-3 w-12 text-center">#</th>
                        <th className="py-2 px-3">Nombre</th>
                        <th className="py-2 px-3">Categoría</th>
                        <th className="py-2 px-3 text-center">Unidad</th>
                        <th className="py-2 px-3 text-right">Costo</th>
                        <th className="py-2 px-3 text-right">Stock</th>
                        <th className="py-2 px-3 text-center">Canales</th>
                        <th className="py-2 px-3">Estado / Observaciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {displayedRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-muted-foreground">
                            No hay registros para mostrar en esta pestaña.
                          </td>
                        </tr>
                      ) : (
                        displayedRows.map((row, idx) => (
                          <tr
                            key={idx}
                            className={`hover:bg-muted/20 transition-colors ${
                              !row.isValid ? "bg-red-500/5" : ""
                            }`}
                          >
                            <td className="py-2 px-3 text-center text-muted-foreground font-mono text-[11px]">
                              {row.rowNumber}
                            </td>
                            <td className="py-2 px-3 font-medium text-foreground max-w-[180px] truncate">
                              {row.name || <span className="text-red-500 italic">Sin nombre</span>}
                            </td>
                            <td className="py-2 px-3 max-w-[130px] truncate">
                              {row.categoryName ? (
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                    row.isNewCategory
                                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                  title={
                                    row.isNewCategory
                                      ? "Categoría nueva: se creará automáticamente"
                                      : "Categoría existente"
                                  }
                                >
                                  {row.isNewCategory && <FolderPlus className="w-3 h-3" />}
                                  {row.categoryName}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted/50 text-foreground font-bold">
                                {row.unit}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-foreground">
                              ${row.cost.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-muted-foreground">
                              {row.stock} {row.unit}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="inline-flex items-center gap-1">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    row.mostrarEnPos ? "bg-emerald-500" : "bg-muted"
                                  }`}
                                  title={row.mostrarEnPos ? "Visible en POS" : "Oculto en POS"}
                                />
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    row.mostrarEnQr ? "bg-blue-500" : "bg-muted"
                                  }`}
                                  title={row.mostrarEnQr ? "Visible en Menú QR" : "Oculto en QR"}
                                />
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    row.mostrarEnMesas ? "bg-amber-500" : "bg-muted"
                                  }`}
                                  title={row.mostrarEnMesas ? "Visible en Mesas" : "Oculto en Mesas"}
                                />
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    row.mostrarEnDomicilios ? "bg-purple-500" : "bg-muted"
                                  }`}
                                  title={row.mostrarEnDomicilios ? "Visible en Domicilios" : "Oculto en Domicilios"}
                                />
                              </div>
                            </td>
                            <td className="py-2 px-3 text-[11px]">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {row.action === "update" ? "Actualizar" : "Crear"}
                                </span>
                              ) : (
                                <div className="text-red-500 space-y-0.5 font-medium">
                                  {row.errors.map((err, eIdx) => (
                                    <div key={eIdx} className="flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3 shrink-0" />
                                      <span>{err}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
            <button
              type="button"
              onClick={handleClose}
              disabled={isImporting}
              className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={!parsedResult || parsedResult.validRows.length === 0 || isImporting}
              className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importando ({progressPercentage}%)...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>
                    Importar {parsedResult ? parsedResult.validRows.length : 0} Ingredientes
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
