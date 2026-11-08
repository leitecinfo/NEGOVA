"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCcw,
} from "lucide-react";

export type DatePickerSize = "sm" | "md" | "lg";
export type DatePickerAlign = "left" | "right" | "auto";

export interface DatePickerProps {
  id?: string;
  name?: string;
  label?: React.ReactNode;
  helperText?: string;
  error?: string;
  value?: string; // Formato ISO "YYYY-MM-DD"
  onChange: (value: string) => void;
  min?: string; // "YYYY-MM-DD"
  max?: string; // "YYYY-MM-DD"
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  size?: DatePickerSize;
  align?: DatePickerAlign;
  className?: string;
  containerClassName?: string;
}

const sizeClasses: Record<DatePickerSize, string> = {
  sm: "h-8 text-[11px] rounded-lg",
  md: "h-10 text-xs rounded-xl",
  lg: "h-12 text-sm rounded-xl",
};

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEKDAY_NAMES = ["DO", "LU", "MA", "MI", "JU", "VI", "SÁ"];

/**
 * Parsea "YYYY-MM-DD" a componentes numéricos locales (evitando desfasajes por zona horaria de UTC).
 */
function parseDateString(dateStr?: string): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.split("-").map((p) => parseInt(p, 10));
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return null;
  }
  return { year: parts[0], month: parts[1] - 1, day: parts[2] };
}

/**
 * Formatea año, mes (0-11) y día a string "YYYY-MM-DD".
 */
function formatDateString(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DatePicker({
  id,
  name,
  label,
  helperText,
  error,
  value,
  onChange,
  min,
  max,
  placeholder = "Seleccionar fecha...",
  disabled = false,
  required = false,
  clearable = true,
  size = "md",
  align = "auto",
  className = "",
  containerClassName = "",
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cálculo de coordenadas en pantalla (fixed) para renderizar en document.body (Portal)
  // Esto elimina 100% cualquier problema de overflow:hidden o z-index dentro de modales o formularios
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 288;
    const popoverHeight = 350;

    // 1. Alineación horizontal
    let left = rect.left;
    const spaceRight = window.innerWidth - rect.left;

    if (align === "right" || (align === "auto" && spaceRight < popoverWidth + 16)) {
      left = rect.right - popoverWidth;
    } else {
      left = rect.left;
    }

    // Asegurar que no se desborde fuera de la pantalla horizontalmente
    left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 12));

    // 2. Alineación vertical (detecta si cabe hacia abajo o si debe abrir hacia arriba)
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;
    if (spaceBelow < popoverHeight && spaceAbove > spaceBelow) {
      // Abrir hacia arriba si no hay espacio abajo
      top = rect.top - popoverHeight - 8;
    } else {
      // Abrir hacia abajo por defecto
      top = rect.bottom + 8;
    }

    // Asegurar que quede dentro de la pantalla verticalmente
    top = Math.max(12, Math.min(top, window.innerHeight - popoverHeight - 12));

    setCoords({ top, left });
  }, [align]);

  // Actualizar posición en tiempo real al abrir, redimensionar o hacer scroll en cualquier contenedor
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  // Cerrar al hacer click afuera o presionar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Fecha seleccionada parseada
  const selectedParsed = useMemo(() => parseDateString(value), [value]);

  // Mes y año actualmente mostrados en el calendario
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState<number>(() => selectedParsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => selectedParsed?.month ?? today.getMonth());

  // Sincronizar vista si el valor externo cambia y el popover no está abierto
  useEffect(() => {
    if (selectedParsed) {
      setViewYear(selectedParsed.year);
      setViewMonth(selectedParsed.month);
    }
  }, [value, selectedParsed]);

  // Cerrar al hacer click afuera o presionar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Formato visual legible del valor seleccionado (ej: "07/11/2026")
  const formattedDisplay = useMemo(() => {
    if (!selectedParsed) return "";
    const dayStr = String(selectedParsed.day).padStart(2, "0");
    const monthStr = String(selectedParsed.month + 1).padStart(2, "0");
    return `${dayStr}/${monthStr}/${selectedParsed.year}`;
  }, [selectedParsed]);

  // Navegación de meses
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Cálculo de los días para la cuadrícula del mes
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Domingo
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: {
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isToday: boolean;
      isDisabled: boolean;
    }[] = [];

    // Días del mes previo para completar la primera semana
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dStr = formatDateString(prevYear, prevMonth, dayNum);

      days.push({
        dateString: dStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isSelected: value === dStr,
        isToday: false,
        isDisabled: Boolean((min && dStr < min) || (max && dStr > max)),
      });
    }

    // Días del mes actual
    const todayStr = formatDateString(today.getFullYear(), today.getMonth(), today.getDate());
    for (let i = 1; i <= daysInMonth; i++) {
      const dStr = formatDateString(viewYear, viewMonth, i);
      days.push({
        dateString: dStr,
        dayNumber: i,
        isCurrentMonth: true,
        isSelected: value === dStr,
        isToday: dStr === todayStr,
        isDisabled: Boolean((min && dStr < min) || (max && dStr > max)),
      });
    }

    // Días del mes siguiente para completar la cuadrícula de 6 semanas (42 celdas)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dStr = formatDateString(nextYear, nextMonth, i);

      days.push({
        dateString: dStr,
        dayNumber: i,
        isCurrentMonth: false,
        isSelected: value === dStr,
        isToday: false,
        isDisabled: Boolean((min && dStr < min) || (max && dStr > max)),
      });
    }

    return days;
  }, [viewYear, viewMonth, value, min, max, today]);

  const handleDayClick = (dateStr: string, isDisabled: boolean) => {
    if (isDisabled) return;
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const todayStr = formatDateString(today.getFullYear(), today.getMonth(), today.getDate());
    if ((min && todayStr < min) || (max && todayStr > max)) return;
    onChange(todayStr);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div ref={containerRef} className={`space-y-1.5 relative ${containerClassName}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 font-body">
          {label}
          {required && <span className="text-[#ED500A] ml-1">*</span>}
        </label>
      )}

      {/* Input Trigger Button (Estilo oficial de NEGOVA, NUNCA abre calendario nativo) */}
      <button
        ref={triggerRef}
        id={id}
        name={name}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!isOpen) {
            updatePosition();
          }
          setIsOpen(!isOpen);
        }}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={typeof label === "string" ? label : "Seleccionar fecha"}
        className={`w-full pl-3.5 pr-9 border bg-slate-50/70 dark:bg-[#0B0D14] font-body text-left flex items-center justify-between transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer relative ${
          sizeClasses[size]
        } ${
          error
            ? "border-red-500 focus:ring-red-500/30 focus:border-red-500"
            : isOpen
            ? "border-[#ED500A] ring-2 ring-[#ED500A]/30"
            : "border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
        } ${className}`}
      >
        <div className="flex items-center gap-2.5 truncate pr-2">
          <CalendarIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          {formattedDisplay ? (
            <span className="font-semibold font-mono text-slate-900 dark:text-white">
              {formattedDisplay}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 font-normal">
              {placeholder}
            </span>
          )}
        </div>

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 shrink-0">
          {clearable && value && !disabled && (
            <span
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors"
              title="Borrar fecha"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </button>

      {/* Popover de Calendario Personalizado vía Portal (Completamente inmune a clipping/overflow de modales) */}
      {isOpen && mounted && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            top: coords ? `${coords.top}px` : "auto",
            left: coords ? `${coords.left}px` : "auto",
            zIndex: 99999,
          }}
          className="w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-white dark:bg-[#0D0F16] border border-slate-200/80 dark:border-white/[0.08] shadow-2xl p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-100 font-body select-none"
        >
          {/* Header: Mes, Año y Controles de navegación */}
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white font-title capitalize">
              {MONTH_NAMES[viewMonth]} <span className="font-mono text-[#ED500A]">{viewYear}</span>
            </h4>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Mes anterior"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Mes siguiente"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_NAMES.map((dayName) => (
              <span
                key={dayName}
                className="text-[10px] font-bold text-slate-400 dark:text-slate-500 py-1"
              >
                {dayName}
              </span>
            ))}
          </div>

          {/* Cuadrícula de Días */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              let cellClasses =
                "h-8 w-8 text-xs font-mono font-medium rounded-xl flex items-center justify-center transition-all cursor-pointer";

              if (day.isDisabled) {
                cellClasses += " opacity-20 cursor-not-allowed";
              } else if (day.isSelected) {
                cellClasses += " bg-[#ED500A] text-white font-bold shadow-xs";
              } else if (day.isToday) {
                cellClasses +=
                  " border border-[#ED500A]/40 text-[#ED500A] font-bold bg-orange-50/50 dark:bg-orange-500/10";
              } else if (!day.isCurrentMonth) {
                cellClasses +=
                  " text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-white/[0.02]";
              } else {
                cellClasses +=
                  " text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.08]";
              }

              return (
                <button
                  key={day.dateString}
                  type="button"
                  disabled={day.isDisabled}
                  onClick={() => handleDayClick(day.dateString, day.isDisabled)}
                  className={cellClasses}
                >
                  {day.dayNumber}
                </button>
              );
            })}
          </div>

          {/* Footer de Acciones Rápidas */}
          <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleSelectToday}
              className="text-[#ED500A] hover:text-[#D44405] font-semibold transition-colors cursor-pointer"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>,
        document.body
      )}

      {error ? (
        <p className="text-[11px] text-red-500 font-medium font-body">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-400 font-body">{helperText}</p>
      ) : null}
    </div>
  );
}

