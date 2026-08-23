import { getStorefrontCopy } from "../src/i18n.js";
import { getPublicDocumentMeta } from "../src/legalContent.js";
import {
  SITE_LOGO_ALT,
  SITE_LOGO_URL,
  canonicalUrl,
  normalizePathname,
  openGraphLocale,
  structuredDataText,
} from "../src/seoMetadata.js";

function supportedLocale(value) {
  if (value === "zh-CN") return "zh-CN";
  if (value === "en") return "en";
  return null;
}

function savedLocale(cookieHeader) {
  if (!cookieHeader) return null;
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0 || entry.slice(0, separator).trim() !== "musuw_locale") continue;
    try {
      return supportedLocale(decodeURIComponent(entry.slice(separator + 1).trim()));
    } catch {
      return null;
    }
  }
  return null;
}

export function selectLocale(country, cookieHeader = "", requestedLocale = "") {
  return (
    supportedLocale(requestedLocale) ??
    savedLocale(cookieHeader) ??
    (country === "CN" ? "zh-CN" : "en")
  );
}

function localeCookie(locale, hostname = "musuw.com") {
  const isMusuwHost = hostname === "musuw.com" || hostname.endsWith(".musuw.com");
  const domain = isMusuwHost ? "; Domain=.musuw.com" : "";
  const secure = isMusuwHost ? "; Secure" : "";
  return `musuw_locale=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax${domain}${secure}`;
}

function normalizeDocumentPath(pathname) {
  return normalizePathname(pathname);
}

function withDocumentLocale(html, locale, pathname = "/") {
  const copy = getStorefrontCopy(locale);
  const normalizedPath = normalizeDocumentPath(pathname);
  const legalMeta = getPublicDocumentMeta(locale, normalizedPath);
  const isHome = normalizedPath === "/";
  const meta =
    legalMeta ??
    (isHome
      ? copy.meta
      : {
          title: locale === "zh-CN" ? "页面未找到 | musuw" : "Page not found | musuw",
          description:
            locale === "zh-CN"
              ? "该 musuw 页面不存在或已移动。"
              : "This musuw page does not exist or has moved.",
        });
  const escapeAttribute = (value) =>
    value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  const escapeText = (value) =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const upsertHead = (document, pattern, markup) =>
    pattern.test(document)
      ? document.replace(pattern, markup)
      : document.includes("</head>")
        ? document.replace("</head>", `${markup}</head>`)
        : `${markup}${document}`;
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const upsertMeta = (document, attribute, key, content) => {
    const pattern = new RegExp(
      `<meta\\s+${attribute}\\s*=\\s*["']${escapeRegExp(key)}["'][^>]*>`,
      "i",
    );
    return upsertHead(
      document,
      pattern,
      `<meta ${attribute}="${escapeAttribute(key)}" content="${escapeAttribute(content)}">`,
    );
  };

  let localizedHtml = html.replace(/<html\b([^>]*)>/i, (_match, attributes) => {
    const withoutLang = attributes.replace(/\s+lang=(?:"[^"]*"|'[^']*')/i, "");
    return `<html${withoutLang} lang="${locale}">`;
  });
  localizedHtml = upsertHead(
    localizedHtml,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeText(meta.title)}</title>`,
  );
  const pageUrl = canonicalUrl(normalizedPath);
  for (const [attribute, key, content] of [
    ["name", "description", meta.description],
    ["name", "robots", isHome || legalMeta ? "index,follow" : "noindex,follow"],
    ["property", "og:site_name", "musuw"],
    ["property", "og:title", meta.title],
    ["property", "og:description", meta.description],
    ["property", "og:url", pageUrl],
    ["property", "og:locale", openGraphLocale(locale)],
    ["property", "og:image", SITE_LOGO_URL],
    ["property", "og:image:alt", SITE_LOGO_ALT],
    ["property", "og:image:type", "image/png"],
    ["property", "og:image:width", "512"],
    ["property", "og:image:height", "512"],
    ["name", "twitter:card", "summary"],
    ["name", "twitter:title", meta.title],
    ["name", "twitter:description", meta.description],
    ["name", "twitter:url", pageUrl],
    ["name", "twitter:image", SITE_LOGO_URL],
    ["name", "twitter:image:alt", SITE_LOGO_ALT],
  ]) {
    localizedHtml = upsertMeta(localizedHtml, attribute, key, content);
  }
  localizedHtml = upsertHead(
    localizedHtml,
    /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?\s*>/i,
    `<link rel="canonical" href="${escapeAttribute(pageUrl)}">`,
  );
  const structuredMarkup = `<script id="musuw-structured-data" type="application/ld+json">${structuredDataText({ locale, pathname: normalizedPath })}</script>`;
  localizedHtml = upsertHead(
    localizedHtml,
    /<script\s+id=["']musuw-structured-data["'][^>]*>[\s\S]*?<\/script>/i,
    structuredMarkup,
  );
  const bootstrap = `<script>window.__MUSUW_LOCALE__=${JSON.stringify(locale)}</script>`;
  return localizedHtml.includes("</head>")
    ? localizedHtml.replace("</head>", `${bootstrap}</head>`)
    : `${bootstrap}${localizedHtml}`;
}

export async function localizeDocumentResponse(
  assetResponse,
  locale,
  pathname = "/",
  hostname = "musuw.com",
) {
  const normalizedLocale = locale === "zh-CN" ? "zh-CN" : "en";
  const normalizedPath = normalizeDocumentPath(pathname);
  const knownDocument =
    normalizedPath === "/" || Boolean(getPublicDocumentMeta(normalizedLocale, normalizedPath));
  const headers = new Headers(assetResponse.headers);
  headers.set("content-language", normalizedLocale);
  headers.set("cache-control", "private, no-store");
  headers.delete("content-length");
  headers.delete("etag");
  headers.delete("last-modified");
  headers.set("set-cookie", localeCookie(normalizedLocale, hostname));
  const html = withDocumentLocale(await assetResponse.text(), normalizedLocale, normalizedPath);
  const status = knownDocument ? assetResponse.status : 404;
  return new Response(html, {
    status,
    statusText: status === assetResponse.status ? assetResponse.statusText : "Not Found",
    headers,
  });
}
