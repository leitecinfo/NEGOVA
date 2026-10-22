import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ businessId: string }>;
}

export default async function LegacyDigitalMenuPage({ params }: PageProps) {
  const { businessId } = await params;
  redirect(`/workspace/${businessId}/presencia-digital`);
}
