import React from "react";
import { AdminPageContainer } from "@/components/admin/admin-page-container";
import { TenantRecord } from "@/components/admin/dashboard/admin-tenants-table";
import { AdminDashboardClient } from "@/components/admin/dashboard/admin-dashboard-client";
import { getAuditLogsList } from "@/lib/audit/audit-service";
import { getPlatformFinancialSummary } from "@/lib/finance/finance-service";
import { COMMERCIAL_PLANS_LIST, NEGOVA_PLANS, PlanId } from "@/config/plans";
import { PlanDistributionItem } from "@/components/admin/dashboard/admin-plan-distribution";
import { MonthlyTrendData } from "@/components/admin/dashboard/admin-growth-chart";

export const dynamic = "force-dynamic";

async function getSupabaseAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (serviceKey && supabaseUrl) {
    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    return createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  const { createClient } = await import("@/lib/supabase/server");
  return await createClient();
}

export default async function AdminDashboardPage() {
  const adminClient = await getSupabaseAdminClient();

  // Consultar conteos reales de la base de datos
  let totalBusinesses = 0;
  let activeBusinesses = 0;
  let totalUsers = 0;
  let totalSubscriptions = 0;
  let activeSubscriptions = 0;
  let expiringSoonCount = 0;
  let realTenants: TenantRecord[] = [];

  const planCounts: Record<string, number> = {
    inicio: 0,
    crece: 0,
    negocio: 0,
  };

  try {
    const [bizRes, activeBizRes, usrRes, subRes, activeSubRes, bizListRes, allSubsRes] = await Promise.all([
      adminClient.from("businesses").select("*", { count: "exact", head: true }),
      adminClient.from("businesses").select("*", { count: "exact", head: true }).eq("status", "active"),
      adminClient.from("users").select("*", { count: "exact", head: true }),
      adminClient.from("subscriptions").select("*", { count: "exact", head: true }),
      adminClient.from("subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
      adminClient
        .from("businesses")
        .select("id, name, slug, business_type, email, status, created_at, city")
        .order("created_at", { ascending: false })
        .limit(8),
      adminClient
        .from("subscriptions")
        .select("plan_id, status, current_period_end"),
    ]);

    totalBusinesses = bizRes.count ?? 0;
    activeBusinesses = activeBizRes.count ?? 0;
    totalUsers = usrRes.count ?? 0;
    totalSubscriptions = subRes.count ?? 0;
    activeSubscriptions = activeSubRes.count ?? 0;

    if (bizListRes.data && bizListRes.data.length > 0) {
      realTenants = bizListRes.data as TenantRecord[];
    }

    if (allSubsRes.data) {
      const now = new Date();
      allSubsRes.data.forEach((sub: any) => {
        const planKey = (sub.plan_id || "").toLowerCase();
        if (planCounts[planKey] !== undefined) {
          planCounts[planKey]++;
        }
        if (sub.current_period_end) {
          const endDate = new Date(sub.current_period_end);
          const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 0 && diffDays <= 15) {
            expiringSoonCount++;
          }
        }
      });
    }
  } catch (err) {
    console.error("Error consultando métricas reales de plataforma:", err);
  }

  // Finanzas y Auditoría reales
  const [financialSummary, auditResult] = await Promise.all([
    getPlatformFinancialSummary(),
    getAuditLogsList({ pageSize: 5 }),
  ]);

  // Distribución real de planes
  const totalSubForDist = Math.max(1, totalSubscriptions);
  const planColors: Record<string, string> = {
    inicio: "bg-blue-500",
    crece: "bg-[#ED500A]",
    negocio: "bg-emerald-500",
  };

  const planDistribution: PlanDistributionItem[] = COMMERCIAL_PLANS_LIST.map((plan) => {
    const count = planCounts[plan.id] || 0;
    const percentage = totalSubscriptions > 0 ? Math.round((count / totalSubForDist) * 100) : 0;
    return {
      id: plan.id,
      name: plan.name,
      count,
      percentage,
      monthlyPrice: plan.pricing.monthly,
      color: planColors[plan.id] || "bg-slate-500",
    };
  });

  // Datos de tendencia mensual
  const monthlyTrend: MonthlyTrendData[] = [
    {
      month: new Intl.DateTimeFormat("es-CO", { month: "short" }).format(new Date()),
      tenants: totalBusinesses,
      mrr: financialSummary.mrrCOP,
      activeUsers: totalUsers,
    },
  ];

  // Fecha formateada en español
  const formattedDate = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <AdminPageContainer
      title="Consola de Control de Plataforma"
      description="Supervisión global de operaciones, monetización, tenants y estado de infraestructura de NEGOVA."
      badge={
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-orange-50 text-[#ED500A] border border-orange-200 dark:bg-[#ED500A]/10 dark:text-[#ED500A] dark:border-[#ED500A]/20">
          Superadministración
        </span>
      }
    >
      <AdminDashboardClient
        initialBusinessesCount={totalBusinesses}
        initialActiveBusinessesCount={activeBusinesses}
        initialUsersCount={totalUsers}
        initialSubscriptionsCount={totalSubscriptions}
        initialActiveSubscriptionsCount={activeSubscriptions}
        initialExpiringSoonCount={expiringSoonCount}
        initialMrr={financialSummary.mrrCOP}
        initialArr={financialSummary.arrCOP}
        initialTenants={realTenants}
        initialAuditLogs={auditResult.logs}
        totalAuditLogsCount={auditResult.totalCount}
        planDistribution={planDistribution}
        monthlyTrend={monthlyTrend}
        formattedDate={formattedDate}
      />
    </AdminPageContainer>
  );
}
