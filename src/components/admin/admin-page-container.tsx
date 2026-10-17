import React from "react";
import { AppPageContainer } from "@/components/layout/app-page-container";

interface AdminPageContainerProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "full" | "7xl" | "6xl" | "5xl";
}

export function AdminPageContainer(props: AdminPageContainerProps) {
  return <AppPageContainer {...props} />;
}
