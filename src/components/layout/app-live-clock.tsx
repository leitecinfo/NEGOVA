"use client";

import React, { useState, useEffect } from "react";
import { Clock, Calendar } from "lucide-react";

export function AppLiveClock() {
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
    <div className="hidden xl:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-100/70 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] text-xs text-slate-600 dark:text-slate-300 font-body shadow-2xs">
      <div className="flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-slate-400" />
        <span className="capitalize">{dateStr}</span>
      </div>
      <div className="h-3 w-px bg-slate-300 dark:bg-white/10" />
      <div className="flex items-center gap-1.5 font-mono text-slate-700 dark:text-slate-200">
        <Clock className="w-3.5 h-3.5 text-[#ED500A]" />
        <span>{timeStr}</span>
      </div>
    </div>
  );
}

// Retrocompatibilidad
export { AppLiveClock as AdminLiveClock };
