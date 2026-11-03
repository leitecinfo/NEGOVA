"use client";

import { Product } from "./types";

const BROADCAST_CHANNEL_NAME = "negova_catalog_sync";
const WINDOW_EVENT_NAME = "negova:product_updated";

export interface CatalogSyncEvent {
  type: "PRODUCT_UPSERT" | "PRODUCT_DELETE";
  businessId: string;
  product?: Product;
  productId?: string;
  timestamp: number;
}

const localBusListeners = new Set<(event: CatalogSyncEvent) => void>();

/**
 * Emite una actualización de producto en tiempo real a todas las pestañas,
 * ventanas y vistas activas (POS, Menú QR, Catálogo) sin requerir recarga.
 */
export function broadcastProductUpdate(businessId: string, product: Product): void {
  const eventPayload: CatalogSyncEvent = {
    type: "PRODUCT_UPSERT",
    businessId,
    product,
    productId: product.id,
    timestamp: Date.now(),
  };

  if (typeof window === "undefined") {
    localBusListeners.forEach((fn) => fn(eventPayload));
    return;
  }

  try {
    window.dispatchEvent(new CustomEvent(WINDOW_EVENT_NAME, { detail: eventPayload }));
  } catch {
    localBusListeners.forEach((fn) => fn(eventPayload));
  }

  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage(eventPayload);
      channel.close();
    }
  } catch {
    // BroadcastChannel no disponible en algunos navegadores restringidos
  }
}

/**
 * Emite una notificación de archivo/eliminación de producto en tiempo real.
 */
export function broadcastProductDelete(businessId: string, productId: string): void {
  const eventPayload: CatalogSyncEvent = {
    type: "PRODUCT_DELETE",
    businessId,
    productId,
    timestamp: Date.now(),
  };

  if (typeof window === "undefined") {
    localBusListeners.forEach((fn) => fn(eventPayload));
    return;
  }

  try {
    window.dispatchEvent(new CustomEvent(WINDOW_EVENT_NAME, { detail: eventPayload }));
  } catch {
    localBusListeners.forEach((fn) => fn(eventPayload));
  }

  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage(eventPayload);
      channel.close();
    }
  } catch {
    // Ignorar
  }
}

/**
 * Suscribe un componente cliente (POS, Menú QR, Catálogo) a cambios de productos
 * en tiempo real tanto vía eventos locales/BroadcastChannel como vía Supabase Realtime.
 */
export function subscribeToCatalogUpdates(
  businessId: string,
  callbacks: {
    onProductUpsert: (product: Product) => void;
    onProductDelete?: (productId: string) => void;
  }
): () => void {
  if (!businessId) {
    return () => {};
  }

  const handleEventPayload = (payload?: CatalogSyncEvent) => {
    if (!payload || payload.businessId !== businessId) return;

    if (payload.type === "PRODUCT_UPSERT" && payload.product) {
      if (payload.product.status === "archived") {
        callbacks.onProductDelete?.(payload.product.id);
      } else {
        callbacks.onProductUpsert(payload.product);
      }
    } else if (payload.type === "PRODUCT_DELETE" && payload.productId) {
      callbacks.onProductDelete?.(payload.productId);
    }
  };

  if (typeof window === "undefined") {
    localBusListeners.add(handleEventPayload);
    return () => {
      localBusListeners.delete(handleEventPayload);
    };
  }

  // 1. Listener de eventos en la misma ventana
  const onWindowEvent = (e: Event) => {
    const customEvent = e as CustomEvent<CatalogSyncEvent>;
    handleEventPayload(customEvent.detail);
  };
  window.addEventListener(WINDOW_EVENT_NAME, onWindowEvent);

  // 2. Listener de BroadcastChannel entre pestañas/ventanas del mismo navegador
  let bc: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (msg: MessageEvent<CatalogSyncEvent>) => {
        handleEventPayload(msg.data);
      };
    }
  } catch {
    bc = null;
  }

  // 3. Listener de Supabase Realtime (postgres_changes en tabla products)
  let cleanupSupabase: (() => void) | null = null;
  try {
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      import("@/lib/supabase/client")
        .then(({ createClient }) => {
          const supabase = createClient();
          const rtChannel = supabase
            .channel(`realtime_products_${businessId}_${Math.random().toString(36).slice(2, 7)}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "products",
                filter: `business_id=eq.${businessId}`,
              },
              (payload: any) => {
                if (payload.eventType === "DELETE") {
                  const deletedId = payload.old?.id;
                  if (deletedId) callbacks.onProductDelete?.(deletedId);
                  return;
                }
                const record = payload.new as Product | undefined;
                if (!record || record.business_id !== businessId) return;
                if (record.status === "archived") {
                  callbacks.onProductDelete?.(record.id);
                } else {
                  callbacks.onProductUpsert(record);
                }
              }
            )
            .subscribe();

          cleanupSupabase = () => {
            supabase.removeChannel(rtChannel);
          };
        })
        .catch(() => {
          // Ignorar si el cliente de navegador no puede inicializarse en entorno de test
        });
    }
  } catch {
    // Ignorar errores en entorno sin navegador
  }

  return () => {
    window.removeEventListener(WINDOW_EVENT_NAME, onWindowEvent);
    if (bc) {
      try {
        bc.close();
      } catch {
        // Ignorar
      }
    }
    if (cleanupSupabase) {
      try {
        cleanupSupabase();
      } catch {
        // Ignorar
      }
    }
  };
}
