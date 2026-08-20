import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { ArrowUpRight } from "@phosphor-icons/react/ArrowUpRight";
import { CalendarBlank } from "@phosphor-icons/react/CalendarBlank";
import { EnvelopeSimple } from "@phosphor-icons/react/EnvelopeSimple";
import { SiteFooter, SiteHeader } from "./components/SiteChrome";

const navigation = {
  en: [
    ["Terms", "/terms"],
    ["Privacy", "/privacy"],
    ["Refunds", "/refund-policy"],
    ["Subscriptions", "/subscription-policy"],
    ["Acceptable Use", "/acceptable-use"],
    ["Cookies", "/cookies"],
    ["Security", "/security"],
    ["Contact", "/contact"]
  ],
  "zh-CN": [
    ["服务条款", "/terms"],
    ["隐私政策", "/privacy"],
    ["退款政策", "/refund-policy"],
    ["订阅与取消", "/subscription-policy"],
    ["可接受使用", "/acceptable-use"],
    ["Cookie 说明", "/cookies"],
    ["安全概览", "/security"],
    ["联系我们", "/contact"]
  ]
};

function renderBlock(block, index) {
  if (block.type === "list") {
    return (
      <ul key={index}>
        {block.items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    );
  }

  if (block.type === "notice") {
    return <aside className="legal-notice" key={index}>{block.text}</aside>;
  }

  if (block.type === "email") {
    return (
      <a className="legal-action" href={`mailto:${block.address}`} key={index}>
        <EnvelopeSimple size={18} weight="bold" aria-hidden="true" />
        <span>{block.label}</span>
        <ArrowUpRight size={16} weight="bold" aria-hidden="true" />
      </a>
    );
  }

  if (block.type === "link") {
    return (
      <a className="legal-inline-link" href={block.href} key={index}>
        {block.label}
        <ArrowUpRight size={15} weight="bold" aria-hidden="true" />
      </a>
    );
  }

  return <p key={index}>{block.text}</p>;
}

export function LegalPage({ document, copy, locale }) {
  const labels = locale === "zh-CN"
    ? { back: "返回首页", updated: "生效日期", contents: "本页目录", policies: "公开文件" }
    : { back: "Back to home", updated: "Effective", contents: "On this page", policies: "Public documents" };

  return (
    <>
      <SiteHeader copy={copy} />
      <main className="legal-page">
        <div className="legal-glow" aria-hidden="true" />
        <div className="container legal-layout">
          <aside className="legal-sidebar" aria-label={labels.policies}>
            <a className="legal-back" href="/">
              <ArrowLeft size={16} weight="bold" aria-hidden="true" />
              {labels.back}
            </a>
            <p>{labels.policies}</p>
            <nav>
              {navigation[locale].map(([label, href]) => (
                <a className={document.path === href ? "active" : ""} href={href} key={href}>
                  {label}
                </a>
              ))}
            </nav>
          </aside>

          <article className="legal-document">
            <header className="legal-hero">
              <span className="legal-eyebrow">{document.eyebrow}</span>
              <h1>{document.title}</h1>
              <p>{document.summary}</p>
              <div className="legal-updated">
                <CalendarBlank size={17} weight="bold" aria-hidden="true" />
                <span>{labels.updated}: {document.updated}</span>
              </div>
            </header>

            <details className="legal-mobile-contents">
              <summary>{labels.contents}</summary>
              <ol>
                {document.sections.map((section, index) => (
                  <li key={section.heading}>
                    <a href={`#legal-section-${index + 1}`}>{section.heading}</a>
                  </li>
                ))}
              </ol>
            </details>

            <div className="legal-sections">
              {document.sections.map((section, sectionIndex) => (
                <section id={`legal-section-${sectionIndex + 1}`} key={section.heading}>
                  <h2>{section.heading}</h2>
                  <div className="legal-section-copy">
                    {section.blocks.map(renderBlock)}
                  </div>
                </section>
              ))}
            </div>
          </article>

          <aside className="legal-contents" aria-label={labels.contents}>
            <p>{labels.contents}</p>
            <ol>
              {document.sections.map((section, index) => (
                <li key={section.heading}>
                  <a href={`#legal-section-${index + 1}`}>{section.heading}</a>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}

export function NotFoundPage({ copy, locale }) {
  return (
    <>
      <SiteHeader copy={copy} />
      <main className="not-found-page">
        <div>
          <span>404</span>
          <h1>{locale === "zh-CN" ? "没有找到这个页面" : "This page could not be found"}</h1>
          <p>
            {locale === "zh-CN"
              ? "链接可能已经变化。您可以返回 musuw 官网继续查看产品。"
              : "The link may have changed. Return to the musuw homepage to continue."}
          </p>
          <a className="button button-primary" href="/">
            <span>{locale === "zh-CN" ? "返回首页" : "Back to home"}</span>
          </a>
        </div>
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
