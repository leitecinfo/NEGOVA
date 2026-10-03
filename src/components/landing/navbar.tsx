"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  ArrowUpRight,
  ChevronDown,
  Utensils,
  ShoppingBag,
  Briefcase,
  Store,
  ShoppingCart,
  Boxes,
  Receipt,
  Users,
  BarChart3,
  LayoutDashboard,
  Shield,
  LogOut,
} from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { AdminLogoutModal } from "@/components/admin/admin-logout-modal";
import { createClient } from "@/lib/supabase/client";

// Data para Categorías Mega-Dropdown
const CATEGORIAS_MENU = [
  {
    name: "Gastronómicos",
    href: "/categorias/gastronomicos",
    icon: Utensils,
    description: "Restaurantes, cafeterías, panaderías, comidas rápidas y gastrobares.",
  },
  {
    name: "Comercio",
    href: "/categorias/comercio",
    icon: ShoppingBag,
    description: "Tiendas, ferreterías, ropa, tecnología, papelerías y comercios.",
  },
  {
    name: "Servicios",
    href: "/categorias/servicios",
    icon: Briefcase,
    description: "Gimnasios, barberías, peluquerías, talleres, academias y spas.",
  },
  {
    name: "Mercados",
    href: "/categorias/mercados",
    icon: Store,
    description: "Minimercados, tiendas de barrio, fruterías, carnicerías y distribuidores.",
  },
];

// Data para Funcionalidades Mega-Dropdown (6 capacidades clave organizadas en 2 columnas con enlace a /funcionalidades)
const FUNCIONALIDADES_MENU = [
  {
    name: "Control de inventarios",
    href: "/funcionalidades/inventario",
    icon: Boxes,
    description: "Control de existencias y alertas automáticas de bajo stock.",
  },
  {
    name: "Registro de ventas y gastos",
    href: "/funcionalidades/ventas-pos",
    icon: ShoppingCart,
    description: "Punto de venta intuitivo y registro de movimientos diarios.",
  },
  {
    name: "Reportes y estadísticas",
    href: "/funcionalidades/reportes",
    icon: BarChart3,
    description: "Datos útiles y balances reales para tomar mejores decisiones.",
  },
  {
    name: "Catálogo de productos",
    href: "/funcionalidades/catalogo",
    icon: Store,
    description: "Organización por categorías, precios y variantes de producto.",
  },
  {
    name: "Gestión de clientes y fiados",
    href: "/funcionalidades/clientes-fiados",
    icon: Users,
    description: "Historial de clientes y control de deudas sin cuadernos.",
  },
  {
    name: "Arqueo y control de caja",
    href: "/funcionalidades/arqueo-caja",
    icon: Receipt,
    description: "Registro de dinero en caja, entradas y salidas de efectivo.",
  },
];

// Enlace directo a WhatsApp con mensaje predefinido
const WHATSAPP_PHONE_NUMBER = "573114245409";
const WHATSAPP_PREFILLED_MESSAGE =
  "Hola NEGOVA, quiero comenzar ahora con mi negocio y obtener información sobre la plataforma y la prueba gratuita de 30 días.";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_PREFILLED_MESSAGE
)}`;

interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  roleLabel: string;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  dashboardUrl: string;
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<"categorias" | "funcionalidades" | null>(null);
  const [mobileCategoriasOpen, setMobileCategoriasOpen] = useState(false);
  const [mobileFuncionalidadesOpen, setMobileFuncionalidadesOpen] = useState(false);

  // Estado de usuario autenticado
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Bloquear scroll cuando menú móvil está abierto
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileMenuOpen]);

  // Cargar sesión del usuario y escuchar cambios
  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    const fetchSession = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.authenticated && data.user) {
              setUser(data.user);
            } else {
              setUser(null);
            }
          }
        }
      } catch (err) {
        if (isMounted) setUser(null);
      }
    };

    fetchSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchSession();
      } else {
        if (isMounted) setUser(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Cerrar menú de usuario al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  const handleMouseEnter = (menu: "categorias" | "funcionalidades") => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveDropdown(menu);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 150);
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href.startsWith("/#")) return false;
    return pathname.startsWith(href);
  };

  return (
    <>
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-300 ease-in-out ${
          scrolled
            ? "py-3 bg-white/90 dark:bg-[#0B0E14]/90 backdrop-blur-md border-b border-[#0B0E14]/5 dark:border-white/10 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.03)]"
            : "py-5 bg-transparent border-b border-transparent"
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 flex items-center justify-between">
          
          {/* IZQUIERDA: LOGO NEGOVA */}
          <div className="flex items-center">
            <Link
              href="/"
              className="group flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ED500A] focus-visible:ring-offset-2 rounded-sm"
              aria-label="NEGOVA Inicio"
            >
              <div className="relative w-8 h-8 flex items-center justify-center transition-transform duration-200 group-hover:scale-[1.02]">
                <Image
                  src="/isotipo.png"
                  alt="Isotipo NEGOVA"
                  width={32}
                  height={32}
                  className="object-contain rounded-[4px]"
                  priority
                />
              </div>
              <span className="font-title font-extrabold text-xl tracking-tight text-[#0B0E14] dark:text-white uppercase">
                NEGOVA
              </span>
            </Link>
          </div>

          {/* CENTRO: NAVEGACIÓN DESKTOP CON DESPLEGABLES DE ALTA GAMA */}
          <nav
            aria-label="Navegación principal"
            className="hidden md:flex items-center gap-8 lg:gap-10"
          >
            <Link
              href="/"
              className={`relative text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ED500A] rounded-sm py-1 ${
                isActive("/")
                  ? "text-[#ED500A] font-semibold"
                  : "text-[#0B0E14]/70 dark:text-white/70 hover:text-[#0B0E14] dark:hover:text-white"
              }`}
            >
              Inicio
            </Link>

            {/* MEGA-DROPDOWN 1: CATEGORÍAS */}
            <div
              className="relative"
              onMouseEnter={() => handleMouseEnter("categorias")}
              onMouseLeave={handleMouseLeave}
            >
              <button
                aria-expanded={activeDropdown === "categorias"}
                className="inline-flex items-center gap-1.5 text-sm font-medium py-1 text-[#0B0E14]/70 dark:text-white/70 hover:text-[#0B0E14] dark:hover:text-white transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ED500A] rounded-sm cursor-pointer"
              >
                <span>Categorías</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    activeDropdown === "categorias" ? "rotate-180 text-[#ED500A]" : ""
                  }`}
                />
              </button>

              {activeDropdown === "categorias" && (
                <div
                  onMouseEnter={() => handleMouseEnter("categorias")}
                  onMouseLeave={handleMouseLeave}
                  className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-[560px] animate-fade-in z-50"
                >
                  <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-2xl text-[#0B0E14]">
                    <div className="px-3 py-2 border-b border-slate-100 mb-2">
                      <span className="font-mono text-[10.5px] font-bold text-[#ED500A] uppercase tracking-wider">
                        SECTORES Y VERTICALES
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORIAS_MENU.map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <Link
                            key={cat.name}
                            href={cat.href}
                            onClick={() => setActiveDropdown(null)}
                            className="group p-3 rounded-2xl hover:bg-[#F8F9FD] transition-colors flex items-start gap-3 border border-transparent hover:border-slate-200/80"
                          >
                            <div className="p-2 rounded-xl bg-[#ED500A]/10 text-[#ED500A] group-hover:bg-[#ED500A] group-hover:text-white transition-colors shrink-0">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-title font-bold text-sm text-[#0B0E14] group-hover:text-[#ED500A] transition-colors">
                                {cat.name}
                              </h4>
                              <p className="font-body text-xs text-slate-500 leading-snug line-clamp-2 mt-0.5">
                                {cat.description}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* MEGA-DROPDOWN 2: FUNCIONALIDADES */}
            <div
              className="relative"
              onMouseEnter={() => handleMouseEnter("funcionalidades")}
              onMouseLeave={handleMouseLeave}
            >
              <Link
                href="/funcionalidades"
                className="inline-flex items-center gap-1.5 text-sm font-medium py-1 text-[#0B0E14]/70 dark:text-white/70 hover:text-[#0B0E14] dark:hover:text-white transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ED500A] rounded-sm cursor-pointer"
              >
                <span>Funcionalidades</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    activeDropdown === "funcionalidades" ? "rotate-180 text-[#ED500A]" : ""
                  }`}
                />
              </Link>

              {activeDropdown === "funcionalidades" && (
                <div
                  onMouseEnter={() => handleMouseEnter("funcionalidades")}
                  onMouseLeave={handleMouseLeave}
                  className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-[620px] animate-fade-in z-50"
                >
                  <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-2xl text-[#0B0E14]">
                    <div className="px-3 py-2 border-b border-slate-100 mb-2">
                      <span className="font-mono text-[10.5px] font-bold text-[#ED500A] uppercase tracking-wider">
                        CAPACIDADES PRINCIPALES
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {FUNCIONALIDADES_MENU.map((func) => {
                        const Icon = func.icon;
                        return (
                          <Link
                            key={func.name}
                            href={func.href}
                            onClick={() => setActiveDropdown(null)}
                            className="group p-2.5 rounded-2xl hover:bg-[#F8F9FD] transition-colors flex items-start gap-3 border border-transparent hover:border-slate-200/80"
                          >
                            <div className="p-2 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-[#ED500A] group-hover:text-white transition-colors shrink-0">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-title font-bold text-sm text-[#0B0E14] group-hover:text-[#ED500A] transition-colors">
                                {func.name}
                              </h4>
                              <p className="font-body text-xs text-slate-500 leading-snug line-clamp-1 mt-0.5">
                                {func.description}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/planes"
              className={`text-sm font-medium transition-colors duration-200 py-1 ${
                isActive("/planes")
                  ? "text-[#ED500A] font-semibold"
                  : "text-[#0B0E14]/70 dark:text-white/70 hover:text-[#0B0E14] dark:hover:text-white"
              }`}
            >
              Planes
            </Link>

            <Link
              href="/contacto"
              className={`text-sm font-medium transition-colors duration-200 py-1 ${
                isActive("/contacto")
                  ? "text-[#ED500A] font-semibold"
                  : "text-[#0B0E14]/70 dark:text-white/70 hover:text-[#0B0E14] dark:hover:text-white"
              }`}
            >
              Contacto
            </Link>

            <Link
              href="/blog"
              className={`text-sm font-medium transition-colors duration-200 py-1 ${
                isActive("/blog")
                  ? "text-[#ED500A] font-semibold"
                  : "text-[#0B0E14]/70 dark:text-white/70 hover:text-[#0B0E14] dark:hover:text-white"
              }`}
            >
              Blog
            </Link>
          </nav>

          {/* DERECHA: ACCIONES DESKTOP (DINÁMICO SEGÚN SESIÓN) */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="flex items-center">
                {/* Dropdown del Perfil de Usuario */}
                <div ref={userMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    aria-expanded={userMenuOpen}
                    aria-haspopup="true"
                    className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl border border-slate-200/90 dark:border-white/10 hover:border-[#ED500A]/40 bg-white/90 dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ED500A]"
                  >
                    <UserAvatar
                      src={user.avatarUrl}
                      value={user.email}
                      name={user.fullName}
                      size={32}
                      radius={8}
                      style="shape"
                    />
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-slate-900 dark:text-white font-title truncate max-w-[140px]">
                        {user.fullName}
                      </span>
                      <span className="text-[10px] font-mono text-[#ED500A] font-semibold leading-tight flex items-center gap-1">
                        {user.roleLabel}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                        userMenuOpen ? "rotate-180 text-[#ED500A]" : ""
                      }`}
                    />
                  </button>

                  {/* Menú Desplegable Flotante */}
                  {userMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#0D0F16] border border-slate-200 dark:border-white/[0.12] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                    >
                      {/* Cabecera con datos del usuario */}
                      <div className="p-3.5 border-b border-slate-100 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] flex items-center gap-3">
                        <UserAvatar
                          src={user.avatarUrl}
                          value={user.email}
                          name={user.fullName}
                          size={38}
                          radius={10}
                          style="shape"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-white font-title truncate">
                            {user.fullName}
                          </p>
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {user.email}
                          </p>
                          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#ED500A]/10 border border-[#ED500A]/20 text-[#ED500A] text-[10px] font-mono font-semibold">
                            <Shield className="w-3 h-3" />
                            <span>{user.roleLabel}</span>
                          </div>
                        </div>
                      </div>

                      {/* Opciones del Menú: Solo Panel de Administración */}
                      <div className="p-1.5">
                        <Link
                          href={user.dashboardUrl || "/admin"}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-[#ED500A] dark:hover:text-[#ED500A] hover:bg-[#ED500A]/5 dark:hover:bg-[#ED500A]/10 rounded-xl transition-colors"
                          role="menuitem"
                        >
                          <LayoutDashboard className="w-4 h-4 text-[#ED500A]" />
                          <span>Panel de Administración</span>
                        </Link>
                      </div>

                      {/* Cerrar Sesión */}
                      <div className="p-1.5 border-t border-slate-100 dark:border-white/[0.08]">
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            setLogoutModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors text-left cursor-pointer"
                          role="menuitem"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Cerrar Sesión</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-[#0B0E14]/80 dark:text-white/80 hover:text-[#0B0E14] dark:hover:text-white transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ED500A] rounded-sm px-2 py-1"
                >
                  Iniciar sesión
                </Link>

                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center bg-[#ED500A] hover:bg-[#d64505] active:bg-[#bd3d04] text-white font-title font-bold text-sm px-5 py-2.5 rounded-xl shadow-sm transition-all duration-200 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ED500A] focus-visible:ring-offset-2 cursor-pointer"
                >
                  <span>Comenzar ahora</span>
                  <ArrowUpRight className="w-4 h-4 ml-1.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </>
            )}
          </div>

          {/* MÓVIL: BOTÓN MENÚ Y ACCIÓN RÁPIDA */}
          <div className="flex md:hidden items-center gap-2.5">
            {user ? (
              <Link
                href={user.dashboardUrl || "/admin"}
                className="inline-flex items-center gap-1.5 bg-[#ED500A] text-white font-title font-bold text-xs px-3 py-1.5 rounded-lg shadow-xs"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Panel</span>
              </Link>
            ) : (
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center bg-[#ED500A] text-white font-title font-bold text-xs px-3.5 py-2 rounded-lg"
              >
                Comenzar
              </a>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#0B0E14] dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ED500A] rounded-[4px] hover:bg-[#0B0E14]/5 dark:hover:bg-white/5 transition-colors"
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </header>

      {/* MENÚ MÓVIL FULLSCREEN / CON ACORDEÓN PARA CATEGORÍAS Y FUNCIONALIDADES */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden bg-[#0B0E14]/40 backdrop-blur-sm animate-fade-in">
          <div className="fixed inset-x-0 top-[65px] bg-white dark:bg-[#0B0E14] border-b border-[#0B0E14]/10 dark:border-white/10 p-6 shadow-2xl max-h-[calc(100vh-80px)] overflow-y-auto">
            <nav className="flex flex-col gap-3">
              
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium py-2 border-b border-slate-100 dark:border-slate-800/60 text-[#0B0E14] dark:text-white"
              >
                Inicio
              </Link>

              {/* MÓVIL: ACORDEÓN CATEGORÍAS */}
              <div className="border-b border-slate-100 dark:border-slate-800/60 pb-2">
                <button
                  onClick={() => setMobileCategoriasOpen(!mobileCategoriasOpen)}
                  className="w-full flex items-center justify-between py-2 text-base font-medium text-[#0B0E14] dark:text-white cursor-pointer"
                >
                  <span>Categorías</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      mobileCategoriasOpen ? "rotate-180 text-[#ED500A]" : ""
                    }`}
                  />
                </button>

                {mobileCategoriasOpen && (
                  <div className="pl-3 pr-1 py-2 space-y-2.5 bg-[#F8F9FD] dark:bg-slate-900/50 rounded-xl my-1 border border-slate-100 dark:border-slate-800">
                    {CATEGORIAS_MENU.map((cat) => (
                      <Link
                        key={cat.name}
                        href={cat.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block font-title font-semibold text-xs text-slate-800 dark:text-slate-200 active:text-[#ED500A]"
                      >
                        <div>{cat.name}</div>
                        <div className="font-body text-[11px] text-slate-500 font-normal">{cat.description}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* MÓVIL: ACORDEÓN FUNCIONALIDADES */}
              <div className="border-b border-slate-100 dark:border-slate-800/60 pb-2">
                <button
                  onClick={() => setMobileFuncionalidadesOpen(!mobileFuncionalidadesOpen)}
                  className="w-full flex items-center justify-between py-2 text-base font-medium text-[#0B0E14] dark:text-white cursor-pointer"
                >
                  <span>Funcionalidades</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      mobileFuncionalidadesOpen ? "rotate-180 text-[#ED500A]" : ""
                    }`}
                  />
                </button>

                {mobileFuncionalidadesOpen && (
                  <div className="pl-3 pr-1 py-2 space-y-2.5 bg-[#F8F9FD] dark:bg-slate-900/50 rounded-xl my-1 border border-slate-100 dark:border-slate-800">
                    {FUNCIONALIDADES_MENU.map((func) => (
                      <Link
                        key={func.name}
                        href={func.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block font-title font-semibold text-xs text-slate-800 dark:text-slate-200 active:text-[#ED500A]"
                      >
                        <div>{func.name}</div>
                        <div className="font-body text-[11px] text-slate-500 font-normal">{func.description}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link
                href="/planes"
                onClick={() => setMobileMenuOpen(false)}
                className={`text-base font-medium py-2 border-b border-slate-100 dark:border-slate-800/60 ${
                  isActive("/planes") ? "text-[#ED500A] font-semibold" : "text-[#0B0E14] dark:text-white"
                }`}
              >
                Planes
              </Link>

              <Link
                href="/contacto"
                onClick={() => setMobileMenuOpen(false)}
                className={`text-base font-medium py-2 border-b border-slate-100 dark:border-slate-800/60 transition-colors ${
                  isActive("/contacto") ? "text-[#ED500A] font-semibold" : "text-[#0B0E14] dark:text-white"
                }`}
              >
                Contacto
              </Link>

              <Link
                href="/blog"
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium py-2 border-b border-slate-100 dark:border-slate-800/60 text-[#0B0E14] dark:text-white"
              >
                Blog
              </Link>

              {/* ACCIONES MÓVIL SEGÚN ESTADO DE SESIÓN */}
              {user ? (
                <div className="pt-4 space-y-3">
                  {/* Tarjeta de usuario en el menú móvil */}
                  <div className="p-3 bg-[#F8F9FD] dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-white/10 flex items-center gap-3">
                    <UserAvatar
                      src={user.avatarUrl}
                      value={user.email}
                      name={user.fullName}
                      size={40}
                      radius={10}
                      style="shape"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white font-title truncate">
                        {user.fullName}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                        {user.email}
                      </p>
                      <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#ED500A]/10 text-[#ED500A] text-[10px] font-mono font-semibold">
                        <Shield className="w-3 h-3" />
                        <span>{user.roleLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Botón directo a panel */}
                  <Link
                    href={user.dashboardUrl || "/admin"}
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#ED500A] text-white font-title font-bold text-sm rounded-xl shadow-sm cursor-pointer"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Abrir Panel de Administración</span>
                  </Link>

                  {/* Cerrar Sesión */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setLogoutModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 rounded-xl cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              ) : (
                <div className="pt-4 flex flex-col gap-3">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-3 font-medium text-sm text-[#0B0E14] dark:text-white border border-[#0B0E14]/15 dark:border-white/15 rounded-xl"
                  >
                    Iniciar sesión
                  </Link>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-3 bg-[#ED500A] text-white font-title font-bold text-sm rounded-xl shadow-sm block"
                  >
                    Comenzar ahora
                  </a>
                </div>
              )}

            </nav>
          </div>
        </div>
      )}

      {/* Modal Personalizado de Confirmación de Cierre de Sesión */}
      <AdminLogoutModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        userEmail={user?.email}
      />
    </>
  );
}
