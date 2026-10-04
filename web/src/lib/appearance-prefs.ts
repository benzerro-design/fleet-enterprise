import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, parseLocale, type Locale } from "@/lib/i18n/types";

export type AppearanceTheme = "dark" | "light" | "system";
export type AppearanceDensity = "comfortable" | "compact";
export type AppearanceDateFormat = "ro" | "iso" | "numeric";

export type AppearancePrefs = {
  theme: AppearanceTheme;
  density: AppearanceDensity;
  reduceMotion: boolean;
  dateFormat: AppearanceDateFormat;
  locale: Locale;
};

export const APPEARANCE_STORAGE_KEY = "fleet-appearance-v1";

export const DEFAULT_APPEARANCE_PREFS: AppearancePrefs = {
  theme: "dark",
  density: "comfortable",
  reduceMotion: false,
  dateFormat: "ro",
  locale: DEFAULT_LOCALE,
};

export function parseAppearancePrefs(raw: unknown): AppearancePrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_APPEARANCE_PREFS };
  const o = raw as Partial<AppearancePrefs>;
  const theme: AppearanceTheme =
    o.theme === "light" || o.theme === "system" || o.theme === "dark" ? o.theme : "dark";
  const density: AppearanceDensity = o.density === "compact" ? "compact" : "comfortable";
  const dateFormat: AppearanceDateFormat =
    o.dateFormat === "iso" || o.dateFormat === "numeric" || o.dateFormat === "ro"
      ? o.dateFormat
      : "ro";
  const locale = parseLocale(o.locale);
  return {
    theme,
    density,
    reduceMotion: o.reduceMotion === true,
    dateFormat,
    locale,
  };
}

export function readAppearancePrefs(): AppearancePrefs {
  if (typeof window === "undefined") return { ...DEFAULT_APPEARANCE_PREFS };
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE_PREFS };
    return parseAppearancePrefs(JSON.parse(raw) as unknown);
  } catch {
    return { ...DEFAULT_APPEARANCE_PREFS };
  }
}

export function writeAppearancePrefs(prefs: AppearancePrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(prefs));
    writeAppearanceLocaleCookie(prefs.locale);
  } catch {
    /* ignore quota */
  }
}

export function resolveTheme(theme: AppearanceTheme): "dark" | "light" {
  if (theme === "light") return "light";
  if (theme === "dark") return "dark";
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** Cache pentru formatDate* pe client (actualizat de AppearanceProvider). */
let dateFormatCache: AppearanceDateFormat = DEFAULT_APPEARANCE_PREFS.dateFormat;

export function setAppearanceDateFormatCache(format: AppearanceDateFormat): void {
  dateFormatCache = format;
}

export function getAppearanceDateFormatCache(): AppearanceDateFormat {
  return dateFormatCache;
}

function writeAppearanceLocaleCookie(locale: Locale): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function applyAppearanceToDocument(prefs: AppearancePrefs): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolved = resolveTheme(prefs.theme);
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-density", prefs.density);
  root.lang = prefs.locale;
  if (prefs.reduceMotion) root.setAttribute("data-reduce-motion", "1");
  else root.removeAttribute("data-reduce-motion");
  root.style.colorScheme = resolved;
  setAppearanceDateFormatCache(prefs.dateFormat);
  writeAppearanceLocaleCookie(prefs.locale);
}
