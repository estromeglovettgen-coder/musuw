import { useEffect, useMemo } from "react";
import { HomePage } from "./HomePage";
import { getInitialLocale, getStorefrontCopy } from "./i18n";
import { LegalPage, NotFoundPage } from "./LegalPage";
import { getPublicDocument, getPublicDocumentMeta } from "./legalContent";
import { applyHomepagePlanPresentation } from "./planPresentation";
import { applyHomepageMarketingRefresh } from "./homepageMarketingRefresh";
import {
  SITE_LOGO_ALT,
  SITE_LOGO_URL,
  canonicalUrl,
  normalizePathname,
  openGraphLocale,
  structuredDataText,
} from "./seoMetadata.js";

function setMeta(attribute, key, content) {
  let element = document.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

export default function App() {
  const locale = useMemo(() => getInitialLocale(), []);
  const copy = useMemo(() => getStorefrontCopy(locale), [locale]);
  const homeMeta = useMemo(
    () => applyHomepageMarketingRefresh(applyHomepagePlanPresentation(copy)).meta,
    [copy],
  );
  const pathname = useMemo(() => window.location.pathname, []);
  const publicDocument = useMemo(() => getPublicDocument(locale, pathname), [locale, pathname]);
  const isHome = pathname === "/";
  useEffect(() => {
    const meta = publicDocument
      ? getPublicDocumentMeta(locale, pathname)
      : isHome
        ? homeMeta
        : {
            title: locale === "zh-CN" ? "页面未找到 | musuw" : "Page not found | musuw",
            description:
              locale === "zh-CN"
                ? "该 musuw 页面不存在或已移动。"
                : "This musuw page does not exist or has moved.",
          };
    const normalizedPath = normalizePathname(pathname);
    const pageUrl = canonicalUrl(normalizedPath);
    document.documentElement.lang = locale;
    document.title = meta.title;
    setMeta("name", "description", meta.description);
    setMeta("property", "og:site_name", "musuw");
    setMeta("property", "og:title", meta.title);
    setMeta("property", "og:description", meta.description);
    setMeta("property", "og:url", pageUrl);
    setMeta("property", "og:locale", openGraphLocale(locale));
    setMeta("property", "og:image", SITE_LOGO_URL);
    setMeta("property", "og:image:alt", SITE_LOGO_ALT);
    setMeta("property", "og:image:type", "image/png");
    setMeta("property", "og:image:width", "512");
    setMeta("property", "og:image:height", "512");
    setMeta("name", "twitter:card", "summary");
    setMeta("name", "twitter:title", meta.title);
    setMeta("name", "twitter:description", meta.description);
    setMeta("name", "twitter:url", pageUrl);
    setMeta("name", "twitter:image", SITE_LOGO_URL);
    setMeta("name", "twitter:image:alt", SITE_LOGO_ALT);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", pageUrl);

    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", isHome || publicDocument ? "index,follow" : "noindex,follow");

    let structured = document.getElementById("musuw-structured-data");
    if (!structured) {
      structured = document.createElement("script");
      structured.id = "musuw-structured-data";
      structured.type = "application/ld+json";
      document.head.appendChild(structured);
    }
    structured.textContent = structuredDataText({ locale, pathname: normalizedPath });
  }, [homeMeta, isHome, locale, pathname, publicDocument]);

  useEffect(() => {
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    if (!targetId) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (publicDocument) {
    return <LegalPage copy={copy} document={publicDocument} locale={locale} />;
  }

  if (!isHome) {
    return <NotFoundPage copy={copy} locale={locale} />;
  }

  return (
    <div className="relative">
      <HomePage copy={copy} />
    </div>
  );
}
