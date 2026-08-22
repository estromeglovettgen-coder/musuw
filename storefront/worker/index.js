import { localizeDocumentResponse, selectLocale } from "./localization.js";

function notFound() {
  return Response.json(
    { error: "NOT_FOUND" },
    { status: 404, headers: { "cache-control": "private, no-store" } },
  );
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    return notFound();
  }

  const assetResponse = await env.ASSETS.fetch(request);
  const contentType = assetResponse.headers.get("content-type") ?? "";
  if (request.method === "GET" && contentType.toLowerCase().includes("text/html")) {
    return localizeDocumentResponse(
      assetResponse,
      selectLocale(
        request.cf?.country,
        request.headers.get("cookie") ?? "",
        url.searchParams.get("lang") ?? "",
      ),
      url.pathname,
      url.hostname,
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
