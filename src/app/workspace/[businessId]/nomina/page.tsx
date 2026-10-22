import { redirect } from "next/navigation";

export default async function WorkspaceNominaPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/workspace/${businessId}/modulo/nomina`);
}

