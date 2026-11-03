"use client";

import React, { useState, useEffect } from "react";
import { ModalPortal } from "@/components/ui/modal-portal";
import { Button, Input } from "@/components/ui";
import { Monitor, X, Printer, Landmark, UtensilsCrossed, Wine, Bike, Check } from "lucide-react";
import {
  PrintingStation,
  PrinterConfig,
  AvailableCashRegister,
  PrintingArea,
} from "@/lib/printing/types";

interface StationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (station: PrintingStation) => void;
  editingStation?: PrintingStation | null;
  printers: PrinterConfig[];
  cashRegisters: AvailableCashRegister[];
}

export function StationFormModal({
  isOpen,
  onClose,
  onSave,
  editingStation,
  printers,
  cashRegisters,
}: StationFormModalProps) {
  const [name, setName] = useState("");
  const [area, setArea] = useState<PrintingArea>("caja");
  const [printerId, setPrinterId] = useState<string>("");
  const [cashRegisterId, setCashRegisterId] = useState<string>("");
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(true);
  const [autoPrintOrderCommand, setAutoPrintOrderCommand] = useState(false);
  const [openCashDrawerOnCashSale, setOpenCashDrawerOnCashSale] = useState(true);
  const [copies, setCopies] = useState(1);

  useEffect(() => {
    if (editingStation) {
      setName(editingStation.name);
      setArea(editingStation.area);
      setPrinterId(editingStation.printerId || "");
      setCashRegisterId(editingStation.cashRegisterId || "");
      setAutoPrintReceipt(editingStation.autoPrintReceipt ?? true);
      setAutoPrintOrderCommand(editingStation.autoPrintOrderCommand ?? false);
      setOpenCashDrawerOnCashSale(editingStation.openCashDrawerOnCashSale ?? true);
      setCopies(editingStation.copies || 1);
    } else {
      setName("");
      setArea("caja");
      setPrinterId(printers[0]?.id || "");
      setCashRegisterId(cashRegisters[0]?.id || "");
      setAutoPrintReceipt(true);
      setAutoPrintOrderCommand(false);
      setOpenCashDrawerOnCashSale(true);
      setCopies(1);
    }
  }, [editingStation, isOpen, printers, cashRegisters]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const matchedRegister = cashRegisters.find((r) => r.id === cashRegisterId);

    const station: PrintingStation = {
      id: editingStation?.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `station-${Date.now()}`),
      name: name.trim(),
      area,
      printerId: printerId || null,
      cashRegisterId: cashRegisterId || null,
      cashRegisterName: matchedRegister?.name || null,
      autoPrintReceipt,
      autoPrintOrderCommand,
      openCashDrawerOnCashSale,
      copies: Number(copies) || 1,
      createdAt: editingStation?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(station);
    onClose();
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div
          role="dialog"
          aria-modal="true"
          className="bg-white dark:bg-[#0D0F16] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
                <Monitor className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {editingStation ? "Editar Estación de Impresión" : "Nueva Estación de Impresión"}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Vincula una impresora física a una caja o área de preparación
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
            {/* Nombre de la Estación */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nombre de la estación <span className="text-red-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Estación Caja Mostrador, Cocina Caliente, Barra"
                required
                autoFocus
              />
            </div>

            {/* Área Operativa */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Área operativa
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "caja", label: "Caja", icon: Landmark },
                  { id: "cocina", label: "Cocina", icon: UtensilsCrossed },
                  { id: "barra", label: "Barra", icon: Wine },
                  { id: "despacho", label: "Despacho", icon: Bike },
                ].map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setArea(opt.id as PrintingArea);
                        if (opt.id === "cocina" || opt.id === "barra") {
                          setAutoPrintReceipt(false);
                          setAutoPrintOrderCommand(true);
                          setOpenCashDrawerOnCashSale(false);
                        } else if (opt.id === "caja") {
                          setAutoPrintReceipt(true);
                          setAutoPrintOrderCommand(false);
                          setOpenCashDrawerOnCashSale(true);
                        }
                      }}
                      className={`flex flex-col items-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        area === opt.id
                          ? "bg-orange-50/50 dark:bg-orange-500/10 border-orange-500 text-slate-900 dark:text-white ring-1 ring-orange-500/30 font-bold"
                          : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
                      }`}
                    >
                      <Icon className="w-4 h-4 mb-1 text-orange-500" />
                      <span className="text-xs">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Impresora asignada */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Impresora asignada <span className="text-red-500">*</span>
              </label>
              {printers.length === 0 ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                  No hay impresoras registradas todavía. Primero registra al menos una impresora en la sección anterior.
                </div>
              ) : (
                <select
                  value={printerId}
                  onChange={(e) => setPrinterId(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none dark:[color-scheme:dark] cursor-pointer"
                >
                  <option value="" disabled>Selecciona una impresora...</option>
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type === "thermal_80mm" ? "80 mm" : p.type === "thermal_58mm" ? "58 mm" : "Carta"} - {p.connection.toUpperCase()})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* VINCULACIÓN A CAJA REGISTRADORA (CRITERIO CONF-002) */}
            <div className="space-y-1.5 p-3 rounded-xl bg-orange-50/40 dark:bg-orange-500/5 border border-orange-500/20">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <label className="text-xs font-bold text-slate-900 dark:text-white">
                  Vincular a Caja Registradora
                </label>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Al asignar esta estación a una caja, los cobros registrados en dicha caja imprimirán automáticamente en esta impresora.
              </p>
              <select
                value={cashRegisterId}
                onChange={(e) => setCashRegisterId(e.target.value)}
                className="w-full bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none dark:[color-scheme:dark] cursor-pointer"
              >
                <option value="">Sin vincular a caja específica (General)</option>
                {cashRegisters.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.name} {reg.isActive ? "(Activa)" : "(Inactiva)"}
                  </option>
                ))}
              </select>
            </div>

            {/* Automatizaciones de Impresión */}
            <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5">
              <span className="text-xs font-semibold text-slate-800 dark:text-white block">
                Comportamiento automático
              </span>

              {/* Auto Imprimir Ticket */}
              <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <span>Imprimir ticket de venta al registrar cobro</span>
                <input
                  type="checkbox"
                  checked={autoPrintReceipt}
                  onChange={(e) => setAutoPrintReceipt(e.target.checked)}
                  className="rounded text-orange-500 focus:ring-orange-500 cursor-pointer w-4 h-4"
                />
              </label>

              {/* Auto Imprimir Comanda */}
              <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <span>Imprimir comanda al confirmar pedido/cocina</span>
                <input
                  type="checkbox"
                  checked={autoPrintOrderCommand}
                  onChange={(e) => setAutoPrintOrderCommand(e.target.checked)}
                  className="rounded text-orange-500 focus:ring-orange-500 cursor-pointer w-4 h-4"
                />
              </label>

              {/* Abrir cajón monedero */}
              <label className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <span>Disparar apertura de cajón en pagos en efectivo</span>
                <input
                  type="checkbox"
                  checked={openCashDrawerOnCashSale}
                  onChange={(e) => setOpenCashDrawerOnCashSale(e.target.checked)}
                  className="rounded text-orange-500 focus:ring-orange-500 cursor-pointer w-4 h-4"
                />
              </label>
            </div>

            {/* Copias */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-white">Número de copias</span>
                <p className="text-[11px] text-slate-400">Copias a generar en cada disparo</p>
              </div>
              <select
                value={copies}
                onChange={(e) => setCopies(Number(e.target.value))}
                className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none dark:[color-scheme:dark] cursor-pointer"
              >
                <option value={1}>1 copia</option>
                <option value={2}>2 copias</option>
                <option value={3}>3 copias</option>
              </select>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-white/5">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingStation ? "Guardar Cambios" : "Guardar Estación"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

