"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center h-8 w-8 rounded-full border border-rule/80 bg-paper-2 hover:bg-paper-3 text-ink-2 hover:text-ink transition-colors shadow-2xs ${className}`}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 text-[#F59E0B] transition-transform rotate-0 scale-100" />
      ) : (
        <Moon className="h-4 w-4 text-[#0070BA] transition-transform rotate-0 scale-100" />
      )}
    </button>
  );
}

