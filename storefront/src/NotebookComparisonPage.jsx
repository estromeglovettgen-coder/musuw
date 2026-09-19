import { SiteFooter, SiteHeader } from "./components/SiteChrome";
import { CITATION_GUIDES } from "./citationGuideContent";
import { NOTEBOOK_COMPARISONS, NOTEBOOK_COMPARISON_SOURCES } from "./notebookComparisonContent";
import "./citation-guide.css";
import "./notebook-comparison.css";

export function NotebookComparisonPage({ copy, comparison, onLocaleChange, theme, onThemeToggle }) {
  const guide = CITATION_GUIDES[comparison.locale];
  return (
    <div className="notebook-comparison-page">
      <SiteHeader copy={copy} locale={comparison.locale} onLocaleChange={onLocaleChange} theme={theme} onThemeToggle={onThemeToggle} />
      <main className="container citation-guide-layout comparison-layout">
        <article>
          <nav className="citation-guide-languages" aria-label={comparison.languageLabel}>
            {Object.values(NOTEBOOK_COMPARISONS).map((page, index) => <span key={page.locale}>
              {index > 0 && <span aria-hidden="true"> / </span>}
              <a href={page.path} lang={page.locale} aria-current={page.locale === comparison.locale ? "page" : undefined}>{page.locale === "en" ? "English" : "中文"}</a>
            </span>)}
          </nav>
          <h1>{comparison.title}</h1>
          <p>{comparison.intro}</p>
          <p>{comparison.note} <a href={NOTEBOOK_COMPARISON_SOURCES[0]}>[1]</a></p>
          <p><a className="citation-guide-cta" href={guide.path}>{comparison.demo} →</a></p>
          <div className="comparison-table-scroll" role="region" aria-label={comparison.tableLabel} tabIndex={0}>
            <table>
              <caption>{comparison.tableLabel}</caption>
              <thead><tr><th scope="col">{comparison.column}</th><th scope="col">Musuw</th><th scope="col">Gemini Notebook <a href="#comparison-sources">[2, 3]</a></th></tr></thead>
              <tbody>{comparison.rows.map(([label, musuw, google]) => <tr key={label}><th scope="row">{label}</th><td>{musuw}</td><td>{google}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="comparison-scroll-hint">{comparison.scrollHint}</p>
          <h2>{comparison.musuwTitle}</h2>
          <p>{comparison.musuwBody}</p>
          <figure>
            <a href="/images/musuw-wiki-page.jpg"><img src="/images/musuw-wiki-page.jpg" width="3024" height="1898" alt={comparison.imageAlt} loading="lazy" /></a>
            <figcaption>{comparison.imageCaption}</figcaption>
          </figure>
          <h2>{comparison.googleTitle}</h2>
          <p>{comparison.googleBody} <a href={NOTEBOOK_COMPARISON_SOURCES[1]}>[2]</a></p>
          <h2>{comparison.evaluationTitle}</h2>
          <p>{comparison.evaluationBody}</p>
          <p><a className="citation-guide-cta" href={`/?lang=${comparison.locale}#pricing`}>{comparison.pricing} →</a></p>
          <h2 id="comparison-sources">{comparison.sourcesTitle}</h2>
          <ol className="comparison-sources">{NOTEBOOK_COMPARISON_SOURCES.map((href, index) => <li key={href}><a href={href}>{comparison.sourceLabels[index]}</a></li>)}</ol>
          <p className="citation-guide-disclosure">{comparison.disclosure}</p>
        </article>
      </main>
      <SiteFooter copy={copy} />
    </div>
  );
}
