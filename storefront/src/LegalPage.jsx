import { useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft";
import { ArrowUpRight } from "@phosphor-icons/react/ArrowUpRight";
import { CalendarBlank } from "@phosphor-icons/react/CalendarBlank";
import { Check } from "@phosphor-icons/react/Check";
import { EnvelopeSimple } from "@phosphor-icons/react/EnvelopeSimple";
import { SiteFooter, SiteHeader } from "./components/SiteChrome";
import { LEGAL_OPERATOR } from "./legalContent";

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

function ContactPage({ document, copy, locale, onLocaleChange }) {
  const [draftState, setDraftState] = useState("idle");
  const [draftHref, setDraftHref] = useState("");
  const isChinese = locale === "zh-CN";
  const labels = locale === "zh-CN"
    ? {
        back: "返回首页",
        pill: "联系我们",
        heroTitle: "让你的知识在 musuw 中真正流动。",
        heroSummary: "告诉我们你正在解决的问题，我们会从产品支持、知识工作流和账户事项开始帮你梳理下一步。",
        reasons: ["有来源依据的回答与引用", "计划、隐私与数据控制"],
        formLabel: "发送给 musuw 团队",
        firstName: "名",
        lastName: "姓",
        email: "邮箱",
        message: "留言",
        firstNamePlaceholder: "张",
        lastNamePlaceholder: "三",
        emailPlaceholder: "name@example.com",
        messagePlaceholder: "请简要告诉我们你需要什么帮助",
        submit: "提交",
        formNote: "提交后会打开你的邮件应用并生成草稿；musuw 不会从此表单直接发送邮件。",
        openDraft: "在邮件应用中打开草稿",
        ready: "草稿已准备好。请在邮件应用中检查并发送。",
        detailsEyebrow: "支持详情",
        detailsTitle: "需要更具体的帮助？",
        operator: "运营主体",
        categories: ["客户支持", "账单与退款", "隐私与安全", "支付审核"],
        updated: "生效日期",
      }
    : {
        back: "Back to home",
        pill: "Contact Us",
        heroTitle: "Keep your knowledge moving with musuw.",
        heroSummary: "Tell us what you are working through and we will help with product support, grounded knowledge workflows, and account questions.",
        reasons: ["Grounded answers with source citations", "Plans, privacy, and data controls"],
        formLabel: "Send a message to the musuw team",
        firstName: "First name",
        lastName: "Last name",
        email: "Email",
        message: "Message",
        firstNamePlaceholder: "Jane",
        lastNamePlaceholder: "Smith",
        emailPlaceholder: "jane@example.com",
        messagePlaceholder: "Tell us briefly what you are working on",
        submit: "Submit",
        formNote: "Submitting opens your email app with a draft. musuw does not send messages directly from this form.",
        openDraft: "Open the draft in your email app",
        ready: "Your draft is ready. Review it in your email app before sending.",
        detailsEyebrow: "Support details",
        detailsTitle: "Need a more specific answer?",
        operator: "Operator",
        categories: ["Support", "Billing and refunds", "Privacy and security", "Merchant review"],
        updated: "Effective",
      };
  const handleSubmit = (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const subject = isChinese ? "musuw 联系请求" : "musuw contact request";
    const body = [
      `${labels.firstName}: ${String(values.get("firstName") ?? "").trim()}`,
      `${labels.lastName}: ${String(values.get("lastName") ?? "").trim()}`,
      `${labels.email}: ${String(values.get("email") ?? "").trim()}`,
      "",
      `${labels.message}:`,
      String(values.get("message") ?? "").trim()
    ].join("\\n");
    const href = `mailto:${LEGAL_OPERATOR.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setDraftHref(href);
    setDraftState("ready");
    window.location.assign(href);
  };
  const contactSections = document.sections.map((section, index) => {
    if (index === 0 && !isChinese) {
      return {
        ...section,
        blocks: section.blocks.filter((block) => block.text !== LEGAL_OPERATOR.chineseName)
      };
    }
    return section;
  });

  return (
    <>
      <SiteHeader copy={copy} locale={locale} onLocaleChange={onLocaleChange} />
      <main className="contact-page">
        <div className="container contact-layout">
          <section className="contact-intro">
            <a className="legal-back" href="/">
              <ArrowLeft size={16} weight="bold" aria-hidden="true" />
              {labels.back}
            </a>
            <span className="contact-pill">
              <EnvelopeSimple size={17} weight="bold" aria-hidden="true" />
              {labels.pill}
            </span>
            <h1>{labels.heroTitle}</h1>
            <p className="contact-summary">{labels.heroSummary}</p>
            <ul className="contact-reason-list">
              {labels.reasons.map((reason) => (
                <li key={reason}>
                  <Check size={18} weight="bold" aria-hidden="true" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="contact-form-shell" aria-label={labels.formLabel}>
            <form className="contact-form" onSubmit={handleSubmit} aria-describedby="contact-form-note">
              <div className="contact-field-grid">
                <label htmlFor="contact-first-name">
                  <span>{labels.firstName}</span>
                  <input id="contact-first-name" name="firstName" type="text" placeholder={labels.firstNamePlaceholder} autoComplete="given-name" required />
                </label>
                <label htmlFor="contact-last-name">
                  <span>{labels.lastName}</span>
                  <input id="contact-last-name" name="lastName" type="text" placeholder={labels.lastNamePlaceholder} autoComplete="family-name" required />
                </label>
              </div>
              <label htmlFor="contact-email">
                <span>{labels.email}</span>
                <input id="contact-email" name="email" type="email" placeholder={labels.emailPlaceholder} autoComplete="email" required />
              </label>
              <label htmlFor="contact-message">
                <span>{labels.message}</span>
                <textarea id="contact-message" name="message" placeholder={labels.messagePlaceholder} required rows="7" />
              </label>
              <button className="contact-submit" type="submit">
                <span>{labels.submit}</span>
                <ArrowUpRight size={17} weight="bold" aria-hidden="true" />
              </button>
              <p className="contact-form-note" id="contact-form-note" role="status" aria-live="polite">
                {draftState === "ready" ? labels.ready : labels.formNote}
              </p>
              {draftState === "ready" && draftHref ? (
                <a className="contact-draft-link" href={draftHref}>{labels.openDraft}</a>
              ) : null}
            </form>
          </section>
        </div>

        <section className="container contact-legal-strip" aria-labelledby="contact-details-title">
          <div className="contact-legal-heading">
            <span className="legal-eyebrow">{labels.detailsEyebrow}</span>
            <h2 id="contact-details-title">{labels.detailsTitle}</h2>
            <div className="legal-updated">
              <CalendarBlank size={17} weight="bold" aria-hidden="true" />
              <span>{labels.updated}: {document.updated}</span>
            </div>
          </div>
          <div className="contact-legal-list">
            {contactSections.map((section, index) => (
              <article className="contact-legal-item" key={section.heading}>
                <h3>{index === 0 ? labels.operator : labels.categories[index - 1] ?? section.heading}</h3>
                <div className="contact-legal-copy">
                  {section.blocks.map(renderBlock)}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}

export function LegalPage({ document, copy, locale, onLocaleChange }) {
  if (document.path === "/contact") {
    return <ContactPage document={document} copy={copy} locale={locale} onLocaleChange={onLocaleChange} />;
  }

  const labels = locale === "zh-CN"
    ? { back: "返回首页", updated: "生效日期", contents: "本页目录", policies: "公开文件" }
    : { back: "Back to home", updated: "Effective", contents: "On this page", policies: "Public documents" };

  return (
    <>
      <SiteHeader copy={copy} locale={locale} onLocaleChange={onLocaleChange} />
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

export function NotFoundPage({ copy, locale, onLocaleChange }) {
  return (
    <>
      <SiteHeader copy={copy} locale={locale} onLocaleChange={onLocaleChange} />
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
