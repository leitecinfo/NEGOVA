import { z } from "zod";
import { PosCartItem } from "../pos/types";

// ==============================================================================
// MODELO Y TIPOS DE COTIZACIONES (NEGOVA POS)
// ==============================================================================

export type QuotationStatus = "pending" | "converted" | "expired" | "cancelled";

export interface QuotationItem extends PosCartItem {
  // Hereda todos los atributos exactos del carrito del POS para garantizar
  // fidelidad total al convertir la cotización en venta real.
}

export interface Quotation {
  id: string;
  businessId: string;
  quotationNumber: string; // Formato COT-YYYY-XXXX
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  items: QuotationItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  currency: "COP";
  validUntil: string; // ISO 8601
  status: QuotationStatus;
  isExpired?: boolean; // Evaluado dinámicamente según validUntil vs now
  daysRemaining?: number; // Días restantes hasta vencimiento (o negativos si expiró)
  convertedOrderId?: string | null;
  convertedAt?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuotationInput {
  customerId?: string | null;
  customerName?: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  items: PosCartItem[];
  validDays?: number; // Plazo de vigencia en días (ej. 3, 7, 15, 30)
  validUntilDate?: string; // Fecha de vigencia directa (YYYY-MM-DD o ISO)
  notes?: string | null;
}

export interface QuotationFilterParams {
  businessId: string;
  search?: string;
  status?: "all" | QuotationStatus;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface QuotationKPIs {
  totalCount: number;
  pendingCount: number;
  pendingTotalAmount: number;
  convertedCount: number;
  convertedTotalAmount: number;
  expiredCount: number;
  conversionRatePercentage: number;
}

// ==============================================================================
// ESQUEMAS ZOD PARA VALIDACIÓN
// ==============================================================================

export const CreateQuotationInputSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().trim().min(1, "El nombre del cliente o receptor es requerido").default("Cliente General"),
  customerPhone: z.string().trim().optional().nullable(),
  customerEmail: z.string().trim().email("Correo electrónico inválido").optional().nullable().or(z.literal("")),
  items: z.array(z.any()).min(1, "La cotización debe contener al menos un producto."),
  validDays: z.number().int().min(1).max(365).optional().default(7),
  validUntilDate: z.string().optional().nullable(),
  notes: z.string().max(500, "Las notas no pueden superar 500 caracteres").optional().nullable(),
});
