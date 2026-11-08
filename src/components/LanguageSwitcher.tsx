"use client";

import React, { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useI18n, Locale } from "@/lib/i18n";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, locales } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = locales.find((l) => l.id === locale) || locales[0];

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-rule/80 bg-paper-2 hover:bg-paper-3 text-xs font-semibold text-ink-2 hover:text-ink transition-colors shadow-2xs whitespace-nowrap"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select language"
      >
        <Globe className="h-3.5 w-3.5 text-[#0070BA]" />
        <span>{current.nativeName}</span>
        <ChevronDown className="h-3 w-3 text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-36 rounded-2xl glass-liquid border border-rule/80 py-1.5 shadow-xl z-50 text-xs">
          {locales.map((l) => {
            const active = l.id === locale;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  setLocale(l.id as Locale);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                  active
                    ? "bg-[#0070BA]/10 text-[#0070BA] font-bold"
                    : "text-ink-2 hover:text-ink hover:bg-paper-3"
                }`}
              >
                <span>{l.nativeName}</span>
                {active && <Check className="h-3.5 w-3.5 text-[#0070BA]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

