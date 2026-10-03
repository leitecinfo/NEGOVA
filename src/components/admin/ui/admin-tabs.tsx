"use client";

import React from "react";

export interface AdminTabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface AdminTabsProps<T extends string = string> {
  tabs: AdminTabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
  size?: "sm" | "md";
}

export function AdminTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = "",
  size = "md",
}: AdminTabsProps<T>) {
  return (
    <div
      className={`inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 shrink-0 overflow-x-auto ${className}`}
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
              size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
            } ${
              isActive
                ? "bg-[#ED500A] text-white shadow-2xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            } ${tab.disabled ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
