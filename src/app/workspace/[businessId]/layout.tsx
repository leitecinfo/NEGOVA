import React from "react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getBusinessDocumentConfig } from "@/lib/documents/document-service";
import { getBusinessProductCount } from "@/lib/products/products-service";
import { getBusinessSubscriptionDetails } from "@/lib/subscriptions/subscriptions-service";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

interface CachedLayoutMetadata {
  config: {
    logoUrl?: string | null;
    primaryColor?: string | null;
    [key: string]: any;
  };
  productCount: number;
  activeUserCount: number;
  subDetails: {
    planId: any;
    planName: string;
    isTrial: boolean;
    trialRemainingDays: number | null;
    status: any;
  } | null;
  cachedAt: number;
}

const layoutMetadataCache = new Map<string, CachedLayoutMetadata>();
const METADATA_TTL_MS = 30_000; // 30 segundos de caché en memoria para navegación fluida

async function fetchLayoutMetadata(businessId: string, businessName: string): Promise<CachedLayoutMetadata> {
  const cached = layoutMetadataCache.get(businessId);
  const now = Date.now();
  if (cached && now - cached.cachedAt < METADATA_TTL_MS) {
    return cached;
  }

  const [config, productCount, activeUserCount, subDetails] = await Promise.all([
    getBusinessDocumentConfig(businessId).catch(() => ({
      businessId,
      businessName,
      logoUrl: null,
      primaryColor: "#0284C7",
      taxId: null,
      address: null,
      phone: null,
      email: null,
    })),
    getBusinessProductCount(businessId).catch(() => 0),
    (async () => {
      try {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return 1;
        }
        const { createClient: createAdminClient } = await import("@supabase/supabase-js");
        const adminClient = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );
        const { count } = await adminClient
          .from("business_users")
          .select("*", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("status", "active");
        return count || 1;
      } catch {
        return 1;
      }
    })(),
    getBusinessSubscriptionDetails(businessId).catch(() => null),
  ]);

  const entry: CachedLayoutMetadata = {
    config,
    productCount,
    activeUserCount,
    subDetails,
    cachedAt: now,
  };

  layoutMetadataCache.set(businessId, entry);
  return entry;
}

export default async function WorkspaceRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  // 1. Validar sesión del workspace a nivel layout (autenticación y membresía activa en el negocio)
  const session = await requireWorkspaceSession(businessId, "none");

  // 2. Obtener identidad de marca, conteo de productos, colaboradores y vigencia con caché en memoria
  const { config, productCount, activeUserCount, subDetails } = await fetchLayoutMetadata(
    businessId,
    session.businessName
  );

  return (
    <WorkspaceShell
      session={session}
      logoUrl={config.logoUrl || null}
      primaryColor={config.primaryColor || "#0284C7"}
      productCount={productCount}
      employeeCount={activeUserCount}
      trialRemainingDays={subDetails?.trialRemainingDays ?? null}
      isTrialing={subDetails?.isTrial ?? false}
    >
      {children}
    </WorkspaceShell>
  );
}
