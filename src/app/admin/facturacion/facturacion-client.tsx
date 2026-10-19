"use client";

import React, { useState, useTransition } from "react";
import {
  Receipt,
  CheckCircle2,
  Clock,
  Ban,
  Wallet,
  Building2,
  Calendar,
  X,
  CreditCard,
  Layers,
  ArrowRight,
  ExternalLink,
  Download,
  Mail,
  Send,
  Edit2,
  Trash2,
  MoreVertical,
  Printer,
} from "lucide-react";
import { createPortal } from "react-dom";
import { BillingListResult, InvoiceRecord, InvoiceStatus, PaymentMethod } from "@/lib/billing/types";
import { formatCOP } from "@/config/plans";
import {
  AdminKpiGrid,
  AdminKpiCard,
  AdminTableToolbar,
  AdminSelect,
  AdminBadge,
  AdminPagination,
  AdminEmptyState,
  AdminButton,
  AdminInput,
} from "@/components/admin/ui";
import { ModalPortal } from "@/components/ui/modal-portal";
import {
  fetchBillingListAction,
  registerPaymentAction,
  generateInvoicePdfAction,
  sendInvoiceEmailAction,
  deleteInvoiceAction,
  editInvoiceAction,
} from "./actions";
import { toast } from "sonner";
import { PrintableDocument } from "@/lib/printing/types";
import { DocumentPreview } from "@/components/printing/document-preview";

interface FacturacionClientProps {
  initialData: BillingListResult;
}

export function FacturacionClient({ initialData }: FacturacionClientProps) {
  const [data, setData] = useState<BillingListResult>(initialData);
  const [isPending, startTransition] = useTransition();

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPlan, setSelectedPlan] = useState("all");

  // Modales y acciones
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<InvoiceRecord>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{
    id: string;
    top: number;
    left: number;
    inv: InvoiceRecord;
  } | null>(null);
  const [previewDocument, setPreviewDocument] = useState<PrintableDocument | null>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest?.("[data-invoice-actions-menu]")) return;
      setMenuAnchor(null);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuAnchor(null);
    };
    if (menuAnchor) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuAnchor]);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [paymentForm, setPaymentForm] = useState({
    paymentMethod: "transfer" as PaymentMethod,
    paymentReference: "",
    notes: "",
  });

  const handlePrintDevice = async (invoice: InvoiceRecord) => {
    // 1. Build the document for preview
    const doc: PrintableDocument = {
      documentType: "invoice",
      documentNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      business: {
        id: invoice.businessId,
        name: "Facturación NEGOVA",
      },
      customer: {
        name: invoice.businessName,
      },
      items: [
        { 
          description: `Suscripción Plan ${invoice.planName}`, 
          quantity: 1, 
          unitPrice: invoice.amount, 
          total: invoice.amount 
        },
      ],
      subtotal: invoice.amount,
      total: invoice.amount,
      paymentMethod: invoice.paymentMethod,
      notes: invoice.notes ?? undefined,
    };
    
    // 2. Open the preview
    setPreviewDocument(doc);
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case "paid":
        return <AdminBadge variant="emerald" size="sm">Pagado</AdminBadge>;
      case "pending":
        return <AdminBadge variant="amber" size="sm">Pendiente de Cobro</AdminBadge>;
      case "failed":
        return <AdminBadge variant="red" size="sm">Fallido</AdminBadge>;
      case "void":
        return <AdminBadge variant="slate" size="sm">Anulado</AdminBadge>;
    }
  };

  const handleDownloadPdf = async (invoiceId: string) => {
    try {
      setIsDownloadingPdf(true);
      toast.info("Generando comprobante en PDF...");
      const res = await generateInvoicePdfAction(invoiceId);
      if (res.success && res.base64 && res.filename) {
        const byteCharacters = atob(res.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("PDF descargado correctamente.");
      } else {
        toast.error(res.error || "No fue posible generar el archivo PDF.");
      }
    } catch (err: any) {
      toast.error("Error al descargar el PDF.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedInvoice) return;
    setIsSendingEmail(true);
    try {
      const res = await sendInvoiceEmailAction(selectedInvoice.id, recipientEmail);
      if (res.success) {
        toast.success(`Comprobante enviado a ${res.sentTo || recipientEmail}`);
        setEmailModalOpen(false);
        fetchInvoices(data.page);
      } else {
        toast.error(res.error || "No se pudo enviar el correo");
      }
    } catch (err) {
      toast.error("Error de comunicación al enviar el correo.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!selectedInvoice) return;
    setIsDeleting(true);
    try {
      const res = await deleteInvoiceAction(selectedInvoice.id);
      if (res.success) {
        toast.success("Comprobante eliminado");
        setIsDeleteModalOpen(false);
        setSelectedInvoice(null);
        fetchInvoices(data.page);
      } else {
        toast.error(res.error || "Error al eliminar");
      }
    } catch (err) {
      toast.error("Error al eliminar el comprobante.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    setIsEditing(true);
    try {
      const res = await editInvoiceAction(selectedInvoice.id, editForm);
      if (res.success) {
        toast.success("Comprobante actualizado");
        setIsEditModalOpen(false);
        if (res.invoice) {
          setSelectedInvoice(res.invoice);
        }
        fetchInvoices(data.page);
      } else {
        toast.error(res.error || "Error al editar");
      }
    } catch (err) {
      toast.error("Error al editar el comprobante.");
    } finally {
      setIsEditing(false);
    }
  };

  const openEditModal = (targetInvoice?: InvoiceRecord) => {
    const inv = targetInvoice || selectedInvoice;
    if (!inv) return;
    setEditForm({
      amount: inv.amount,
      status: inv.status,
      paymentMethod: inv.paymentMethod,
      paymentReference: inv.paymentReference || "",
      issuedAt: inv.issuedAt,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt || "",
      notes: inv.notes || "",
    });
    if (targetInvoice) setSelectedInvoice(targetInvoice);
    setIsEditModalOpen(true);
  };

  const fetchInvoices = (
    page = data.page,
    status = selectedStatus,
    planId = selectedPlan,
    q = searchQuery
  ) => {
    startTransition(async () => {
      const res = await fetchBillingListAction({
        page,
        pageSize: data.pageSize,
        status,
        planId,
        search: q,
      });

      if (res.success && res.data) {
        setData(res.data);
      } else {
        toast.error("No fue posible cargar el historial de cobros.");
      }
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInvoices(1, selectedStatus, selectedPlan, searchQuery);
  };

  const handleRegisterPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    if (!paymentForm.paymentReference.trim()) {
      toast.error("Ingresa el número de referencia del comprobante de pago.");
      return;
    }

    startTransition(async () => {
      const res = await registerPaymentAction(selectedInvoice.id, {
        paymentMethod: paymentForm.paymentMethod,
        paymentReference: paymentForm.paymentReference,
        notes: paymentForm.notes,
      });

      if (res.success && res.invoice) {
        toast.success(`Pago del comprobante ${res.invoice.invoiceNumber} registrado exitosamente.`);
        setSelectedInvoice(res.invoice);
        fetchInvoices();
      } else {
        toast.error(res.error || "No fue posible registrar el pago.");
      }
    });
  };

  return (
    <div className="space-y-6 font-body">
      {/* 1. KPIS DE FACTURACIÓN Y RECAUDO */}
      <AdminKpiGrid cols={4}>
        <AdminKpiCard
          title="Total Cargos Emitidos"
          value={`${formatCOP(data.stats.totalBilledCOP)} COP`}
          subtext="Historial de obligaciones generadas"
          icon={<Receipt className="w-4 h-4 text-slate-700 dark:text-slate-300" />}
          variant="default"
        />
        <AdminKpiCard
          title="Total Recaudado (Caja)"
          value={`${formatCOP(data.stats.totalPaidCOP)} COP`}
          subtext={`${data.stats.paidCount} cobros recaudados`}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          variant="emerald"
        />
        <AdminKpiCard
          title="Pendiente de Cobro"
          value={`${formatCOP(data.stats.totalPendingCOP)} COP`}
          subtext={`${data.stats.pendingCount} cargos por recaudar`}
          icon={<Clock className="w-4 h-4 text-amber-500" />}
          variant="amber"
        />
        <AdminKpiCard
          title="Comprobantes de Cobro"
          value={data.totalCount}
          subtext="Total de registros internos"
          icon={<Wallet className="w-4 h-4 text-[#ED500A]" />}
          variant="orange"
        />
      </AdminKpiGrid>

      {/* 2. BARRA DE HERRAMIENTAS Y FILTROS */}
      <AdminTableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        searchPlaceholder="Buscar por número CMP, comercio o referencia..."
        onRefresh={() => fetchInvoices()}
        isPending={isPending}
        filters={
          <>
            <AdminSelect
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val);
                fetchInvoices(1, val, selectedPlan, searchQuery);
              }}
              options={[
                { value: "all", label: "Todos los estados" },
                { value: "paid", label: "Pagados" },
                { value: "pending", label: "Pendientes de Cobro" },
                { value: "void", label: "Anulados" },
              ]}
            />
            <AdminSelect
              value={selectedPlan}
              onChange={(val) => {
                setSelectedPlan(val);
                fetchInvoices(1, selectedStatus, val, searchQuery);
              }}
              options={[
                { value: "all", label: "Todos los planes" },
                { value: "inicio", label: "Plan Inicio" },
                { value: "crece", label: "Plan Crece" },
                { value: "negocio", label: "Plan Negocio" },
              ]}
            />
          </>
        }
      />

      {/* 3. TABLA DE COMPROBANTES */}
      {data.invoices.length === 0 ? (
        <AdminEmptyState
          icon={Receipt}
          title="No hay comprobantes de cobro"
          description="No se encontraron registros de cobro con los filtros actuales."
          onReset={() => {
            setSearchQuery("");
            setSelectedStatus("all");
            setSelectedPlan("all");
            fetchInvoices(1, "all", "all", "");
          }}
          resetLabel="Limpiar Filtros"
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-3.5 px-4">Nº Comprobante</th>
                    <th className="py-3.5 px-4">Comercio Cliente</th>
                    <th className="py-3.5 px-4">Plan & Modalidad</th>
                    <th className="py-3.5 px-4">Valor Liquidado</th>
                    <th className="py-3.5 px-4">Estado de Cobro</th>
                    <th className="py-3.5 px-4">Emisión / Vencimiento</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                  {data.invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Número */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs font-bold text-[#ED500A] bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded border border-orange-200/60 dark:border-orange-500/20">
                          {inv.invoiceNumber}
                        </span>
                      </td>

                      {/* Negocio */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {inv.businessName}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono truncate">/{inv.businessSlug}</p>
                        </div>
                      </td>

                      {/* Plan */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            Plan {inv.planName}
                          </span>
                          <span className="block text-[10px] text-slate-400 font-mono capitalize">
                            {inv.billingInterval === "annual" ? "Anual (12m)" : "Mensual"}
                          </span>
                        </div>
                      </td>

                      {/* Valor */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {inv.amount === 0 ? "Gratis (Trial 30d)" : `${formatCOP(inv.amount)} COP`}
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-4">
                        {getStatusBadge(inv.status)}
                      </td>

                      {/* Fechas */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <span>{new Date(inv.issuedAt).toLocaleDateString("es-CO")}</span>
                        <span className="text-slate-400 mx-1">→</span>
                        <span>{new Date(inv.dueDate).toLocaleDateString("es-CO")}</span>
                      </td>

                      {/* Acción */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            if (menuAnchor?.id === inv.id) {
                              setMenuAnchor(null);
                            } else {
                              const spaceBelow = window.innerHeight - rect.bottom;
                              const menuWidth = 160;
                              const menuHeight = 170;
                              const openUp = spaceBelow < menuHeight && rect.top > menuHeight;
                              const top = openUp ? rect.top - menuHeight : rect.bottom + 6;
                              const left = Math.max(10, rect.right - menuWidth);
                              setMenuAnchor({ id: inv.id, top, left, inv });
                            }
                          }}
                          className={`p-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] transition-colors ${
                            menuAnchor?.id === inv.id
                              ? "bg-slate-100 dark:bg-white/[0.06]"
                              : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                          }`}
                        >
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <AdminPagination
            currentPage={data.page}
            totalPages={data.totalPages}
            pageSize={data.pageSize}
            totalItems={data.totalCount}
            currentCount={data.invoices.length}
            onPageChange={(p) => fetchInvoices(p)}
          />
        </div>
      )}

      {/* 4. MODAL: DETALLE DEL COMPROBANTE / REGISTRAR PAGO MANUAL */}
      {selectedInvoice && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-[#ED500A] flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#ED500A]">
                      {selectedInvoice.invoiceNumber}
                    </span>
                    {getStatusBadge(selectedInvoice.status)}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedInvoice.businessName}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aclaración de validez interna */}
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] text-[11px] text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">
                Comprobante Interno de Cobro
              </span>
              Documento para gestión operativa y control de recaudos de suscripciones de NEGOVA. Sin efectos tributarios ni factura electrónica.
            </div>

            {/* Resumen del cobro */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] space-y-1">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Plan Comercial</span>
                <span className="font-bold text-sm text-slate-900 dark:text-white">Plan {selectedInvoice.planName}</span>
                <span className="text-[11px] text-slate-500 block capitalize">{selectedInvoice.billingInterval === "annual" ? "Modalidad Anual" : "Modalidad Mensual"}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.04] space-y-1">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Importe Liquidado</span>
                <span className="font-bold text-base text-[#ED500A] font-mono block">
                  {selectedInvoice.amount === 0 ? "Gratis ($0 COP)" : `${formatCOP(selectedInvoice.amount)} COP`}
                </span>
                <span className="text-[11px] text-slate-500 block">Moneda oficial Colombia</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Fecha de Emisión:</span>
                <span className="font-mono font-semibold">{new Date(selectedInvoice.issuedAt).toLocaleDateString("es-CO")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Fecha de Vencimiento:</span>
                <span className="font-mono font-semibold">{new Date(selectedInvoice.dueDate).toLocaleDateString("es-CO")}</span>
              </div>
              {selectedInvoice.paidAt && (
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Fecha de Pago Recaudado:</span>
                  <span className="font-mono font-bold">{new Date(selectedInvoice.paidAt).toLocaleDateString("es-CO")}</span>
                </div>
              )}
              {selectedInvoice.paymentReference && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Referencia de Pago:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedInvoice.paymentReference}</span>
                </div>
              )}
              {selectedInvoice.notes && (
                <div className="pt-2 border-t border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400">
                  <span className="font-semibold block mb-0.5">Notas:</span>
                  {selectedInvoice.notes}
                </div>
              )}
            </div>

            {/* Formulario para registrar pago manual si está pendiente */}
            {selectedInvoice.status === "pending" && (
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 space-y-3">
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Registrar Recaudo Manual
                </h4>
                <form onSubmit={handleRegisterPayment} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Método Manual:
                      </label>
                      <select
                        value={paymentForm.paymentMethod}
                        onChange={(e) => {
                          const method = e.target.value as PaymentMethod;
                          let newRef = paymentForm.paymentReference;
                          if (method === "cash") {
                            newRef = `CAJA-${selectedInvoice?.invoiceNumber || Math.floor(Date.now() / 1000)}`;
                          } else if (method === "manual") {
                            newRef = `AUT-${selectedInvoice?.invoiceNumber || Math.floor(Date.now() / 1000)}`;
                          } else if (method === "transfer") {
                            newRef = "";
                          }
                          setPaymentForm({ ...paymentForm, paymentMethod: method, paymentReference: newRef });
                        }}
                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white"
                      >
                        <option value="transfer">Transferencia Bancaria</option>
                        <option value="cash">Efectivo / Consignación</option>
                        <option value="manual">Autorizado / Manual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {paymentForm.paymentMethod === "transfer" ? "Ref. Bancaria / Transacción:" : "Referencia de Control:"}
                      </label>
                      <input
                        type="text"
                        value={paymentForm.paymentReference}
                        onChange={(e) => setPaymentForm({ ...paymentForm, paymentReference: e.target.value })}
                        placeholder={paymentForm.paymentMethod === "transfer" ? "Ej: 039401831" : "Ej: CAJA-CMP-001"}
                        className="w-full p-2 rounded-lg border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white"
                        required
                      />
                    </div>
                  </div>
                  <AdminButton variant="primary" size="sm" type="submit" isLoading={isPending}>
                    Confirmar Recaudo de Pago
                  </AdminButton>
                </form>
              </div>
            )}

            {/* Auditoría de envío de correo */}
            {selectedInvoice.lastEmailSentAt && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>
                  Comprobante enviado por correo el{" "}
                  <strong>{new Date(selectedInvoice.lastEmailSentAt).toLocaleDateString("es-CO")}</strong>
                  {selectedInvoice.lastSentToEmail && ` a ${selectedInvoice.lastSentToEmail}`}
                </span>
              </div>
            )}

            {/* Submodal / formulario de envío por correo */}
            {emailModalOpen ? (
              <div className="p-3.5 rounded-xl border border-orange-200 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/5 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-[#ED500A]" /> Enviar Comprobante PDF por Correo
                  </span>
                  <button
                    type="button"
                    onClick={() => setEmailModalOpen(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancelar
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400">
                    Correo electrónico del destinatario:
                  </label>
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="Ej: propietario@comercio.com"
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white"
                  />
                  <p className="text-[10px] text-slate-400">
                    Se adjuntará automáticamente el comprobante PDF oficial con plantilla institucional de NEGOVA.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <AdminButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setEmailModalOpen(false)}
                  >
                    Cancelar
                  </AdminButton>
                  <AdminButton
                    variant="primary"
                    size="sm"
                    onClick={handleSendEmail}
                    isLoading={isSendingEmail}
                  >
                    <Send className="w-3.5 h-3.5 mr-1" /> Despachar Correo
                  </AdminButton>
                </div>
              </div>
            ) : null}

            {/* Acciones principales del comprobante */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
              <AdminButton variant="secondary" size="sm" onClick={() => setSelectedInvoice(null)}>
                Cerrar
              </AdminButton>
            </div>
          </div>
          </div>
        </ModalPortal>
      )}

      {/* 5. MODAL: ELIMINAR */}
      {isDeleteModalOpen && selectedInvoice && (
        <ModalPortal>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">¿Eliminar Comprobante?</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Estás a punto de eliminar el comprobante <strong>{selectedInvoice.invoiceNumber}</strong>. Esta acción no se puede deshacer y borrará el registro contable.
              </p>
              <div className="flex justify-end gap-2 pt-4">
                <AdminButton variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</AdminButton>
                <AdminButton variant="primary" onClick={handleDeleteInvoice} isLoading={isDeleting} className="bg-red-600 hover:bg-red-700 text-white border-red-600">
                  Sí, Eliminar
                </AdminButton>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 6. MODAL: EDITAR */}
      {isEditModalOpen && selectedInvoice && (
        <ModalPortal>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0D0F16] p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Editar Comprobante</h3>
              
              <form onSubmit={handleEditInvoice} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Monto (COP):</label>
                    <input type="number" required value={editForm.amount || 0} onChange={e => setEditForm({...editForm, amount: Number(e.target.value)})} className="w-full p-2 rounded-lg border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Estado:</label>
                    <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value as InvoiceStatus})} className="w-full p-2 rounded-lg border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white">
                      <option value="pending">Pendiente</option>
                      <option value="paid">Pagado</option>
                      <option value="failed">Fallido</option>
                      <option value="void">Anulado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Método de Pago:</label>
                    <select value={editForm.paymentMethod} onChange={e => setEditForm({...editForm, paymentMethod: e.target.value as PaymentMethod})} className="w-full p-2 rounded-lg border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white">
                      <option value="transfer">Transferencia</option>
                      <option value="cash">Efectivo</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Referencia:</label>
                    <input type="text" value={editForm.paymentReference || ""} onChange={e => setEditForm({...editForm, paymentReference: e.target.value})} className="w-full p-2 rounded-lg border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Observaciones / Notas:</label>
                    <textarea rows={3} value={editForm.notes || ""} onChange={e => setEditForm({...editForm, notes: e.target.value})} className="w-full p-2 rounded-lg border border-slate-300 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-xs text-slate-900 dark:text-white" />
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-white/[0.08]">
                  <AdminButton variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancelar</AdminButton>
                  <AdminButton variant="primary" type="submit" isLoading={isEditing}>Guardar Cambios</AdminButton>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 6.5. MODAL DE VISTA PREVIA DE IMPRESIÓN */}
      {previewDocument && (
        <ModalPortal>
          <DocumentPreview document={previewDocument} onClose={() => setPreviewDocument(null)} />
        </ModalPortal>
      )}

      {/* 7. MENU PORTAL (ACCIONES DE FILA) */}
      {menuAnchor &&
        createPortal(
          <div
            data-invoice-actions-menu
            style={{ top: `${menuAnchor.top}px`, left: `${menuAnchor.left}px` }}
            className="fixed w-40 z-[999999] bg-white dark:bg-[#0D0F16] rounded-xl border border-slate-200 dark:border-white/[0.08] shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              onClick={() => {
                setMenuAnchor(null);
                setSelectedInvoice(menuAnchor.inv);
              }}
              className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            >
              Ver Detalles
            </button>
            <button
              onClick={() => {
                setMenuAnchor(null);
                handleDownloadPdf(menuAnchor.inv.id);
              }}
              className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            >
              Descargar PDF
            </button>
            <button
              onClick={() => {
                setMenuAnchor(null);
                handlePrintDevice(menuAnchor.inv);
              }}
              className="w-full text-left px-4 py-2 text-xs text-[#ED500A] font-semibold hover:bg-orange-50 dark:hover:bg-orange-500/10 flex items-center gap-2"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimir Ticket
            </button>
            <button
              onClick={() => {
                setMenuAnchor(null);
                setSelectedInvoice(menuAnchor.inv);
                setEmailModalOpen(true);
              }}
              className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            >
              Enviar por Correo
            </button>
            <button
              onClick={() => {
                setMenuAnchor(null);
                openEditModal(menuAnchor.inv);
              }}
              className="w-full text-left px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.02]"
            >
              Editar
            </button>
            <div className="h-px bg-slate-100 dark:bg-white/10 my-1 mx-2"></div>
            <button
              onClick={() => {
                setMenuAnchor(null);
                setSelectedInvoice(menuAnchor.inv);
                setIsDeleteModalOpen(true);
              }}
              className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              Eliminar
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}

