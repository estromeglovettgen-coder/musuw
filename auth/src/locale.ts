export const LOCALE_STORAGE_KEY = "locale";
export const LOCALE_COOKIE_NAME = "musuw_locale";

export type AuthLocale = "zh-CN" | "en-US";

type StorageLike = Readonly<{ getItem(key: string): string | null }>;

export type AuthLocaleResolutionInput = Readonly<{
  storage?: StorageLike | null;
  cookie?: string | null;
  languages?: readonly string[] | null;
}>;

function authLocale(value: unknown): AuthLocale | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replaceAll("_", "-").toLowerCase();
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
  // The auth shell has complete Chinese and English copy. Other supported
  // product languages intentionally use the English auth copy for now.
  if (
    normalized === "en" || normalized.startsWith("en-") ||
    normalized === "ko" || normalized.startsWith("ko-") ||
    normalized === "ru" || normalized.startsWith("ru-")
  ) return "en-US";
  return null;
}

function cookieValue(cookie: string | null | undefined): string | null {
  if (!cookie) return null;
  for (const entry of cookie.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0 || entry.slice(0, separator).trim() !== LOCALE_COOKIE_NAME) continue;
    const value = entry.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

function browserStorage(): StorageLike | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

function browserCookie(): string {
  return typeof document === "undefined" ? "" : document.cookie;
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  const languages = Array.isArray(navigator.languages) ? navigator.languages : [];
  return languages.length > 0 ? languages : [navigator.language];
}

/** Existing preference > storefront country signal > browser > English. */
export function resolveInitialAuthLocale(
  input: AuthLocaleResolutionInput = {},
): AuthLocale {
  let saved: string | null = null;
  try {
    saved = input.storage === undefined
      ? browserStorage()?.getItem(LOCALE_STORAGE_KEY) ?? null
      : input.storage?.getItem(LOCALE_STORAGE_KEY) ?? null;
  } catch {
    saved = null;
  }
  const fromStorage = authLocale(saved);
  if (fromStorage !== null) return fromStorage;

  const fromSignal = authLocale(cookieValue(input.cookie ?? browserCookie()));
  if (fromSignal !== null) return fromSignal;

  for (const language of input.languages ?? browserLanguages()) {
    const fromBrowser = authLocale(language);
    if (fromBrowser !== null) return fromBrowser;
  }
  return "en-US";
}

export function getInitialAuthLocale(): AuthLocale {
  return resolveInitialAuthLocale();
}
