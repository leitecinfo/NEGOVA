export interface CartItemModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface CartItem {
  id: string; // product.id or product.id + variant.id (+ modifiers hash)
  productId: string;
  name: string;
  variantId?: string | null;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
  image_url?: string | null;
  selectedModifiers?: CartItemModifier[];
}

