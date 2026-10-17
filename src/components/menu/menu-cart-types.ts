import { Product, ProductVariant } from "@/lib/products/types";

export interface CartItem {
  id: string; // product.id or product.id + variant.id
  productId: string;
  name: string;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
  image_url?: string | null;
}
