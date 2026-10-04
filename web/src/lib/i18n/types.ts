export const SUPPORTED_LOCALES = ["ro", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ro";
export const LOCALE_COOKIE_NAME = "fleet-locale";

export function isLocale(value: unknown): value is Locale {
  return value === "ro" || value === "en";
}

export function parseLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
