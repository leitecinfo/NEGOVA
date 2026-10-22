import React from "react";
import { requireWorkspaceSession } from "@/lib/auth/workspace-context";
import { getBusinessDetail } from "@/lib/businesses/businesses-service";
import * as menuService from "@/lib/menu/menu-service";
import * as productsService from "@/lib/products/products-service";
import { DigitalMenuClient } from "../productos/menu/digital-menu-client";

interface PageProps {
  params: Promise<{ businessId: string }>;
}

export default async function PresenciaDigitalPage({ params }: PageProps) {
  const { businessId } = await params;
  const session = await requireWorkspaceSession(businessId, "products.view");

  const [businessDetail, menu, categories, products] = await Promise.all([
    getBusinessDetail(businessId),
    menuService.getOrCreateDigitalMenu(businessId),
    productsService.getCategories(businessId, session.businessType),
    productsService.getProducts(businessId),
  ]);

  const biz = businessDetail.business;
  const availableProducts = products.filter((p) => p.status !== "archived");

  const publicBusiness = {
    id: biz.id,
    name: biz.name,
    slug: biz.slug,
    logo_url: biz.logoUrl || null,
    phone: biz.phone,
    email: biz.email,
    address: biz.address,
    city: biz.city,
    currency: biz.currency || "COP",
    whatsapp: (biz.settings as any)?.whatsapp || biz.phone,
    instagram: (biz.settings as any)?.instagram || null,
    schedule: (biz.settings as any)?.schedule || null,
  };

  return (
    <DigitalMenuClient
      businessId={businessId}
      business={publicBusiness}
      initialMenu={menu}
      categories={categories}
      products={availableProducts}
    />
  );
}
