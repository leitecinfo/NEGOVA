"use client";

import React, { useState, useEffect } from "react";
import { Clock, Calendar } from "lucide-react";

export function AdminLiveClock() {
  const [mounted, setMounted] = useState(false);
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    setMounted(true);

    const updateClock = () => {
      const now = new Date();

      // Hora con formato de Colombia (12h con AM/PM o 24h)
      const timeFormatted = now.toLocaleTimeString("es-CO", {
        timeZone: "America/Bogota",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      // Fecha con formato en español (Ej: Sáb, 5 Sep 2026)
      const dateFormatted = now.toLocaleDateString("es-CO", {
        timeZone: "America/Bogota",
        weekday: "short",
        day: "numeric",
        month: "short",
      });

      setTimeStr(timeFormatted);
      setDateStr(dateFormatted);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return (
      <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] text-xs font-mono text-slate-400 animate-pulse">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span>--:--:--</span>
      </div>
    );
  }

  return (
    <div
      title="Hora oficial de operación NEGOVA (America/Bogota - UTC-5)"
      className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] text-xs select-none transition-colors"
    >
      {/* Fecha */}
      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 capitalize font-medium">
        <Calendar className="w-3.5 h-3.5 text-[#ED500A]" />
        <span>{dateStr}</span>
      </div>

      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />

      {/* Hora en vivo */}
      <div className="flex items-center gap-1.5 font-mono text-slate-800 dark:text-slate-100 font-semibold">
        <Clock className="w-3 h-3 text-emerald-500 animate-pulse" />
        <span className="tabular-nums tracking-tight">{timeStr}</span>
      </div>

      <span className="hidden lg:inline text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-white dark:bg-white/[0.06] px-1.5 py-0.2 rounded border border-slate-200/60 dark:border-white/[0.06]">
        UTC-5
      </span>
    </div>
  );
}
