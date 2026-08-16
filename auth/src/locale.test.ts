import { describe, expect, it } from "vitest";

import { resolveInitialAuthLocale } from "./locale";

describe("auth locale resolution", () => {
  it("prefers a saved product preference over the website signal and browser", () => {
    expect(resolveInitialAuthLocale({
      storage: { getItem: () => "ru-RU" },
      cookie: "musuw_locale=zh-CN",
      languages: ["zh-CN"],
    })).toBe("en-US");
    expect(resolveInitialAuthLocale({
      storage: { getItem: () => "zh-CN" },
      cookie: "musuw_locale=en",
      languages: ["en-US"],
    })).toBe("zh-CN");
  });

  it("uses the website signal before browser language", () => {
    expect(resolveInitialAuthLocale({
      storage: { getItem: () => null },
      cookie: "foo=bar; musuw_locale=zh-CN",
      languages: ["en-US"],
    })).toBe("zh-CN");
  });

  it("maps Chinese browser languages to Chinese and defaults unsupported browsers to English", () => {
    expect(resolveInitialAuthLocale({
      storage: { getItem: () => null },
      cookie: "",
      languages: ["zh-Hans-CN", "en-US"],
    })).toBe("zh-CN");
    expect(resolveInitialAuthLocale({
      storage: { getItem: () => null },
      cookie: "",
      languages: ["fr-FR"],
    })).toBe("en-US");
  });
});
