## Why

Knowledge workers need a short, checkable example of reviewing AI citations. The owned storefront needs crawlable bilingual article text and the owner-provided public Search Console verification tag.

## What Changes

- Publish one citation-checking guide in English and Simplified Chinese with fixed language URLs, rendered at build time from the same React component and content source used in the browser.
- Reuse existing navigation, theme and metadata; add sitemap entries, reciprocal language links and one footer entry.
- Include one real fictional-example screenshot and three original Markdown source downloads, with the existing public Gist as an optional mirror.
- Preserve the public Google verification tag through Worker localization.

## Impact

Storefront-only change. No account, model, billing, tracking, dependency, CMS or production infrastructure changes. Publication and Search Console verification occur after the model release, through a separate reviewed PR.
