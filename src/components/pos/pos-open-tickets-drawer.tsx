'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  X,
  Clock,
  AlertTriangle,
  Flame,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Filter,
  ShoppingBag,
  Bike,
  UtensilsCrossed,
  Receipt
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface OpenTicket {
  id: string;
  orderNumber: string;
  customerName: string;
  serviceType: 'DINE_IN' | 'TAKEOUT' | 'DELIVERY' | 'PICKUP';
  tableName?: string;
  total: number;
  status: 'PENDING' | 'PREPARING' | 'READY';
  createdAt: string; // ISO date string or minutes ago
  minutesElapsed: number;
  itemsCount: number;
}

interface PosOpenTicketsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  tickets?: OpenTicket[];
  onSelectTicket?: (ticket: OpenTicket) => void;
}

export function PosOpenTicketsDrawer({
  isOpen,
  onClose,
  businessId,
  tickets = [],
  onSelectTicket,
}: PosOpenTicketsDrawerProps) {
  const [filterOrigin, setFilterOrigin] = useState<string>('TODOS');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [filterService, setFilterService] = useState<string>('TODOS');
  const [sortBy, setSortBy] = useState<'time' | 'total'>('time');

  if (!isOpen) return null;

  // Si no vienen tickets, creamos datos de muestra realistas para la demostración
  const sampleTickets: OpenTicket[] = tickets.length > 0 ? tickets : [
    {
      id: 'ticket-1',
      orderNumber: '#104',
      customerName: 'Carlos Gómez',
      serviceType: 'DINE_IN',
      tableName: 'Mesa 4',
      total: 45000,
      status: 'PREPARING',
      createdAt: new Date(Date.now() - 18 * 60000).toISOString(),
      minutesElapsed: 18,
      itemsCount: 3,
    },
    {
      id: 'ticket-2',
      orderNumber: '#105',
      customerName: 'Cliente General',
      serviceType: 'TAKEOUT',
      total: 28000,
      status: 'PENDING',
      createdAt: new Date(Date.now() - 8 * 60000).toISOString(),
      minutesElapsed: 8,
      itemsCount: 2,
    },
    {
      id: 'ticket-3',
      orderNumber: '#106',
      customerName: 'María Rodríguez',
      serviceType: 'DELIVERY',
      total: 62000,
      status: 'READY',
      createdAt: new Date(Date.now() - 3 * 60000).toISOString(),
      minutesElapsed: 3,
      itemsCount: 4,
    },
  ];

  const totalTickets = sampleTickets.length;
  const totalValue = sampleTickets.reduce((acc, t) => acc + t.total, 0);
  const delayedTickets = sampleTickets.filter((t) => t.minutesElapsed >= 5 && t.minutesElapsed < 15).length;
  const criticalTickets = sampleTickets.filter((t) => t.minutesElapsed >= 15).length;

  const filteredTickets = sampleTickets.filter((ticket) => {
    if (filterStatus !== 'TODOS' && ticket.status !== filterStatus) return false;
    if (filterService !== 'TODOS' && ticket.serviceType !== filterService) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'time') return b.minutesElapsed - a.minutesElapsed;
    return b.total - a.total;
  });

  const getServiceBadge = (type: OpenTicket['serviceType']) => {
    switch (type) {
      case 'DINE_IN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            <UtensilsCrossed className="w-3 h-3" /> Mesa
          </span>
        );
      case 'TAKEOUT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <ShoppingBag className="w-3 h-3" /> Para llevar
          </span>
        );
      case 'DELIVERY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
            <Bike className="w-3 h-3" /> Domicilio
          </span>
        );
      case 'PICKUP':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300">
            <Receipt className="w-3 h-3" /> Recoger
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white dark:bg-[#0D0F16] h-full shadow-2xl flex flex-col transform transition-transform ease-out duration-300 border-l border-slate-200 dark:border-white/[0.08]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tickets-drawer-title"
      >
        {/* Cabecera */}
        <div className="p-4 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between bg-slate-50 dark:bg-white/[0.02]">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-[#ED500A]">Tu operación</span>
            <h2 id="tickets-drawer-title" className="text-lg font-bold text-slate-900 dark:text-white">
              Tickets Abiertos
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Métricas 2x2 */}
        <div className="p-4 grid grid-cols-2 gap-2 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02]">
          <div className="bg-white dark:bg-white/[0.03] p-2.5 rounded-lg border border-slate-200 dark:border-white/[0.08]">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Tickets abiertos</span>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{totalTickets}</p>
          </div>
          <div className="bg-white dark:bg-white/[0.03] p-2.5 rounded-lg border border-slate-200 dark:border-white/[0.08]">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Valor de tickets</span>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              ${totalValue.toLocaleString('es-CO')}
            </p>
          </div>
          <div className="bg-white dark:bg-white/[0.03] p-2.5 rounded-lg border border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Demorados (≥5m)
              </span>
              <p className="text-base font-bold text-slate-900 dark:text-white">{delayedTickets}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-white/[0.03] p-2.5 rounded-lg border border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <Flame className="w-3 h-3" /> Críticos (≥15m)
              </span>
              <p className="text-base font-bold text-rose-600 dark:text-rose-400">{criticalTickets}</p>
            </div>
          </div>
        </div>

        {/* Filtros 2x2 */}
        <div className="p-3 border-b border-slate-200 dark:border-white/[0.08] grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">Estado</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full h-8 px-2 rounded border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-800 dark:text-white"
            >
              <option value="TODOS">Todos los estados</option>
              <option value="PENDING">Pendientes</option>
              <option value="PREPARING">En preparación</option>
              <option value="READY">Listos</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-1">Servicio</label>
            <select
              value={filterService}
              onChange={(e) => setFilterService(e.target.value)}
              className="w-full h-8 px-2 rounded border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] text-slate-800 dark:text-white"
            >
              <option value="TODOS">Todos</option>
              <option value="DINE_IN">Mesa</option>
              <option value="TAKEOUT">Para llevar</option>
              <option value="DELIVERY">Domicilio</option>
            </select>
          </div>
          <div className="col-span-2 flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Ordenar por:</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setSortBy('time')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  sortBy === 'time'
                    ? 'bg-[#ED500A] text-white font-semibold shadow-xs'
                    : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.08]'
                }`}
              >
                Tiempo transcurrido
              </button>
              <button
                type="button"
                onClick={() => setSortBy('total')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                  sortBy === 'total'
                    ? 'bg-[#ED500A] text-white font-semibold shadow-xs'
                    : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.08]'
                }`}
              >
                Mayor valor
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Pedidos en Curso */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="font-medium text-sm">No hay tickets abiertos en este filtro</p>
              <p className="text-xs text-slate-400 mt-1">Todos los pedidos han sido facturados o entregados</p>
            </div>
          ) : (
            filteredTickets.map((ticket) => {
              const isCritical = ticket.minutesElapsed >= 15;
              const isDelayed = ticket.minutesElapsed >= 5 && !isCritical;

              return (
                <div
                  key={ticket.id}
                  onClick={() => onSelectTicket?.(ticket)}
                  className={`p-3 rounded-lg border transition cursor-pointer hover:shadow-md ${
                    isCritical
                      ? 'border-rose-300 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20'
                      : isDelayed
                      ? 'border-amber-300 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20'
                      : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] hover:border-[#ED500A]/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {ticket.orderNumber}
                      </span>
                      {getServiceBadge(ticket.serviceType)}
                      {ticket.tableName && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">({ticket.tableName})</span>
                      )}
                    </div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      ${ticket.total.toLocaleString('es-CO')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 mb-2">
                    <span className="truncate max-w-[180px]">{ticket.customerName}</span>
                    <span>{ticket.itemsCount} productos</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/[0.06] text-xs">
                    <div className="flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span
                        className={
                          isCritical
                            ? 'text-rose-600 dark:text-rose-400 font-bold'
                            : isDelayed
                            ? 'text-amber-600 dark:text-amber-400 font-semibold'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        Hace {ticket.minutesElapsed} min
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        ticket.status === 'READY'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : ticket.status === 'PREPARING'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-800 dark:bg-white/[0.06] dark:text-slate-300'
                      }`}
                    >
                      {ticket.status === 'READY'
                        ? 'Listo'
                        : ticket.status === 'PREPARING'
                        ? 'En preparación'
                        : 'Pendiente'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pie con Enlace a Mis Órdenes */}
        <div className="p-3 border-t border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.02]">
          <Link
            href={`/workspace/${businessId}/pedidos`}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-medium text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition"
          >
            Ir a Mis Órdenes <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
