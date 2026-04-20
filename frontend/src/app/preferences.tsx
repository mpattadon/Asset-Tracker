import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { ExchangeRate, getExchangeRate } from "./api";

type SupportedCurrency = "THB" | "USD" | "EUR" | "GBP" | "JPY";

interface PreferencesContextValue {
  language: string;
  setLanguage: (language: string) => void;
  preferredCurrency: SupportedCurrency;
  setPreferredCurrency: (currency: SupportedCurrency) => void;
  thbRate: ExchangeRate | null;
  loadingRate: boolean;
  convertFromThb: (amount: number | null | undefined) => number | null;
}

const LANGUAGE_STORAGE_KEY = "asset-tracker.language";
const CURRENCY_STORAGE_KEY = "asset-tracker.preferred-currency";

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readStoredLanguage() {
  if (typeof window === "undefined") {
    return "en";
  }
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) || "en";
}

function readStoredCurrency(): SupportedCurrency {
  if (typeof window === "undefined") {
    return "THB";
  }
  const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY) || "THB";
  return (["THB", "USD", "EUR", "GBP", "JPY"].includes(stored) ? stored : "THB") as SupportedCurrency;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState(readStoredLanguage);
  const [preferredCurrency, setPreferredCurrencyState] = useState<SupportedCurrency>(readStoredCurrency);
  const [thbRate, setThbRate] = useState<ExchangeRate | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
  }, [language]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, preferredCurrency);
    }
  }, [preferredCurrency]);

  useEffect(() => {
    let cancelled = false;

    async function loadRate() {
      if (preferredCurrency === "THB") {
        setThbRate({
          baseCurrency: "THB",
          quoteCurrency: "THB",
          rate: 1,
          inverseRate: 1,
        });
        setLoadingRate(false);
        return;
      }

      setLoadingRate(true);
      try {
        const rate = await getExchangeRate("THB", preferredCurrency);
        if (!cancelled) {
          setThbRate(rate);
        }
      } catch {
        if (!cancelled) {
          setThbRate(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingRate(false);
        }
      }
    }

    void loadRate();
    return () => {
      cancelled = true;
    };
  }, [preferredCurrency]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      language,
      setLanguage: setLanguageState,
      preferredCurrency,
      setPreferredCurrency: setPreferredCurrencyState,
      thbRate,
      loadingRate,
      convertFromThb: (amount) => {
        if (amount == null || Number.isNaN(amount)) {
          return null;
        }
        if (preferredCurrency === "THB") {
          return amount;
        }
        if (!thbRate) {
          return null;
        }
        return amount * thbRate.rate;
      },
    }),
    [language, preferredCurrency, thbRate, loadingRate],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
}
