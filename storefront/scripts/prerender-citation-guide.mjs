import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { CITATION_GUIDES } from "../src/citationGuideContent.js";
import { getStorefrontCopy } from "../src/i18n.js";
import { localizeDocumentResponse } from "../worker/localization.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const shell = await readFile(join(root, "dist/index.html"), "utf8");
if (!shell.includes('<div id="root"></div>')) throw new Error("Storefront build is missing its root element");
const server = await createServer({ root, appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
try {
  const { CitationGuidePage } = await server.ssrLoadModule("/src/CitationGuidePage.jsx");
  for (const guide of Object.values(CITATION_GUIDES)) {
    const markup = renderToStaticMarkup(React.createElement(CitationGuidePage, {
      guide, copy: getStorefrontCopy(guide.locale), theme: "light",
    }));
    const response = await localizeDocumentResponse(new Response(
      shell.replace('<div id="root"></div>', () => `<div id="root">${markup}</div>`),
      { headers: { "content-type": "text/html" } },
    ), guide.locale, guide.path);
    // Flat .html files keep Cloudflare's native clean URL free of a trailing slash.
    const output = join(root, "dist", `${guide.path.slice(1)}.html`);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, await response.text());
  }
} finally {
  await server.close();
}
