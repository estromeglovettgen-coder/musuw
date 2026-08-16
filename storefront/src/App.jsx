import { useEffect, useMemo } from "react";
import { HomePage } from "./HomePage";
import { getInitialLocale, getStorefrontCopy } from "./i18n";
import { LegalPage, NotFoundPage } from "./LegalPage";
import { getPublicDocument, getPublicDocumentMeta } from "./legalContent";

export default function App() {
  const locale = useMemo(() => getInitialLocale(), []);
  const copy = useMemo(() => getStorefrontCopy(locale), [locale]);
  const pathname = useMemo(() => window.location.pathname, []);
  const publicDocument = useMemo(
    () => getPublicDocument(locale, pathname),
    [locale, pathname]
  );
  const isHome = pathname === "/";
  useEffect(() => {
    const meta = publicDocument
      ? getPublicDocumentMeta(locale, pathname)
      : isHome
        ? copy.meta
        : {
            title: locale === "zh-CN" ? "页面未找到 | musuw" : "Page not found | musuw",
            description: locale === "zh-CN"
              ? "该 musuw 页面不存在或已移动。"
              : "This musuw page does not exist or has moved."
          };
    document.documentElement.lang = locale;
    document.title = meta.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute("content", meta.description);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", `https://musuw.com${isHome ? "/" : pathname}`);

    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", isHome || publicDocument ? "index,follow" : "noindex,follow");
  }, [copy, isHome, locale, pathname, publicDocument]);

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
