import { BRAND } from "@/config/brand";
import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries/uz-latn";
import uzLatn from "./dictionaries/uz-latn";
import uzCyrl from "./dictionaries/uz-cyrl";
import ru from "./dictionaries/ru";

export type { Dictionary };

const dictionaries: Record<Locale, Dictionary> = { "uz-latn": uzLatn, "uz-cyrl": uzCyrl, ru };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Interpolates {placeholders}. `{brand}` is always available. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (key === "brand") return BRAND.name;
    const v = vars[key];
    return v === undefined ? `{${key}}` : String(v);
  });
}

export function formatMoney(amount: number, dict: Dictionary): string {
  // Space-grouped digits are the norm in Uzbekistan for all three languages.
  const n = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount).replace(/\u00a0/g, " ");
  return `${n} ${dict.common.som}`;
}
