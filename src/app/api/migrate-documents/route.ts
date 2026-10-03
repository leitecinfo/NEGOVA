import { NextResponse } from "next/server";
import { migrateDocumentConfigsToSql } from "@/lib/documents/document-service";

export async function GET() {
  const res = await migrateDocumentConfigsToSql();
  return NextResponse.json(res);
}
