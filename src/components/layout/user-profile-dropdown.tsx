'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  User,
  Settings,
  LayoutGrid,
  BookOpen,
  Link2,
  CreditCard,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { AdminLogoutModal } from '@/components/admin/admin-logout-modal';

export interface UserProfileData {
  initial: string;
  name: string;
  email: string;
  role: string;
}

interface UserProfileDropdownProps {
  businessId: string;
  userProfile?: UserProfileData;
  onOpenHelp?: () => void;
  className?: string;
}

export function UserProfileDropdown({
  businessId,
  userProfile = {
    initial: 'U',
    name: 'Usuario',
    email: 'usuario@negova.com',
    role: 'Operador',
  },
  onOpenHelp,
  className = '',
}: UserProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const menuOptions = [
    {
      title: 'Perfil',
      subtitle: 'Tu información personal',
      icon: User,
      href: `/workspace/${businessId}/perfil`,
    },
    {
      title: 'Configuración',
      subtitle: 'Ajustes del negocio',
      icon: Settings,
      href: `/workspace/${businessId}/configuracion`,
    },
    {
      title: 'Apps',
      subtitle: 'Integraciones y herramientas',
      icon: LayoutGrid,
      href: `/workspace/${businessId}/configuracion/pagina-enlaces`,
    },
    {
      title: 'Documentación',
      subtitle: 'Guías y ayuda',
      icon: BookOpen,
      href: `/workspace/${businessId}/ayuda`,
      onClick: () => {
        setIsOpen(false);
        onOpenHelp?.();
      },
    },
    {
      title: 'Nuestros Links',
      subtitle: 'Links del negocio',
      icon: Link2,
      href: `/workspace/${businessId}/configuracion/pagina-enlaces`,
    },
    {
      title: 'Suscripción',
      subtitle: 'Ver plan activo',
      icon: CreditCard,
      href: `/workspace/${businessId}/configuracion`,
    },
  ];

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      {/* Botón Disparador / Ficha de Usuario */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all cursor-pointer focus:outline-hidden"
      >
        <div className="w-8 h-8 rounded-full bg-[#ED500A] text-white font-bold text-xs flex items-center justify-center shadow-xs">
          {userProfile.initial || userProfile.name.charAt(0).toUpperCase()}
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-xs font-bold text-slate-900 dark:text-white leading-none">
            {userProfile.name}
          </p>
          <span className="text-[10px] text-slate-400 uppercase font-semibold">
            {userProfile.role}
          </span>
        </div>
      </button>

      {/* Menú Desplegable Superpuesto */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-[#0D0F16] border border-slate-200/90 dark:border-white/[0.08] rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Encabezado del Perfil */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/60 dark:bg-white/[0.02] flex items-center gap-3.5">
            {/* Avatar grande con la letra inicial */}
            <div className="w-12 h-12 rounded-full bg-[#ED500A] text-white font-black text-lg flex items-center justify-center shadow-md shrink-0">
              {userProfile.initial || userProfile.name.charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {userProfile.name}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {userProfile.email}
              </p>
              <div className="mt-1.5">
                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider bg-orange-100 dark:bg-orange-950/40 text-[#ED500A] border border-orange-200 dark:border-orange-800/40 uppercase">
                  {userProfile.role}
                </span>
              </div>
            </div>
          </div>

          {/* Lista de Opciones de Navegación */}
          <div className="p-2 sm:p-2.5 space-y-1">
            {menuOptions.map((opt, idx) => {
              const IconComponent = opt.icon;

              if (opt.onClick) {
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={opt.onClick}
                    className="w-full p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors flex items-center justify-between text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 group-hover:bg-orange-500/10 group-hover:text-[#ED500A] flex items-center justify-center shrink-0 transition-colors">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#ED500A] transition-colors">
                          {opt.title}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                          {opt.subtitle}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-[#ED500A] transition-colors shrink-0" />
                  </button>
                );
              }

              return (
                <Link
                  key={idx}
                  href={opt.href}
                  onClick={() => setIsOpen(false)}
                  className="p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors flex items-center justify-between text-left group cursor-pointer block"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 group-hover:bg-orange-500/10 group-hover:text-[#ED500A] flex items-center justify-center shrink-0 transition-colors">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#ED500A] transition-colors">
                        {opt.title}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                        {opt.subtitle}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-[#ED500A] transition-colors shrink-0" />
                </Link>
              );
            })}
          </div>

          {/* Pie del Menú (Cerrar sesión) */}
          <div className="p-2 sm:p-2.5 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.01]">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsLogoutModalOpen(true);
              }}
              className="w-full p-2.5 rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-400 transition-colors flex items-center gap-3 text-left group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <LogOut className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  Cerrar sesión
                </p>
                <p className="text-[10px] text-rose-400 dark:text-rose-500/80">
                  Salir de tu cuenta de forma segura
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmación de cierre de sesión */}
      <AdminLogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
      />
    </div>
  );
}
