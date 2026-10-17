import { z } from "zod";

export const ExpenseSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  concept: z.string().min(1, "El concepto es requerido"),
  amount: z.number().min(0.01, "El monto debe ser mayor a cero"),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  expense_date: z.string(), // YYYY-MM-DD
  status: z.enum(["completed", "pending", "cancelled"]).default("completed"),
  created_by: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Expense = z.infer<typeof ExpenseSchema>;

export const CreateExpenseSchema = ExpenseSchema.omit({
  id: true,
  business_id: true,
  created_at: true,
  updated_at: true,
});
export type CreateExpenseDTO = z.infer<typeof CreateExpenseSchema>;

export const PaymentSchema = z.object({
  id: z.string().uuid(),
  business_id: z.string().uuid(),
  reference_type: z.string(),
  reference_id: z.string().uuid(),
  amount: z.number().min(0.01),
  payment_method: z.string(),
  status: z.enum(["completed", "pending", "failed", "refunded"]).default("completed"),
  reference: z.string().nullable().optional(),
  paid_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Payment = z.infer<typeof PaymentSchema>;

export const CreatePaymentSchema = PaymentSchema.omit({
  id: true,
  business_id: true,
  created_at: true,
  updated_at: true,
});
export type CreatePaymentDTO = z.infer<typeof CreatePaymentSchema>;
