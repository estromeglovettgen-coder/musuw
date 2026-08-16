import { describe, expect, it } from "vitest";

import { getAuthCopy, initialAuthErrorForPathname, initialAuthScreenForPathname } from "./AuthApp";

describe("auth shell browser routes", () => {
  it("treats the public start route as a session-resume route, not a login form", () => {
    expect(initialAuthScreenForPathname("/auth/start")).toBe("start_pending");
  });

  it("uses only the public auth paths for start, callback, and logout", () => {
    expect(initialAuthScreenForPathname("/auth/callback")).toBe("callback_pending");
    expect(initialAuthScreenForPathname("/auth/logout")).toBe("logout_pending");
    expect(initialAuthScreenForPathname("/logout")).toBe("login");
  });

  it("shows a generic explicit-retry message on the native callback failure route", () => {
    expect(initialAuthScreenForPathname("/auth/error")).toBe("login");
    expect(initialAuthErrorForPathname("/auth/error")).toBe("登录暂不可用，请重试。");
    expect(initialAuthErrorForPathname("/auth/start")).toBeNull();
  });

  it("keeps Supabase's OAuth consent route outside the auth asset prefix", () => {
    expect(initialAuthScreenForPathname("/oauth/consent")).toBe("consent_pending");
  });
});

describe("auth shell localized copy", () => {
  it("has complete visible Chinese and English entry copy", () => {
    for (const locale of ["zh-CN", "en-US"] as const) {
      const copy = getAuthCopy(locale);
      expect(copy.title).not.toBe("");
      expect(copy.intro).not.toBe("");
      expect(copy.google).not.toBe("");
      expect(copy.status).not.toBe("");
      expect(copy.email).not.toBe("");
      expect(copy.emailCodeSent("user@example.com")).toContain("user@example.com");
      expect(copy.sendCode).not.toBe("");
      expect(copy.verifyCode).not.toBe("");
      expect(copy.changeEmail).not.toBe("");
      for (const message of Object.values(copy.errors)) expect(message).not.toBe("");
    }
    expect(getAuthCopy("en-US").title).toMatch(/knowledge base/i);
    expect(getAuthCopy("zh-CN").title).toContain("知识库");
  });
});
