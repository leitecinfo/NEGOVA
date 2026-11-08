"use client";

import React from "react";

export type TabVariant = "pills" | "underline" | "segmented";
export type TabSize = "sm" | "md" | "lg";

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  count?: number | string;
  icon?: React.ReactNode;
  disabled?: boolean;
  badge?: React.ReactNode;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
  variant?: TabVariant;
  size?: TabSize;
  fullWidth?: boolean;
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = "",
  variant = "pills",
  size = "md",
  fullWidth = false,
}: TabsProps<T>) {
  if (variant === "underline") {
    return (
      <div
        className={`flex items-center gap-1 sm:gap-2 border-b border-slate-200/80 dark:border-white/[0.08] overflow-x-auto no-scrollbar shrink-0 ${
          fullWidth ? "w-full" : ""
        } ${className}`}
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={`inline-flex items-center gap-2 pb-2.5 px-3 font-body font-semibold transition-all select-none cursor-pointer whitespace-nowrap border-b-2 -mb-px shrink-0 ${
                size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm"
              } ${
                isActive
                  ? "border-[#ED500A] text-[#ED500A]"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"
              } ${tab.disabled ? "opacity-40 cursor-not-allowed" : ""} ${
                fullWidth ? "flex-1 justify-center" : ""
              }`}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge ? (
                <span className="shrink-0">{tab.badge}</span>
              ) : (
                tab.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold ${
                      isActive
                        ? "bg-[#ED500A]/15 text-[#ED500A]"
                        : "bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                )
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "segmented") {
    return (
      <div
        className={`inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 shrink-0 overflow-x-auto ${
          fullWidth ? "w-full" : ""
        } ${className}`}
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg font-body transition-all select-none cursor-pointer whitespace-nowrap ${
                size === "sm"
                  ? "px-2.5 py-1 text-[11px]"
                  : size === "lg"
                  ? "px-4 py-2 text-sm"
                  : "px-3 py-1.5 text-xs"
              } ${
                isActive
                  ? "bg-[#ED500A] text-white shadow-2xs font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              } ${tab.disabled ? "opacity-40 cursor-not-allowed" : ""} ${
                fullWidth ? "flex-1 justify-center" : ""
              }`}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge ? (
                <span className="shrink-0">{tab.badge}</span>
              ) : (
                tab.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                )
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Variante canónica "pills" (estilo premium Productos: sin contenedor encapsulado, acento suave, badge redondeado)
  return (
    <div
      className={`flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar shrink-0 ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 rounded-xl font-body transition-all select-none cursor-pointer whitespace-nowrap shrink-0 ${
              size === "sm"
                ? "px-3 py-1.5 text-xs rounded-lg"
                : size === "lg"
                ? "px-5 py-2.5 text-base"
                : "px-4 py-2 text-sm font-semibold"
            } ${
              isActive
                ? "bg-[#ED500A]/10 text-[#ED500A] dark:bg-[#ED500A]/20 font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            } ${tab.disabled ? "opacity-40 cursor-not-allowed" : ""} ${
              fullWidth ? "flex-1 justify-center" : ""
            }`}
          >
            {tab.icon && (
              <span className={`shrink-0 ${isActive ? "text-[#ED500A]" : "text-slate-400 dark:text-slate-500"}`}>
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {tab.badge ? (
              <span className="shrink-0">{tab.badge}</span>
            ) : (
              tab.count !== undefined && (
                <span
                  className={`ml-1 text-2xs px-2 py-0.5 rounded-full font-bold ${
                    isActive
                      ? "bg-[#ED500A]/15 text-[#ED500A]"
                      : "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {tab.count}
                </span>
              )
            )}
          </button>
        );
      })}
    </div>
  );
}

// Aliases para retrocompatibilidad total
export const AdminTabs = Tabs;
export type AdminTabItem<T extends string = string> = TabItem<T>;
export type AdminTabsProps<T extends string = string> = TabsProps<T>;
