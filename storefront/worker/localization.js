import { getStorefrontCopy } from "../src/i18n.js";
import { getPublicDocumentMeta } from "../src/legalContent.js";

export function selectLocale(country) {
  return country === "CN" ? "zh-CN" : "en";
}

function localeCookie(locale, hostname = "musuw.com") {
  const isMusuwHost = hostname === "musuw.com" || hostname.endsWith(".musuw.com");
  const domain = isMusuwHost ? "; Domain=.musuw.com" : "";
  const secure = isMusuwHost ? "; Secure" : "";
  return `musuw_locale=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax${domain}${secure}`;
}

function normalizeDocumentPath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function withDocumentLocale(html, locale, pathname = "/") {
  const copy = getStorefrontCopy(locale);
  const normalizedPath = normalizeDocumentPath(pathname);
  const legalMeta = getPublicDocumentMeta(locale, normalizedPath);
  const isHome = normalizedPath === "/";
  const meta = legalMeta ?? (isHome
    ? copy.meta
    : {
        title: locale === "zh-CN" ? "页面未找到 | musuw" : "Page not found | musuw",
        description: locale === "zh-CN"
          ? "该 musuw 页面不存在或已移动。"
          : "This musuw page does not exist or has moved."
      });
  const escapeAttribute = (value) =>
    value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  const escapeText = (value) =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const upsertHead = (document, pattern, markup) => pattern.test(document)
    ? document.replace(pattern, markup)
    : document.includes("</head>")
      ? document.replace("</head>", `${markup}</head>`)
      : `${markup}${document}`;

  let localizedHtml = html.replace(/<html\b([^>]*)>/i, (_match, attributes) => {
    const withoutLang = attributes.replace(/\s+lang=(?:"[^"]*"|'[^']*')/i, "");
    return `<html${withoutLang} lang="${locale}">`;
  });
  localizedHtml = upsertHead(
    localizedHtml,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeText(meta.title)}</title>`
  );
  localizedHtml = upsertHead(
    localizedHtml,
    /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?\s*>/i,
    `<meta name="description" content="${escapeAttribute(meta.description)}">`
  );
  localizedHtml = upsertHead(
    localizedHtml,
    /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?\s*>/i,
    `<meta name="robots" content="${isHome || legalMeta ? "index,follow" : "noindex,follow"}">`
  );
  localizedHtml = upsertHead(
    localizedHtml,
    /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?\s*>/i,
    `<link rel="canonical" href="https://musuw.com${escapeAttribute(normalizedPath)}">`
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
    headers
  });
}
