# Third-party notices

Musuw distributes and runs a locally adapted copy of
[Tencent WeKnora v0.7.2](https://github.com/Tencent/WeKnora/tree/v0.7.2).
The complete upstream license and its bundled third-party notices are retained
at [`weknora/LICENSE`](weknora/LICENSE).

The exact upstream tag, commit, source tree, and local-delta inventory are
recorded in:

- [`third_party/weknora/active-upstream-source.json`](third_party/weknora/active-upstream-source.json)
- [`third_party/weknora/v0.7.2-provenance.json`](third_party/weknora/v0.7.2-provenance.json)

The public homepage and authentication shell retain the notices distributed by
their own dependency manifests. No historical runtime or prior-project source
is part of the active Musuw product release.

## Operations console UI

- **Tencent TDesign Vue Next 1.19.2** and **TDesign Icons Vue Next 0.4.4** —
  the local operations console uses the existing MIT-licensed TDesign
  component and icon packages distributed in the WeKnora frontend dependency
  manifest. See the official
  [TDesign Vue Next](https://github.com/Tencent/tdesign-vue-next) and
  [TDesign Icons](https://github.com/Tencent/tdesign-icons) repositories. The
  corresponding license texts remain in each installed package.

## Bundled font and spreadsheet assets

- **Switzer webfonts** — the storefront's `public/fonts/switzer-*.woff2` files
  are distributed under the [Fontshare ITF Free Font License](https://www.fontshare.com/licenses/itf-ffl)
  by Indian Type Foundry. The official [Switzer family page](https://www.fontshare.com/fonts/switzer)
  is the source record. Any reuse or redistribution must follow that license;
  this repository does not grant additional font rights.
- **SheetJS Community Edition 0.20.2** — the frontend's intentionally
  retained `weknora/frontend/packages/xlsx-0.20.2.tgz` source archive is
  distributed under Apache-2.0. See the official [SheetJS source repository](https://git.sheetjs.com/sheetjs/sheetjs)
  and the package's included license text for the authoritative terms.
