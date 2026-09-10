import { normalizeCountry } from "../src/pricingLocalization.js";
import { localizeDocumentResponse, selectLocale } from "./localization.js";

function requestCountry(request) {
  return normalizeCountry(request.cf?.country || request.headers.get("CF-IPCountry"));
}

function notFound() {
  return Response.json(
    { error: "NOT_FOUND" },
    { status: 404, headers: { "cache-control": "private, no-store" } },
  );
}

const partnerFiles = new Set(["/", "/app.js", "/data.js", "/style.css", "/musuw-logo.png"]);

async function partnerBoardResponse(request, env, url) {
  if (!partnerFiles.has(url.pathname)) return notFound();
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
  }
  const assetUrl = new URL(url);
  assetUrl.pathname = `/partner-board${url.pathname}`;
  assetUrl.search = "";
  // Public static assets do not need the parent-domain session or API headers.
  const response = await env.ASSETS.fetch(new Request(assetUrl, { method: request.method }));
  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=0, must-revalidate");
  headers.set("x-robots-tag", "noindex, nofollow");
  headers.set("x-content-type-options", "nosniff");
  headers.delete("set-cookie");
  if (url.pathname === "/" && response.ok) {
    const locale = url.searchParams.get("lang") === "en" ? "en" : "zh-CN";
    headers.set("content-language", locale);
    headers.set("cache-control", "no-store");
    headers.delete("etag");
    headers.delete("content-length");
    if (request.method === "GET") {
      let html = await response.text();
      html = html.replace('<html lang="zh-CN">', `<html lang="${locale}">`);
      if (locale === "en") html = html.replace("Musuw 推广榜单 · 模拟数据", "Musuw Partner Leaderboard · Simulated data");
      return new Response(html, { status: response.status, headers });
    }
  }
  return new Response(response.body, { status: response.status, headers });
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  if (url.hostname === "partners.musuw.com") return partnerBoardResponse(request, env, url);
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return notFound(); }
  if (pathname === "/partner-board" || pathname.startsWith("/partner-board/")) return notFound();
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    return notFound();
  }

  const assetResponse = await env.ASSETS.fetch(request);
  const contentType = assetResponse.headers.get("content-type") ?? "";
  if (request.method === "GET" && contentType.toLowerCase().includes("text/html")) {
    const country = requestCountry(request);
    return localizeDocumentResponse(
      assetResponse,
      selectLocale(
        country,
        request.headers.get("cookie") ?? "",
        url.searchParams.get("lang") ?? "",
      ),
      url.pathname,
      url.hostname,
      country,
    );
  }
  if (request.method === "GET" && url.pathname.startsWith("/assets/")) {
    const headers = new Headers(assetResponse.headers);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });
  }
  return assetResponse;
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
