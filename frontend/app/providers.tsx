"use client";

import type { ThemeProviderProps } from "next-themes";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Toaster } from "sonner";

import { AuthProvider } from "@/lib/auth";
import { HydrationSafe } from "@/components/hydration-safe";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >;
  }
}

export function Providers({ children, themeProps }: ProvidersProps) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <NextThemesProvider {...themeProps}>
        <AuthProvider>
          <HydrationSafe>
            {children}
            <Toaster
              richColors
              position="top-center"
              toastOptions={{
                style: {
                  fontSize: '14px',
                },
              }}
            />
          </HydrationSafe>
        </AuthProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
