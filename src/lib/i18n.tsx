"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";

export type Locale = "en" | "hi" | "kn";

export interface I18nContextType {
  locale: Locale;
  setLocale: (loc: Locale) => void;
  t: (key: string) => string;
  locales: { id: Locale; label: string; nativeName: string }[];
}

export const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Brand & App
    "brand.name": "PayPal",
    "brand.guardian": "Guardian",
    "brand.subtitle": "Deterministic Sentry",
    "brand.tagline": "Apple Liquid Glass // Dynamic Scrollytelling",

    // Navigation Items
    "nav.overview": "Overview",
    "nav.invoices": "Invoices",
    "nav.policies": "Policies",
    "nav.checkout": "Checkout",
    "nav.events": "Events",
    "nav.warrants": "Warrants",
    "nav.audit": "Audit",
    "nav.transitions": "Transitions",
    "nav.architecture": "Architecture",
    "nav.guardrails": "Guardrails",
    "nav.signIn": "Sign In",
    "nav.signOut": "Sign Out",
    "nav.console": "Console",
    "nav.dashboard": "Dashboard",
    "nav.public3d": "Public 3D",

    // Telemetry
    "telemetry.postgres": "Postgres",
    "telemetry.redis": "Redis",
    "telemetry.paypalApi": "PayPal API",
    "telemetry.aiModel": "AI Model",
    "telemetry.connected": "Connected",
    "telemetry.offline": "Offline",
    "telemetry.online": "Online",
    "telemetry.sandboxLive": "Sandbox Live",
    "telemetry.unreachable": "Unreachable",
    "telemetry.standby": "Standby",
    "telemetry.rechecking": "Rechecking…",
    "telemetry.refresh": "Refresh Telemetry",

    // Hero Section
    "hero.badge": "Autonomous Payment Guardrails",
    "hero.title": "The autonomous back-office for enterprise PayPal merchants.",
    "hero.subtitle":
      "Deterministic policy guardrails intercept checkout declines in real time. Experience complete biometric authorization, cryptographic policy enforcement, and atomic settlement pipeline.",
    "hero.cta.dashboard": "Open Merchant Dashboard",
    "hero.cta.explore": "Explore 3D Pipeline",
    "hero.cta.scroll": "Scroll to Transition",

    // Order Return & Cancel Handshake
    "return.title": "PayPal Checkout Return",
    "return.subtitle": "Buyer Order Handshake",
    "return.tokenBadge": "TOKEN HANDSHAKE",
    "return.orderToken": "ORDER TOKEN:",
    "return.payerId": "PAYER ID:",
    "return.settled": "PAYMENT CAPTURED & SETTLED",
    "return.declined": "CAPTURE DECLINED — POLICY TRIGGERED",
    "return.error": "EXECUTION ERROR",
    "return.successMsg": "Transaction captured and settled successfully.",
    "return.back": "Back to Overview",
    "return.goToDashboard": "Go to Merchant Dashboard",

    // Common Controls
    "theme.toggle": "Toggle Theme",
    "lang.select": "Language",
    "status.live": "Live Invariant Protection",
    "status.simulated": "Simulation Stack Active",
  },
  hi: {
    // Brand & App
    "brand.name": "पेपैल",
    "brand.guardian": "गार्डियन",
    "brand.subtitle": "स्वचालित सुरक्षा प्रहरी",
    "brand.tagline": "एप्पल लिक्विड ग्लास // 3D रूपांतरण",

    // Navigation Items
    "nav.overview": "अवलोकन",
    "nav.invoices": "चालान",
    "nav.policies": "नीतियां",
    "nav.checkout": "चेकआउट",
    "nav.events": "इवेंट्स",
    "nav.warrants": "वारंट्स",
    "nav.audit": "ऑडिट",
    "nav.transitions": "रूपांतरण",
    "nav.architecture": "वास्तुशिल्प",
    "nav.guardrails": "सुरक्षा घेरा",
    "nav.signIn": "साइन इन",
    "nav.signOut": "साइन आउट",
    "nav.console": "कंसोल",
    "nav.dashboard": "डैशबोर्ड",
    "nav.public3d": "पब्लिक 3D",

    // Telemetry
    "telemetry.postgres": "पोस्टग्रेस",
    "telemetry.redis": "रेडिस",
    "telemetry.paypalApi": "पेपैल एपीआई",
    "telemetry.aiModel": "एआई मॉडल",
    "telemetry.connected": "सक्रिय",
    "telemetry.offline": "ऑफ़लाइन",
    "telemetry.online": "ऑनलाइन",
    "telemetry.sandboxLive": "सैंडबॉक्स लाइव",
    "telemetry.unreachable": "पहुंच से बाहर",
    "telemetry.standby": "स्टैंडबाय",
    "telemetry.rechecking": "जाँच हो रही है…",
    "telemetry.refresh": "रिफ्रेश स्थिति",

    // Hero Section
    "hero.badge": "स्वायत्त भुगतान सुरक्षा प्रणाली",
    "hero.title": "एंटरप्राइज़ पेपैल व्यापारियों के लिए स्वायत्त बैक-ऑफिस।",
    "hero.subtitle":
      "पूर्वनिर्धारित नीति रेल वास्तविक समय में चेकआउट अस्वीकृति को रोकती हैं। बायोमेट्रिक सत्यापन, क्रिप्टोग्राफिक नीति प्रवर्तन और त्वरित निपटान प्रक्रिया का अनुभव करें।",
    "hero.cta.dashboard": "व्यापारी डैशबोर्ड खोलें",
    "hero.cta.explore": "3D पाइपलाइन देखें",
    "hero.cta.scroll": "रूपांतरण पर जाएं",

    // Order Return & Cancel Handshake
    "return.title": "पेपैल चेकआउट वापसी",
    "return.subtitle": "क्रेता आदेश हैंडशेक",
    "return.tokenBadge": "टोकन हैंडशेक",
    "return.orderToken": "ऑर्डर टोकन:",
    "return.payerId": "भुगतानकर्ता आईडी:",
    "return.settled": "भुगतान प्राप्त एवं निपटाया गया",
    "return.declined": "लेनदेन अस्वीकृत — नीति सक्रिय",
    "return.error": "कार्यान्वयन त्रुटि",
    "return.successMsg": "लेनदेन सफलतापूर्वक पूरा हुआ और निपटाया गया।",
    "return.back": "अवलोकन पर वापस",
    "return.goToDashboard": "डैशबोर्ड पर जाएं",

    // Common Controls
    "theme.toggle": "थीम बदलें",
    "lang.select": "भाषा",
    "status.live": "सक्रिय सुरक्षा संरक्षण",
    "status.simulated": "सिमुलेशन स्टैक सक्रिय",
  },
  kn: {
    // Brand & App
    "brand.name": "ಪೇಪಾಲ್",
    "brand.guardian": "ಗಾರ್ಡಿಯನ್",
    "brand.subtitle": "ಸ್ವಯಂಚಾಲಿತ ಕಾವಲುಗಾರ",
    "brand.tagline": "ಆಪಲ್ ಲಿಕ್ವಿಡ್ ಗ್ಲಾಸ್ // 3D ಅನುಭವ",

    // Navigation Items
    "nav.overview": "ಅವಲೋಕನ",
    "nav.invoices": "ಇನ್‌ವಾಯ್ಸ್",
    "nav.policies": "ನೀತಿಗಳು",
    "nav.checkout": "ಚೆಕ್‌ಔಟ್",
    "nav.events": "ಈವೆಂಟ್‌ಗಳು",
    "nav.warrants": "ವಾರಂಟ್‌ಗಳು",
    "nav.audit": "ಆಡಿಟ್",
    "nav.transitions": "ರೂಪಾಂತರ",
    "nav.architecture": "ವಾಸ್ತುಶಿಲ್ಪ",
    "nav.guardrails": "ರಕ್ಷಣಾ ಜಾಲ",
    "nav.signIn": "ಸೈನ್ ಇನ್",
    "nav.signOut": "ಸೈನ್ ಔಟ್",
    "nav.console": "ಕನ್ಸೋಲ್",
    "nav.dashboard": "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    "nav.public3d": "ಸಾರ್ವಜನಿಕ 3D",

    // Telemetry
    "telemetry.postgres": "ಪೋಸ್ಟ್‌ಗ್ರೆಸ್",
    "telemetry.redis": "ರೆಡಿಸ್",
    "telemetry.paypalApi": "ಪೇಪಾಲ್ API",
    "telemetry.aiModel": "AI ಮಾದರಿ",
    "telemetry.connected": "ಸಂಪರ್ಕಗೊಂಡಿದೆ",
    "telemetry.offline": "ಆಫ್‌ಲೈನ್",
    "telemetry.online": "ಆನ್‌ಲೈನ್",
    "telemetry.sandboxLive": "ಸ್ಯಾಂಡ್‌ಬಾಕ್ಸ್ ಲೈವ್",
    "telemetry.unreachable": "ತಲುಪಲಾಗುತ್ತಿಲ್ಲ",
    "telemetry.standby": "ಸ್ಟ್ಯಾಂಡ್‌ಬೈ",
    "telemetry.rechecking": "ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…",
    "telemetry.refresh": "ಸ್ಥಿತಿ ನವೀಕರಿಸಿ",

    // Hero Section
    "hero.badge": "ಸ್ವಾಯತ್ತ ಪಾವತಿ ರಕ್ಷಣಾ ವ್ಯವಸ್ಥೆ",
    "hero.title": "ಎಂಟರ್‌ಪ್ರೈಸ್ ಪೇಪಾಲ್ ವ್ಯಾಪಾರಿಗಳಿಗಾಗಿ ಸ್ವಾಯತ್ತ ಬ್ಯಾಕ್-ಆಫೀಸ್.",
    "hero.subtitle":
      "ನೈಜ ಸಮಯದಲ್ಲಿ ಚೆಕ್‌ಔಟ್ ನಿರಾಕರಣೆಗಳನ್ನು ತಡೆಯುವ ನೀತಿ ರಕ್ಷಣಾ ಜಾಲ. ಬಯೋಮೆಟ್ರಿಕ್ ದೃಢೀಕರಣ, ಕ್ರಿಪ್ಟೋಗ್ರಾಫಿಕ್ ನೀತಿ ಜಾರಿ ಮತ್ತು ತ್ವರಿತ ಇತ್ಯರ್ಥ ಪ್ರಕ್ರಿಯೆಯನ್ನು ಅನುಭವಿಸಿ.",
    "hero.cta.dashboard": "ವ್ಯಾಪಾರಿ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ತೆರೆಯಿರಿ",
    "hero.cta.explore": "3D ಪೈಪ್‌ಲೈನ್ ಅನ್ವೇಷಿಸಿ",
    "hero.cta.scroll": "ರೂಪಾಂತರಕ್ಕೆ ಸ್ಕ್ರೋಲ್ ಮಾಡಿ",

    // Order Return & Cancel Handshake
    "return.title": "ಪೇಪಾಲ್ ಚೆಕ್‌ಔಟ್ ರಿಟರ್ನ್",
    "return.subtitle": "ಖರೀದಿದಾರರ ಆರ್ಡರ್ ಹ್ಯಾಂಡ್‌ಶೇಕ್",
    "return.tokenBadge": "ಟೋಕನ್ ಹ್ಯಾಂಡ್‌ಶೇಕ್",
    "return.orderToken": "ಆರ್ಡರ್ ಟೋಕನ್:",
    "return.payerId": "ಪಾವತಿದಾರರ ಐಡಿ:",
    "return.settled": "ಪಾವತಿ ಯಶಸ್ವಿಯಾಗಿ ಇತ್ಯರ್ಥವಾಗಿದೆ",
    "return.declined": "ಪಾವತಿ ನಿರಾಕರಿಸಲಾಗಿದೆ — ನೀತಿ ಸಕ್ರಿಯವಾಗಿದೆ",
    "return.error": "ಕಾರ್ಯಗತಗೊಳಿಸುವ ದೋಷ",
    "return.successMsg": "ವಹಿವಾಟನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಸೆರೆಹಿಡಿಯಲಾಗಿದೆ ಮತ್ತು ಇತ್ಯರ್ಥಪಡಿಸಲಾಗಿದೆ.",
    "return.back": "ಅವಲೋಕನಕ್ಕೆ ಹಿಂತಿರುಗಿ",
    "return.goToDashboard": "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಹೋಗಿ",

    // Common Controls
    "theme.toggle": "ಥೀಮ್ ಬದಲಾಯಿಸಿ",
    "lang.select": "ಭಾಷೆ",
    "status.live": "ಸಕ್ರಿಯ ರಕ್ಷಣೆ",
    "status.simulated": "ಸಿಮ್ಯುಲೇಶನ್ ಸ್ಟ್ಯಾಕ್ ಸಕ್ರಿಯ",
  },
};

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key: string) => key,
  locales: [
    { id: "en", label: "English", nativeName: "English" },
    { id: "hi", label: "Hindi", nativeName: "हिन्दी" },
    { id: "kn", label: "Kannada", nativeName: "ಕನ್ನಡ" },
  ],
});

export const LOCALES: { id: Locale; label: string; nativeName: string }[] = [
  { id: "en", label: "English", nativeName: "English" },
  { id: "hi", label: "Hindi", nativeName: "हिन्दी" },
  { id: "kn", label: "Kannada", nativeName: "ಕನ್ನಡ" },
];

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("paypal-lang") as Locale | null;
      if (stored && (stored === "en" || stored === "hi" || stored === "kn")) {
        setLocaleState(stored);
      }
    } catch {
      // LocalStorage unavailable
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem("paypal-lang", newLocale);
      document.documentElement.lang = newLocale;
    } catch {
      // ignore
    }
  };

  const t = (key: string): string => {
    const dict = translations[locale] || translations.en;
    return dict[key] || translations.en[key] || key;
  };

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      locales: LOCALES,
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

