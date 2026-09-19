import { SiteFooter, SiteHeader } from "./components/SiteChrome";
import { CITATION_GUIDES, CITATION_GUIDE_DOCUMENTS, CITATION_GUIDE_SOURCE } from "./citationGuideContent";
import "./citation-guide.css";

export function CitationGuidePage({ copy, guide, onLocaleChange, theme, onThemeToggle }) {
  return (
    <div className="citation-guide-page">
      <SiteHeader copy={copy} locale={guide.locale} onLocaleChange={onLocaleChange} theme={theme} onThemeToggle={onThemeToggle} />
      <main className="container citation-guide-layout">
        <article>
          <nav className="citation-guide-languages" aria-label={guide.languageLabel}>
            <a href={CITATION_GUIDES.en.path} lang="en" aria-current={guide.locale === "en" ? "page" : undefined}>English</a>
            <span aria-hidden="true"> / </span>
            <a href={CITATION_GUIDES["zh-CN"].path} lang="zh-CN" aria-current={guide.locale === "zh-CN" ? "page" : undefined}>中文</a>
          </nav>
          <h1>{guide.title}</h1>
          <p>{guide.intro}</p>
          <p>{guide.exampleBefore}<a href="#cedar-source-files">{guide.sourceLabel}</a>{guide.exampleAfter}</p>
          <details id="cedar-source-files" className="citation-guide-sources">
            <summary>{guide.sourceSummary}</summary>
            <ul>{CITATION_GUIDE_DOCUMENTS.map((filename) => <li key={filename}><a href={`/examples/cedar/${filename}`} download>{filename}</a></li>)}</ul>
            <a href={CITATION_GUIDE_SOURCE}>{guide.sourceMirror}</a>
          </details>
          <figure>
            <video controls playsInline preload="none" poster={guide.videoPoster} aria-label={guide.videoLabel}>
              <source src={guide.video} type="video/mp4" />
              <track kind="captions" src={guide.captions} srcLang={guide.locale} label={guide.locale === "en" ? "English" : "中文"} />
              <a href={guide.video}>{guide.videoLabel}</a>
            </video>
            <figcaption>{guide.videoCaption} <a href={guide.video} download>{guide.videoDownload}</a></figcaption>
          </figure>
          <ol className="citation-guide-checks">
            {guide.checks.map((check) => <li key={check.title}><strong>{check.title}</strong> {check.body}</li>)}
          </ol>
          <figure>
            <a href={guide.image}><img src={guide.image} alt={guide.imageAlt} width="1512" height="782" loading="lazy" /></a>
            <figcaption>{guide.imageCaption}</figcaption>
          </figure>
          <p><a className="citation-guide-cta" href="/#demo">{guide.cta} →</a></p>
          <p className="citation-guide-disclosure">{guide.disclosure}</p>
        </article>
      </main>
      <SiteFooter copy={copy} />
    </div>
  );
}
