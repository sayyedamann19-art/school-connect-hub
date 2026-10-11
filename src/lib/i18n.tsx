import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { hi } from "@/locales/hi";
import { mr } from "@/locales/mr";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "mr", label: "मराठी" },
] as const;
export type Lang = (typeof LANGUAGES)[number]["code"];

/** English source text is the key; missing entries fall back to English. */
const dictionaries: Record<Lang, Record<string, string>> = { en: {}, hi, mr };

export function translate(lang: Lang, text: string, vars?: Record<string, string | number>) {
  let out = dictionaries[lang][text] ?? text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

const STORAGE_KEY = "dbs-lang";
type TFn = (text: string, vars?: Record<string, string | number>) => string;
type Ctx = { lang: Lang; setLang: (l: Lang) => Promise<void>; t: TFn };
const I18nContext = createContext<Ctx | null>(null);

const isLang = (v: unknown): v is Lang => v === "en" || v === "hi" || v === "mr";

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user, primaryRole } = useAuth();
  const [lang, setLangState] = useState<Lang>("en");

  // Device preference first (instant), then the saved account preference (cross-device).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) setLangState(stored);
  }, []);
  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("preferred_language")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (isLang(data?.preferred_language)) {
          setLangState(data.preferred_language);
          window.localStorage.setItem(STORAGE_KEY, data.preferred_language);
        }
      });
  }, [user]);

  // Translation applies to the parent portal only; staff screens stay in English.
  const active: Lang = primaryRole === "parent" ? lang : "en";

  useEffect(() => {
    document.documentElement.lang = active;
  }, [active]);

  const setLang = useCallback(
    async (next: Lang) => {
      setLangState(next);
      window.localStorage.setItem(STORAGE_KEY, next);
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ preferred_language: next })
          .eq("id", user.id);
        if (error) throw new Error(error.message);
      }
    },
    [user],
  );

  const value = useMemo<Ctx>(
    () => ({ lang: active, setLang, t: (text, vars) => translate(active, text, vars) }),
    [active, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

export function useT() {
  return useI18n().t;
}

/** Locale for dates/numbers in the active language. */
export function localeFor(lang: Lang) {
  return lang === "hi" ? "hi-IN" : lang === "mr" ? "mr-IN" : "en-IN";
}
