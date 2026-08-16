import { createClient } from "@supabase/supabase-js";

import type { AuthConfig, IdentityClient, SessionStorageLike } from "./runtime";

const supabaseStorageKey = "musnow.supabase.pkce";

/**
 * This is deliberately a thin type boundary over supabase-js.  OAuth code
 * issuance and consent remain Supabase's implementation, not an application
 * reimplementation.
 */
export function createSupabaseIdentityClient(
  config: AuthConfig,
  storage: SessionStorageLike,
): IdentityClient {
  const client = createClient(config.supabaseUrl, config.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "pkce",
      persistSession: true,
      storage,
      storageKey: supabaseStorageKey,
    },
  });

  return Object.freeze({
    async exchangeCodeForSession(code: string) {
      const result = await client.auth.exchangeCodeForSession(code);
      return {
        data: {
          session:
            result.data.session === null
              ? null
              : { access_token: result.data.session.access_token },
        },
        error: result.error,
      };
    },
    async getSession() {
      const result = await client.auth.getSession();
      return {
        data: {
          session:
            result.data.session === null
              ? null
              : { access_token: result.data.session.access_token },
        },
        error: result.error,
      };
    },
    oauth: Object.freeze({
      async approveAuthorization(
        authorizationId: string,
        options: Parameters<IdentityClient["oauth"]["approveAuthorization"]>[1],
      ) {
        const result = await client.auth.oauth.approveAuthorization(authorizationId, options);
        return {
          data: result.data === null ? null : { redirect_url: result.data.redirect_url },
          error: result.error,
        };
      },
      async getAuthorizationDetails(authorizationId: string) {
        const result = await client.auth.oauth.getAuthorizationDetails(authorizationId);
        return { data: result.data, error: result.error };
      },
    }),
    async signInWithOAuth(input: Parameters<IdentityClient["signInWithOAuth"]>[0]) {
      const result = await client.auth.signInWithOAuth(input);
      return { data: { url: result.data.url }, error: result.error };
    },
    async signInWithOtp(input: Parameters<IdentityClient["signInWithOtp"]>[0]) {
      const result = await client.auth.signInWithOtp(input);
      return { error: result.error };
    },
    async signOut(input: Parameters<IdentityClient["signOut"]>[0]) {
      storage.removeItem(supabaseStorageKey);
      try {
        return await client.auth.signOut(input);
      } finally {
        storage.removeItem(supabaseStorageKey);
      }
    },
    async verifyOtp(input: Parameters<IdentityClient["verifyOtp"]>[0]) {
      const result = await client.auth.verifyOtp(input);
      return {
        data: {
          session:
            result.data.session === null
              ? null
              : { access_token: result.data.session.access_token },
        },
        error: result.error,
      };
    },
  });
}
