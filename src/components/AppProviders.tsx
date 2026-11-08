"use client";

import React from "react";
import { ThemeProvider } from "./ThemeProvider";
import { I18nProvider } from "@/lib/i18n";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>{children}</I18nProvider>
    </ThemeProvider>
  );
}

