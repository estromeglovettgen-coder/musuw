import { describe, expect, it } from "vitest";

import { authConfigFromEnvironment } from "./config";

function environment(publicOrigin: string): ImportMetaEnv {
  return {
    MODE: "production",
    BASE_URL: "/auth/",
    DEV: false,
    PROD: true,
    SSR: false,
    VITE_AUTH_PUBLIC_ORIGIN: publicOrigin,
    VITE_SUPABASE_URL: "https://identity.example",
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_key",
    VITE_WEKNORA_OAUTH_CLIENT_ID: "weknora-client",
  };
}

describe("auth public origin configuration", () => {
  it.each([
    ["https://app.musuw.com", "https://app.musuw.com"],
    ["https://staging-app.musuw.com", "https://staging-app.musuw.com"],
    ["http://localhost:4190", "http://localhost:4190"],
    ["http://127.0.0.1:4190", "http://127.0.0.1:4190"],
  ])("accepts the exact supported origin %s", (input, expectedOrigin) => {
    expect(authConfigFromEnvironment(environment(input)).publicOrigin).toBe(expectedOrigin);
  });

  it.each([
    "",
    "https://unknown.example",
    "https://app.musuw.com https://staging-app.musuw.com",
    "http://app.musuw.com",
    "https://staging-app.musuw.com:4090",
    "http://localhost:4090",
    "https://app.musuw.com/callback",
    "https://app.musuw.com?next=https://evil.example",
  ])("rejects an unsafe public origin %s", (publicOrigin) => {
    expect(() => authConfigFromEnvironment(environment(publicOrigin))).toThrow(
      "Authentication configuration is unavailable",
    );
  });

  it("requires the new origin key instead of silently falling back to the browser host", () => {
    const missing = environment("https://app.musuw.com");
    delete (missing as Record<string, unknown>)["VITE_AUTH_PUBLIC_ORIGIN"];

    expect(() => authConfigFromEnvironment(missing)).toThrow(
      "Authentication configuration is unavailable",
    );
  });
});
