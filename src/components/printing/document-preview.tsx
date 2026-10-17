import React from "react";
import { PrintableDocument } from "@/lib/printing/types";
import { AdminButton } from "@/components/admin/ui/admin-button";
import { Printer, Download, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { ModalPortal } from "@/components/ui/modal-portal";

interface DocumentPreviewProps {
  document: PrintableDocument;
  onClose: () => void;
}

export function DocumentPreview({ document, onClose }: DocumentPreviewProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    toast.info("Descarga PDF en desarrollo...");
  };

  const handleShare = () => {
    toast.info("Compartir en desarrollo...");
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 m-0">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Vista Previa de Comprobante</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Simulation */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex justify-center">
          <div className="bg-white w-full max-w-[320px] shadow-sm p-6 text-[13px] font-mono text-gray-800 space-y-4">
            
            {/* Header */}
            <div className="text-center space-y-1 pb-4 border-b border-dashed border-gray-300">
              <h2 className="font-bold text-base uppercase">{document.business.name}</h2>
              {document.business.legalName && <p>{document.business.legalName}</p>}
              {document.business.taxId && <p>NIT/RUT: {document.business.taxId}</p>}
              {document.business.address && <p>{document.business.address}</p>}
              {document.business.phone && <p>Tel: {document.business.phone}</p>}
            </div>

            {/* Meta */}
            <div className="space-y-1 pb-4 border-b border-dashed border-gray-300">
              <p>TICKET: {document.documentNumber}</p>
              <p>FECHA: {new Date(document.issuedAt).toLocaleString()}</p>
              {document.customer?.name && <p>CLIENTE: {document.customer.name}</p>}
            </div>

            {/* Items */}
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-1 font-normal uppercase">Cant</th>
                  <th className="py-1 font-normal uppercase">Desc</th>
                  <th className="py-1 font-normal uppercase text-right">Total</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {document.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-50 last:border-0">
                    <td className="py-2">{item.quantity}</td>
                    <td className="py-2 pr-2">{item.description}</td>
                    <td className="py-2 text-right">${item.total.toLocaleString("es-CO")}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="pt-4 space-y-1 border-t border-dashed border-gray-300">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${document.subtotal.toLocaleString("es-CO")}</span>
              </div>
              {document.discountTotal ? (
                <div className="flex justify-between text-gray-500">
                  <span>Descuento:</span>
                  <span>-${document.discountTotal.toLocaleString("es-CO")}</span>
                </div>
              ) : null}
              {document.taxTotal ? (
                <div className="flex justify-between text-gray-500">
                  <span>Impuestos:</span>
                  <span>${document.taxTotal.toLocaleString("es-CO")}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-bold text-base pt-2">
                <span>TOTAL:</span>
                <span>${document.total.toLocaleString("es-CO")}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 text-center space-y-2">
              <p>Método: {document.paymentMethod.toUpperCase()}</p>
              {document.notes && <p className="italic text-gray-500">{document.notes}</p>}
              <p className="pt-4 font-bold">¡GRACIAS POR SU COMPRA!</p>
            </div>

          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-white border-t border-gray-100 flex gap-2 justify-end">
          <AdminButton variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Descargar
          </AdminButton>
          <AdminButton variant="outline" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" />
            Compartir
          </AdminButton>
          <AdminButton onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </AdminButton>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
