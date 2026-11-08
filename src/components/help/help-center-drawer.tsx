'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  X,
  Settings,
  ShoppingCart,
  FileText,
  Wallet,
  Package,
  UtensilsCrossed,
  Store,
  Boxes,
  Truck,
  Utensils,
  QrCode,
  Receipt,
  Users,
  UserCheck,
  MessageCircle,
  BarChart3,
  ChevronDown,
  Play,
  BookOpen,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { ModalPortal } from '@/components/ui/modal-portal';

export interface HelpModuleItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  completedCount: number;
  totalCount: number;
  videos: Array<{
    id: string;
    title: string;
    duration: string;
  }>;
}

export const SYSTEM_HELP_MODULES: HelpModuleItem[] = [
  {
    id: 'config',
    name: 'Configuración del sistema',
    icon: Settings,
    completedCount: 2,
    totalCount: 2,
    videos: [
      { id: 'cfg-1', title: 'Configuración inicial de la empresa', duration: '3:10' },
      { id: 'cfg-2', title: 'Ajustes de tickets y facturación', duration: '2:45' },
    ],
  },
  {
    id: 'ventas',
    name: 'Ventas y POS',
    icon: ShoppingCart,
    completedCount: 8,
    totalCount: 8,
    videos: [
      { id: 'v-1', title: 'Primera venta en el sistema POS', duration: '3:45' },
      { id: 'v-2', title: 'Cómo realizar la primera venta', duration: '4:12' },
      { id: 'v-3', title: 'Cómo vender con remisión y cerrar', duration: '2:50' },
      { id: 'v-4', title: 'Cómo hacer una venta por remisión abierta', duration: '3:15' },
      { id: 'v-5', title: 'Cómo realizar una venta de domicilio desde el mostrador', duration: '5:02' },
      { id: 'v-6', title: 'Crear primer producto con modificadores y carrito', duration: '4:30' },
      { id: 'v-7', title: 'Proceso de compra de productos con y sin modificadores', duration: '3:55' },
      { id: 'v-8', title: 'Cómo aplicar descuentos y promociones en una venta', duration: '2:40' },
    ],
  },
  {
    id: 'historial-ventas',
    name: 'Historial de Ventas',
    icon: FileText,
    completedCount: 3,
    totalCount: 3,
    videos: [
      { id: 'hv-1', title: 'Consultar y filtrar ventas anteriores', duration: '2:30' },
      { id: 'hv-2', title: 'Reimpresión y envío de factura por WhatsApp', duration: '1:50' },
      { id: 'hv-3', title: 'Anulación y corrección de ventas', duration: '3:20' },
    ],
  },
  {
    id: 'cajas',
    name: 'Cierres de Caja',
    icon: Wallet,
    completedCount: 6,
    totalCount: 7,
    videos: [
      { id: 'c-1', title: 'Apertura de turno de caja', duration: '2:00' },
      { id: 'c-2', title: 'Movimientos manuales de entrada y retiro', duration: '2:40' },
      { id: 'c-3', title: 'Arqueo ciego y cuadre de efectivo', duration: '3:30' },
      { id: 'c-4', title: 'Cierre Z y reporte diario', duration: '4:10' },
      { id: 'c-5', title: 'Historial de turnos anteriores', duration: '2:15' },
      { id: 'c-6', title: 'Manejo de múltiples cajas registradoras', duration: '3:05' },
      { id: 'c-7', title: 'Auditoría de diferencias y faltantes', duration: '3:50' },
    ],
  },
  {
    id: 'productos',
    name: 'Productos',
    icon: Package,
    completedCount: 7,
    totalCount: 8,
    videos: [
      { id: 'p-1', title: 'Creación de productos simples', duration: '2:15' },
      { id: 'p-2', title: 'Manejo de categorías y subcategorías', duration: '3:00' },
      { id: 'p-3', title: 'Grupos de modificadores y complementos', duration: '4:20' },
      { id: 'p-4', title: 'Variantes con precios diferenciados', duration: '3:45' },
      { id: 'p-5', title: 'Importación masiva por archivo Excel/CSV', duration: '5:10' },
      { id: 'p-6', title: 'Control de disponibilidad por canal (POS/Menú QR)', duration: '2:30' },
      { id: 'p-7', title: 'Código de barras y escaneo rápido', duration: '2:40' },
      { id: 'p-8', title: 'Márgenes de ganancia y costeo automático', duration: '3:30' },
    ],
  },
  {
    id: 'recetas',
    name: 'Recetas e Ingredientes',
    icon: UtensilsCrossed,
    completedCount: 2,
    totalCount: 2,
    videos: [
      { id: 'r-1', title: 'Creación de ficha técnica de receta', duration: '4:15' },
      { id: 'r-2', title: 'Descuento automático de stock por escandallo', duration: '3:50' },
    ],
  },
  {
    id: 'inventario',
    name: 'Inventario y Ubicaciones',
    icon: Store,
    completedCount: 3,
    totalCount: 4,
    videos: [
      { id: 'inv-1', title: 'Monitoreo de existencias y alertas de agotados', duration: '3:00' },
      { id: 'inv-2', title: 'Ajustes manuales y mermas', duration: '2:35' },
      { id: 'inv-3', title: 'Traslados entre almacenes', duration: '3:10' },
      { id: 'inv-4', title: 'Cálculo de costo promedio ponderado', duration: '4:00' },
    ],
  },
  {
    id: 'compras',
    name: 'Compras y Proveedores',
    icon: Boxes,
    completedCount: 0,
    totalCount: 2,
    videos: [
      { id: 'com-1', title: 'Registro de órdenes de compra a proveedores', duration: '3:40' },
      { id: 'com-2', title: 'Recepción de insumos y actualización de costos', duration: '4:15' },
    ],
  },
  {
    id: 'domicilios',
    name: 'Domicilios',
    icon: Truck,
    completedCount: 1,
    totalCount: 3,
    videos: [
      { id: 'dom-1', title: 'Despacho de pedidos a repartidores', duration: '3:25' },
      { id: 'dom-2', title: 'Portal móvil del domiciliario y PIN de entrega', duration: '4:10' },
      { id: 'dom-3', title: 'Configuración de tarifas por zona o km', duration: '3:00' },
    ],
  },
  {
    id: 'mesas',
    name: 'Mesas y Restaurante',
    icon: Utensils,
    completedCount: 2,
    totalCount: 4,
    videos: [
      { id: 'm-1', title: 'Configuración del plano del salón y salas', duration: '3:30' },
      { id: 'm-2', title: 'Toma de comandas por mesero y estado de mesa', duration: '4:05' },
      { id: 'm-3', title: 'Traslado y unión de mesas', duration: '2:50' },
      { id: 'm-4', title: 'Cierre y cobro de cuentas divididas', duration: '3:45' },
    ],
  },
  {
    id: 'menu-qr',
    name: 'Menú QR',
    icon: QrCode,
    completedCount: 4,
    totalCount: 4,
    videos: [
      { id: 'mq-1', title: 'Personalización de plantilla y colores del menú digital', duration: '3:15' },
      { id: 'mq-2', title: 'Descarga e impresión de códigos QR por mesa', duration: '2:20' },
      { id: 'mq-3', title: 'Recepción de pedidos autogestionados del cliente', duration: '3:40' },
      { id: 'mq-4', title: 'Pagos en línea integrados en el menú QR', duration: '4:00' },
    ],
  },
  {
    id: 'facturacion',
    name: 'Facturación Electrónica',
    icon: Receipt,
    completedCount: 2,
    totalCount: 4,
    videos: [
      { id: 'fe-1', title: 'Configuración del certificado digital y resolución DIAN', duration: '5:20' },
      { id: 'fe-2', title: 'Emisión de factura electrónica desde el POS', duration: '3:10' },
      { id: 'fe-3', title: 'Generación de notas crédito y débito', duration: '3:35' },
      { id: 'fe-4', title: 'Monitoreo de estado y validación previa DIAN', duration: '2:50' },
    ],
  },
  {
    id: 'clientes',
    name: 'Clientes',
    icon: Users,
    completedCount: 1,
    totalCount: 1,
    videos: [
      { id: 'cli-1', title: 'Directorio de clientes, cartera y programa de fidelidad', duration: '3:30' },
    ],
  },
  {
    id: 'empleados',
    name: 'Empleados y Permisos',
    icon: UserCheck,
    completedCount: 1,
    totalCount: 2,
    videos: [
      { id: 'emp-1', title: 'Creación de usuarios y asignación de roles RBAC', duration: '3:40' },
      { id: 'emp-2', title: 'PIN de seguridad para autorizaciones en caja', duration: '2:15' },
    ],
  },
  {
    id: 'whatsapp',
    name: 'Notificaciones WhatsApp',
    icon: MessageCircle,
    completedCount: 1,
    totalCount: 2,
    videos: [
      { id: 'wa-1', title: 'Conexión de canal de WhatsApp Business', duration: '4:00' },
      { id: 'wa-2', title: 'Plantillas automáticas de confirmación y factura', duration: '3:15' },
    ],
  },
  {
    id: 'reportes',
    name: 'Reportes y Analítica',
    icon: BarChart3,
    completedCount: 2,
    totalCount: 4,
    videos: [
      { id: 'rep-1', title: 'Tablero gerencial de ventas y ticket promedio', duration: '3:50' },
      { id: 'rep-2', title: 'Reporte de horas pico y rotación de platos', duration: '3:15' },
      { id: 'rep-3', title: 'Rendimiento de meseros y comisiones', duration: '2:45' },
      { id: 'rep-4', title: 'Exportación a Excel y PDF', duration: '2:30' },
    ],
  },
];

interface HelpCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  businessId?: string;
  onSelectVideo?: (video: { title: string; duration: string }) => void;
}

export function HelpCenterDrawer({
  isOpen,
  onClose,
  businessId,
  onSelectVideo,
}: HelpCenterDrawerProps) {
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>('ventas');

  if (!isOpen) return null;

  const toggleModule = (id: string) => {
    setExpandedModuleId((prev) => (prev === id ? null : id));
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md bg-white dark:bg-[#0D0F16] h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-white/[0.08] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Encabezado */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Centro de Ayuda
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tutoriales en video organizados por módulo del sistema
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Cerrar centro de ayuda"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Lista de Módulos (Acordeón Desplegable) */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
            {SYSTEM_HELP_MODULES.map((mod) => {
              const IconComp = mod.icon;
              const isExpanded = expandedModuleId === mod.id;

              return (
                <div
                  key={mod.id}
                  className="rounded-2xl border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-[#0D0F16] overflow-hidden transition-all shadow-xs"
                >
                  {/* Fila del Módulo (Botón del Acordeón) */}
                  <button
                    type="button"
                    onClick={() => toggleModule(mod.id)}
                    className="w-full p-3 sm:p-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-[#ED500A] flex items-center justify-center shrink-0">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                        {mod.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Badge con Contador de Progreso / Videos */}
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                        {mod.completedCount}/{mod.totalCount}
                      </span>

                      {/* Flecha de Apertura */}
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 text-[#ED500A]' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {/* Lista de Videos del Módulo Expandido */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-white/[0.04] bg-slate-50/40 dark:bg-white/[0.01] space-y-1.5 animate-in fade-in duration-150">
                      {mod.videos.map((vid) => (
                        <div
                          key={vid.id}
                          onClick={() => onSelectVideo?.(vid)}
                          className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-[#0D0F16] border border-slate-200/60 dark:border-white/[0.04] hover:border-[#ED500A]/40 flex items-center justify-between gap-2.5 cursor-pointer transition-all hover:shadow-2xs group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-7 h-7 rounded-full bg-orange-500/10 text-[#ED500A] group-hover:bg-[#ED500A] group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                              <Play className="w-3 h-3 fill-current ml-0.5" />
                            </div>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-[#ED500A] transition-colors truncate">
                              {vid.title}
                            </span>
                          </div>

                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {vid.duration}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pie del Panel (Recursos Adicionales) */}
          <div className="p-4 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02] grid grid-cols-2 gap-2">
            <Link
              href={businessId ? `/workspace/${businessId}/ayuda` : '#'}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-[#ED500A] hover:border-[#ED500A]/40 transition-colors shadow-2xs"
            >
              <BookOpen className="w-4 h-4 text-[#ED500A]" />
              <span>Documentación</span>
            </Link>

            <Link
              href={businessId ? `/workspace/${businessId}/soporte` : '#'}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-[#ED500A] hover:border-[#ED500A]/40 transition-colors shadow-2xs"
            >
              <HelpCircle className="w-4 h-4 text-[#ED500A]" />
              <span>Soporte / FAQ</span>
            </Link>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
