"use client";

import React, { useMemo } from "react";
import type { TableShape } from "@/lib/restaurant/types";

interface ChairPos {
  x: number;
  y: number;
  rotation: number;
}

export interface TableBlueprintIllustrationProps {
  shape?: TableShape;
  capacity?: number;
  status?: "available" | "occupied";
  tableNumber: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showDinersCount?: boolean;
}

export function TableBlueprintIllustration({
  shape = "square",
  capacity = 4,
  status = "available",
  tableNumber,
  className = "",
  size = "md",
  showDinersCount = false,
}: TableBlueprintIllustrationProps) {
  const cap = Math.max(1, Math.min(16, capacity || 4));
  const isOccupied = status === "occupied";

  // Dimensiones del contenedor
  const dimensionClass = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
    xl: "w-40 h-40",
  }[size];

  // Cálculo de sillas según forma y capacidad
  const chairs = useMemo<ChairPos[]>(() => {
    const list: ChairPos[] = [];

    if (shape === "round") {
      const radius = 37;
      for (let i = 0; i < cap; i++) {
        const angleRad = (2 * Math.PI * i) / cap - Math.PI / 2;
        const x = 50 + radius * Math.cos(angleRad);
        const y = 50 + radius * Math.sin(angleRad);
        const rotation = (angleRad * 180) / Math.PI + 90;
        list.push({ x, y, rotation });
      }
      return list;
    }

    if (shape === "square") {
      if (cap <= 2) {
        list.push({ x: 50, y: 16, rotation: 0 });
        list.push({ x: 50, y: 84, rotation: 180 });
      } else if (cap === 3) {
        list.push({ x: 50, y: 16, rotation: 0 });
        list.push({ x: 16, y: 50, rotation: 270 });
        list.push({ x: 84, y: 50, rotation: 90 });
      } else if (cap === 4) {
        list.push({ x: 50, y: 16, rotation: 0 });
        list.push({ x: 84, y: 50, rotation: 90 });
        list.push({ x: 50, y: 84, rotation: 180 });
        list.push({ x: 16, y: 50, rotation: 270 });
      } else {
        // 5 a 8 sillas
        list.push({ x: 38, y: 16, rotation: 0 });
        list.push({ x: 62, y: 16, rotation: 0 });
        list.push({ x: 38, y: 84, rotation: 180 });
        list.push({ x: 62, y: 84, rotation: 180 });
        list.push({ x: 16, y: 50, rotation: 270 });
        list.push({ x: 84, y: 50, rotation: 90 });
        if (cap >= 7) list.push({ x: 16, y: 34, rotation: 270 });
        if (cap >= 8) list.push({ x: 84, y: 66, rotation: 90 });
      }
      return list;
    }

    if (shape === "rectangle") {
      if (cap <= 4) {
        list.push({ x: 38, y: 17, rotation: 0 });
        list.push({ x: 62, y: 17, rotation: 0 });
        list.push({ x: 38, y: 83, rotation: 180 });
        list.push({ x: 62, y: 83, rotation: 180 });
      } else if (cap <= 6) {
        list.push({ x: 38, y: 17, rotation: 0 });
        list.push({ x: 62, y: 17, rotation: 0 });
        list.push({ x: 38, y: 83, rotation: 180 });
        list.push({ x: 62, y: 83, rotation: 180 });
        list.push({ x: 12, y: 50, rotation: 270 });
        list.push({ x: 88, y: 50, rotation: 90 });
      } else {
        // 7 o más
        list.push({ x: 30, y: 17, rotation: 0 });
        list.push({ x: 50, y: 17, rotation: 0 });
        list.push({ x: 70, y: 17, rotation: 0 });
        list.push({ x: 30, y: 83, rotation: 180 });
        list.push({ x: 50, y: 83, rotation: 180 });
        list.push({ x: 70, y: 83, rotation: 180 });
        list.push({ x: 12, y: 50, rotation: 270 });
        list.push({ x: 88, y: 50, rotation: 90 });
      }
      return list;
    }

    if (shape === "bar") {
      // Barra con taburetes alineados
      const stoolCount = Math.max(2, Math.min(6, cap));
      const step = 60 / (stoolCount + 1);
      for (let i = 1; i <= stoolCount; i++) {
        list.push({ x: 20 + i * step, y: 68, rotation: 180 });
      }
      return list;
    }

    return list;
  }, [shape, cap]);

  // Colores y estilos arquitectónicos
  const colors = isOccupied
    ? {
        tableFill: "fill-rose-950/60 dark:fill-rose-950/70",
        tableStroke: "stroke-red-500 dark:stroke-red-500",
        tableStrokeWidth: "2",
        tableShadow: "drop-shadow(0 2px 8px rgba(239, 68, 68, 0.35))",
        chairFill: "fill-red-600/30 dark:fill-red-500/40",
        chairStroke: "stroke-red-400 dark:stroke-red-400",
        text: "fill-white font-bold",
        dot: "fill-red-500",
      }
    : {
        tableFill: "fill-slate-100 dark:fill-[#121622]",
        tableStroke: "stroke-slate-300 dark:stroke-white/20",
        tableStrokeWidth: "1.5",
        tableShadow: "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1))",
        chairFill: "fill-slate-200/60 dark:fill-white/[0.05]",
        chairStroke: "stroke-slate-400 dark:stroke-white/30",
        text: "fill-slate-700 dark:fill-slate-200 font-bold",
        dot: "fill-emerald-500",
      };

  // Formato del número a mostrar
  const displayNum = useMemo(() => {
    const clean = tableNumber.replace(/[^0-9]/g, "");
    if (clean) return clean;
    return tableNumber.slice(0, 3).toUpperCase();
  }, [tableNumber]);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${dimensionClass} ${className}`}
      style={{ filter: colors.tableShadow }}
      title={`${tableNumber} - ${shape} (${cap} sillas)`}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* SILLAS ARQUITECTÓNICAS */}
        <g id="chairs">
          {chairs.map((chair, idx) => {
            if (shape === "bar") {
              // Taburete circular
              return (
                <g key={idx} transform={`translate(${chair.x}, ${chair.y})`}>
                  <circle
                    r="5"
                    className={`${colors.chairFill} ${colors.chairStroke}`}
                    strokeWidth="1.2"
                  />
                  <circle
                    r="2.5"
                    className="fill-none stroke-white/20"
                    strokeWidth="0.8"
                  />
                </g>
              );
            }

            // Silla de restaurante arquitectónica con asiento y respaldo curvo
            return (
              <g
                key={idx}
                transform={`translate(${chair.x}, ${chair.y}) rotate(${chair.rotation})`}
              >
                {/* Asiento */}
                <rect
                  x="-6"
                  y="-4"
                  width="12"
                  height="8"
                  rx="2.5"
                  className={`${colors.chairFill} ${colors.chairStroke}`}
                  strokeWidth="1.2"
                />
                {/* Respaldo curvado */}
                <path
                  d="M -7 -4 Q 0 -7 7 -4"
                  fill="none"
                  className={colors.chairStroke}
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </g>

        {/* TABLERO DE LA MESA */}
        <g id="table-surface">
          {shape === "round" && (
            <circle
              cx="50"
              cy="50"
              r="23"
              className={`${colors.tableFill} ${colors.tableStroke}`}
              strokeWidth={colors.tableStrokeWidth}
            />
          )}

          {shape === "square" && (
            <rect
              x="28"
              y="28"
              width="44"
              height="44"
              rx="8"
              className={`${colors.tableFill} ${colors.tableStroke}`}
              strokeWidth={colors.tableStrokeWidth}
            />
          )}

          {shape === "rectangle" && (
            <rect
              x="18"
              y="29"
              width="64"
              height="42"
              rx="7"
              className={`${colors.tableFill} ${colors.tableStroke}`}
              strokeWidth={colors.tableStrokeWidth}
            />
          )}

          {shape === "bar" && (
            <g>
              <rect
                x="14"
                y="30"
                width="72"
                height="22"
                rx="6"
                className={`${colors.tableFill} ${colors.tableStroke}`}
                strokeWidth={colors.tableStrokeWidth}
              />
              {/* Línea decorativa del mostrador */}
              <line
                x1="18"
                y1="34"
                x2="82"
                y2="34"
                className="stroke-white/10"
                strokeWidth="1"
              />
            </g>
          )}

          {/* Textura o bisel interior sutil */}
          {shape === "round" ? (
            <circle
              cx="50"
              cy="50"
              r="19"
              fill="none"
              className="stroke-black/5 dark:stroke-white/5"
              strokeWidth="0.8"
            />
          ) : (
            <rect
              x={shape === "rectangle" ? "21" : shape === "bar" ? "17" : "31"}
              y={shape === "rectangle" ? "32" : shape === "bar" ? "33" : "31"}
              width={shape === "rectangle" ? "58" : shape === "bar" ? "66" : "38"}
              height={shape === "rectangle" ? "36" : shape === "bar" ? "16" : "38"}
              rx="5"
              fill="none"
              className="stroke-black/5 dark:stroke-white/5"
              strokeWidth="0.8"
            />
          )}
        </g>

        {/* NÚMERO / NOMBRE DE LA MESA */}
        <text
          x="50"
          y={shape === "bar" ? "44" : "54"}
          textAnchor="middle"
          dominantBaseline="central"
          className={`${colors.text} font-mono`}
          fontSize={displayNum.length > 2 ? "11" : "13"}
          letterSpacing="-0.5px"
        >
          {displayNum}
        </text>

        {/* INDICADOR DE ESTADO (Punto LED luminoso) */}
        <circle
          cx={shape === "rectangle" ? "76" : shape === "bar" ? "80" : "66"}
          cy={shape === "rectangle" ? "35" : shape === "bar" ? "35" : "34"}
          r="2.2"
          className={colors.dot}
        />
      </svg>
    </div>
  );
}
