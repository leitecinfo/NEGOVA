"use client";

import React, { useState, useEffect } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Button, Input } from "@/components/ui";
import { Printer, X, Wifi, Usb, Bluetooth, Server, Check } from "lucide-react";
import { PrinterConfig, PrinterType, PrinterConnectionType, PrinterStatus } from "@/lib/printing/types";

interface PrinterFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (printer: PrinterConfig) => void;
  editingPrinter?: PrinterConfig | null;
}

export function PrinterFormModal({
  isOpen,
  onClose,
  onSave,
  editingPrinter,
}: PrinterFormModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PrinterType>("thermal_80mm");
  const [connection, setConnection] = useState<PrinterConnectionType>("usb");
  const [ipAddress, setIpAddress] = useState("");
  const [port, setPort] = useState(9100);
  const [status, setStatus] = useState<PrinterStatus>("active");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (editingPrinter) {
      setName(editingPrinter.name);
      setType(editingPrinter.type);
      setConnection(editingPrinter.connection);
      setIpAddress(editingPrinter.ipAddress || "");
      setPort(editingPrinter.port || 9100);
      setStatus(editingPrinter.status);
      setNotes(editingPrinter.notes || "");
    } else {
      setName("");
      setType("thermal_80mm");
      setConnection("usb");
      setIpAddress("");
      setPort(9100);
      setStatus("active");
      setNotes("");
    }
  }, [editingPrinter, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const printer: PrinterConfig = {
      id: editingPrinter?.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `printer-${Date.now()}`),
      name: name.trim(),
      type,
      connection,
      ipAddress: connection === "network" ? ipAddress.trim() || undefined : undefined,
      port: connection === "network" ? Number(port) || 9100 : undefined,
      status,
      notes: notes.trim() || undefined,
      createdAt: editingPrinter?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(printer);
    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingPrinter ? "Editar Impresora" : "Registrar Nueva Impresora"}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Configura el dispositivo térmico o de red de tu comercio
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
            {/* Nombre */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nombre de la impresora <span className="text-red-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Epson TM-T20III Mostrador, Bixolon Cocina"
                required
                autoFocus
              />
              <p className="text-[11px] text-slate-400">
                Un nombre reconocible para asignar a tus puntos de venta o cocina.
              </p>
            </div>

            {/* Tipo de Impresora */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tipo y formato de papel
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "thermal_80mm", label: "Térmica 80 mm", desc: "Estándar POS" },
                  { id: "thermal_58mm", label: "Térmica 58 mm", desc: "Portátil" },
                  { id: "sheet_letter", label: "Carta / A4", desc: "Oficina" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setType(opt.id as PrinterType)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      type === opt.id
                        ? "bg-orange-50/50 dark:bg-orange-500/10 border-orange-500 text-slate-900 dark:text-white ring-1 ring-orange-500/30"
                        : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className="text-xs font-bold leading-tight">{opt.label}</div>
                    <div className="text-[10px] text-slate-400">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Conexión */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tipo de conexión
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "usb", label: "USB / Directo", icon: Usb },
                  { id: "network", label: "Red / Wi-Fi", icon: Wifi },
                  { id: "bluetooth", label: "Bluetooth", icon: Bluetooth },
                ].map((conn) => {
                  const ConnIcon = conn.icon;
                  return (
                    <button
                      key={conn.id}
                      type="button"
                      onClick={() => setConnection(conn.id as PrinterConnectionType)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        connection === conn.id
                          ? "bg-orange-50/50 dark:bg-orange-500/10 border-orange-500 text-slate-900 dark:text-white ring-1 ring-orange-500/30"
                          : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                      }`}
                    >
                      <ConnIcon className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span className="text-xs font-medium">{conn.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Parámetros de Red si conexión === network */}
            {connection === "network" && (
              <div className="p-3 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-xl space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Dirección IP
                    </label>
                    <Input
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Puerto
                    </label>
                    <Input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(Number(e.target.value))}
                      placeholder="9100"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  Puerto 9100 es el estándar común (Raw JetDirect) en impresoras térmicas Epson, Star y Bixolon.
                </p>
              </div>
            )}

            {/* Estado */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-white">Estado de la impresora</span>
                <p className="text-[11px] text-slate-400">Disponible para asociar a estaciones de impresión</p>
              </div>
              <div className="inline-flex rounded-lg bg-slate-200/60 dark:bg-white/10 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStatus("active")}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    status === "active"
                      ? "bg-emerald-500 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Activa
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("inactive")}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    status === "inactive"
                      ? "bg-slate-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Inactiva
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-white/5">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingPrinter ? "Guardar Cambios" : "Registrar Impresora"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

