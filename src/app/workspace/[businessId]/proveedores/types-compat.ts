import { CreateSupplierInput, UpdateSupplierInput } from "@/lib/purchases/types";

export interface SupplierInput extends CreateSupplierInput {
  status?: "active" | "inactive" | "archived";
}
