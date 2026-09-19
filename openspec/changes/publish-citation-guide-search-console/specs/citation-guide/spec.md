## ADDED Requirements

### Requirement: Native bilingual article
The storefront SHALL serve one short citation-checking guide at `/guides/citation-checks` in English and `/zh/guides/citation-checks` in Simplified Chinese. Both initial HTTP responses SHALL contain readable article text without JavaScript. Both variants SHALL use the same component and content source at build time and in the browser.

#### Scenario: Reader or crawler opens a fixed-language URL
- **WHEN** either guide is requested with any country, language cookie or `lang` query value
- **THEN** the URL's language, article text, title and self-canonical remain consistent
- **AND** reciprocal language links, footer discovery and sitemap entries are present
- **AND** an unknown guide slug returns 404.

### Requirement: Verifiable fictional example
The guide SHALL identify Cedar as fictional, preserve the conditional date and unknown facts, and offer its three original source documents locally with an optional Gist mirror. It SHALL NOT claim document-only retrieval or universal answer accuracy.

#### Scenario: Reader checks an answer
- **WHEN** a reader expands the source section
- **THEN** all three local Markdown links return the original plain-text documents
- **AND** the displayed screenshot contains only the authorized fictional example
- **AND** the page remains readable on mobile and in both themes.

### Requirement: Public site verification
The owner-supplied Google site verification meta tag SHALL be present exactly once in the initial homepage and guide HTML and survive Worker localization.

#### Scenario: Verification before client rendering
- **WHEN** an unauthenticated client requests a localized homepage or guide
- **THEN** the response head contains the exact approved public verification token
- **AND** no client execution is required to read it.
