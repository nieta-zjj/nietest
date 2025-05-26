"use client";

import { AppSidebarLayout } from "@/components/layout/app-sidebar-layout";

export default function AppRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppSidebarLayout>{children}</AppSidebarLayout>;
}
