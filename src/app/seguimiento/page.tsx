"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function SeguimientoPortalPage() {
  const [code, setCode] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    router.push(`/seguimiento/${clean}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-[#ED500A]/10 border border-[#ED500A]/20 flex items-center justify-center text-[#ED500A] mx-auto shadow-xl">
          <MapPin className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-black text-white">Seguimiento de Pedido</h1>
          <p className="text-xs text-slate-400">
            Ingresa el código que recibiste por WhatsApp para ver el estado de tu domicilio en vivo.
          </p>
        </div>

        <form onSubmit={handleSearch} className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ej. TRK-ABC123"
              aria-label="Código de seguimiento"
              className="w-full bg-slate-950 border border-white/10 focus:border-[#ED500A] rounded-2xl pl-10 pr-4 py-3 text-sm font-mono tracking-widest text-white uppercase placeholder-slate-500 outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={!code.trim()}
            className="w-full py-3 rounded-2xl bg-[#ED500A] hover:bg-[#d44304] text-white text-xs font-bold shadow-lg transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <span>Consultar Pedido</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="pt-2 border-t border-white/5">
          <Link
            href="/"
            className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            Volver al inicio de NEGOVA
          </Link>
        </div>
      </div>
    </div>
  );
}
