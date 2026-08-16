import type { AuthConfig } from "./runtime";

type AuthPublicEnvironmentKey =
  | "VITE_AUTH_PUBLIC_ORIGIN"
  | "VITE_SUPABASE_URL"
  | "VITE_SUPABASE_PUBLISHABLE_KEY"
  | "VITE_WEKNORA_OAUTH_CLIENT_ID";

function publicValue(environment: ImportMetaEnv, key: AuthPublicEnvironmentKey): string {
  const value = environment[key];
  if (typeof value !== "string" || value === "" || value !== value.trim()) {
    throw new Error("Authentication configuration is unavailable");
  }
  return value;
}

function publicOriginFromEnvironment(environment: ImportMetaEnv): string {
  const configuredOrigin = publicValue(environment, "VITE_AUTH_PUBLIC_ORIGIN");
  try {
    const origin = new URL(configuredOrigin);
    const localDevelopmentOrigin =
      origin.protocol === "http:" &&
      (origin.hostname === "127.0.0.1" || origin.hostname === "localhost") &&
      origin.port === "4190";
    const publicHTTPSOrigin =
      origin.protocol === "https:" &&
      (origin.hostname === "app.musuw.com" || origin.hostname === "staging-app.musuw.com") &&
      (origin.port === "" || origin.port === "443");
    if (
      origin.username !== "" ||
      origin.password !== "" ||
      origin.pathname !== "/" ||
      origin.search !== "" ||
      origin.hash !== "" ||
      (!localDevelopmentOrigin && !publicHTTPSOrigin)
    ) {
      throw new Error("unsafe public origin");
    }
    return origin.origin;
  } catch {
    throw new Error("Authentication configuration is unavailable");
  }
}

/** Only public Supabase project settings and the registered native client ID belong in the bundle. */
export function authConfigFromEnvironment(environment: ImportMetaEnv): AuthConfig {
  const publicOrigin = publicOriginFromEnvironment(environment);
  const supabaseUrl = publicValue(environment, "VITE_SUPABASE_URL");
  try {
    const url = new URL(supabaseUrl);
    const localDevelopmentURL =
      url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
    if (url.username !== "" || url.password !== "" || (url.protocol !== "https:" && !localDevelopmentURL)) {
      throw new Error("unsafe public URL");
    }
    return {
      publicOrigin,
      publishableKey: publicValue(environment, "VITE_SUPABASE_PUBLISHABLE_KEY"),
      supabaseUrl: url.origin,
      weknoraOAuthClientId: publicValue(environment, "VITE_WEKNORA_OAUTH_CLIENT_ID"),
    };
  } catch {
    throw new Error("Authentication configuration is unavailable");
  }
}
