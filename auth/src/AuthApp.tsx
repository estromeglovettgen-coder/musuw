import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import {
  type AuthRuntime,
  type AuthStartView,
  type AuthorizationContinuationView,
  type EmailOtpSendView,
  type IdentityCompletionView,
} from "./runtime";
import { getInitialAuthLocale, type AuthLocale } from "./locale";

export type InitialAuthScreen =
  | "callback_pending"
  | "consent_pending"
  | "login"
  | "logout_pending"
  | "start_pending";

type Screen =
  | InitialAuthScreen
  | "email_code"
  | "identity_pending";

export const CHECKOUT_INTENT_STORAGE_KEY = "musuw.checkout.intent";

export type CheckoutIntent = Readonly<{
  period: "monthly" | "yearly";
  plan: "plus" | "pro" | "max";
}>;

export function checkoutIntentFromSearch(search: string): CheckoutIntent | null {
  const parameters = new URLSearchParams(search);
  const plan = parameters.get("plan");
  const period = parameters.get("period");
  if (
    (plan !== "plus" && plan !== "pro" && plan !== "max") ||
    (period !== "monthly" && period !== "yearly")
  ) {
    return null;
  }
  return { period, plan };
}

export function checkoutWorkspacePathFromSearch(search: string): string {
  const intent = checkoutIntentFromSearch(search);
  if (intent === null) return "/";
  const parameters = new URLSearchParams({ plan: intent.plan, period: intent.period });
  return `/?${parameters.toString()}`;
}

export type AuthCopy = Readonly<{
  title: string;
  intro: string;
  google: string;
  status: string;
  email: string;
  emailPlaceholder: string;
  emailCodeSent: (email: string) => string;
  sendCode: string;
  verifyCode: string;
  changeEmail: string;
  errors: Readonly<{
    unavailable: string;
    oauthNotAllowed: string;
    authorization: string;
    invalidCode: string;
    incomplete: string;
    invalidEmail: string;
    emailSend: string;
    google: string;
  }>;
}>;

const AUTH_COPY: Readonly<Record<AuthLocale, AuthCopy>> = {
  "zh-CN": {
    title: "登录以进入知识库",
    intro: "使用 Google 或邮箱验证码继续。",
    google: "使用 Google 登录",
    status: "正在继续登录…",
    email: "邮箱",
    emailPlaceholder: "name@example.com",
    emailCodeSent: (email) => `已向 ${email} 发送六位验证码`,
    sendCode: "发送验证码",
    verifyCode: "验证并继续",
    changeEmail: "更换邮箱",
    errors: {
      unavailable: "登录暂不可用，请重试。",
      oauthNotAllowed: "此应用未获允许，无法继续授权。",
      authorization: "无法继续授权，请重新开始。",
      invalidCode: "验证码无效，请重新输入。",
      incomplete: "登录未完成，请重试。",
      invalidEmail: "请输入有效的邮箱地址。",
      emailSend: "暂时无法发送验证码，请稍后重试。",
      google: "暂时无法使用 Google 登录，请重试。",
    },
  },
  "en-US": {
    title: "Log in to access your knowledge base",
    intro: "Continue with Google or an email code.",
    google: "Continue with Google",
    status: "Continuing sign-in…",
    email: "Email",
    emailPlaceholder: "name@example.com",
    emailCodeSent: (email) => `We sent a six-digit code to ${email}`,
    sendCode: "Send code",
    verifyCode: "Verify and continue",
    changeEmail: "Use a different email",
    errors: {
      unavailable: "Sign-in is temporarily unavailable. Please try again.",
      oauthNotAllowed: "This app is not allowed to continue.",
      authorization: "Unable to continue authorization. Please start again.",
      invalidCode: "Invalid code. Please try again.",
      incomplete: "Sign-in was not completed. Please try again.",
      invalidEmail: "Enter a valid email address.",
      emailSend: "We couldn't send a code right now. Please try again later.",
      google: "Google sign-in is temporarily unavailable. Please try again.",
    },
  },
};

export function getAuthCopy(locale: AuthLocale): AuthCopy {
  return AUTH_COPY[locale];
}

export function initialAuthScreenForPathname(pathname: string): InitialAuthScreen {
  if (pathname === "/auth/start") return "start_pending";
  if (pathname === "/auth/callback") return "callback_pending";
  if (pathname === "/oauth/consent") return "consent_pending";
  if (pathname === "/auth/logout") return "logout_pending";
  return "login";
}

export function initialAuthErrorForPathname(
  pathname: string,
  locale: AuthLocale = "zh-CN",
): string | null {
  return pathname === "/auth/error" ? getAuthCopy(locale).errors.unavailable : null;
}

function startFailureMessage(result: AuthStartView, copy: AuthCopy): string | null {
  return result.state === "start_error" ? copy.errors.unavailable : null;
}

function failureMessage(
  result: AuthorizationContinuationView | IdentityCompletionView | EmailOtpSendView,
  copy: AuthCopy,
): string | null {
  if (result.state === "identity_complete" || result.state === "authorization_complete") return null;
  if (result.state === "authorization_login_required" || result.state === "email_otp_sent") return null;
  if (result.state === "authorization_error") {
    return result.code === "oauth_client_not_allowed"
      ? copy.errors.oauthNotAllowed
      : copy.errors.authorization;
  }
  if (result.state === "identity_error") {
    return result.code === "email_code_invalid"
      ? copy.errors.invalidCode
      : copy.errors.incomplete;
  }
  return result.code === "email_invalid"
    ? copy.errors.invalidEmail
    : copy.errors.emailSend;
}

export function AuthApp({ runtime }: Readonly<{ runtime: AuthRuntime }>) {
  const [locale] = useState<AuthLocale>(() => {
    if (typeof window === "undefined") return "en-US";
    return getInitialAuthLocale();
  });
  const copy = getAuthCopy(locale);
  const [screen, setScreen] = useState<Screen>(() => {
    if (typeof window === "undefined") return "login";
    return initialAuthScreenForPathname(window.location.pathname);
  });
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return initialAuthErrorForPathname(window.location.pathname, locale);
  });
  const handledRoute = useRef<string | null>(null);

  const applyIdentityCompletion = useCallback((result: IdentityCompletionView) => {
    const message = failureMessage(result, copy);
    if (message !== null) {
      setError(message);
      setScreen("login");
    }
  }, [copy]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = copy.title;
  }, [copy.title, locale]);

  useEffect(() => {
    if (window.location.pathname !== "/auth/start") return;
    const intent = checkoutIntentFromSearch(window.location.search);
    try {
      if (intent === null) {
        window.sessionStorage.removeItem(CHECKOUT_INTENT_STORAGE_KEY);
      } else {
        window.sessionStorage.setItem(CHECKOUT_INTENT_STORAGE_KEY, JSON.stringify(intent));
      }
    } catch {
      // Checkout remains available from General Settings when storage is blocked.
    }
  }, []);

  useEffect(() => {
    const route = `${screen}:${window.location.pathname}:${window.location.search}`;
    const routeAction =
      screen === "callback_pending" ||
      screen === "consent_pending" ||
      screen === "logout_pending" ||
      screen === "start_pending";
    if (routeAction && handledRoute.current === route) return;
    if (screen === "start_pending") {
      handledRoute.current = route;
      void runtime.resumeStart(checkoutWorkspacePathFromSearch(window.location.search)).then(
        (result) => {
          if (result.state === "start_login_required") {
            setScreen("login");
            return;
          }
          const message = startFailureMessage(result, copy);
          if (message !== null) {
            setError(message);
            setScreen("login");
          }
        },
        () => {
          setError(copy.errors.unavailable);
          setScreen("login");
        },
      );
      return;
    }
    if (screen === "callback_pending") {
      handledRoute.current = route;
      void runtime.completeCallback(window.location.search).then(applyIdentityCompletion, () => {
        setError(copy.errors.incomplete);
        setScreen("login");
      });
      return;
    }
    if (screen === "consent_pending") {
      handledRoute.current = route;
      void runtime.continueAuthorization(window.location.search).then(
        (result) => {
          if (result.state === "authorization_login_required") {
            setScreen("login");
            return;
          }
          const message = failureMessage(result, copy);
          if (message !== null) {
            setError(message);
            setScreen("login");
          }
        },
        () => {
          setError(copy.errors.authorization);
          setScreen("login");
        },
      );
      return;
    }
    if (screen === "logout_pending") {
      handledRoute.current = route;
      void runtime.signOut().finally(() => window.location.replace("/auth/start"));
    }
  }, [applyIdentityCompletion, copy, runtime, screen]);

  const startGoogle = useCallback(() => {
    setError(null);
    setScreen("identity_pending");
    void runtime.startGoogle().catch(() => {
      setError(copy.errors.google);
      setScreen("login");
    });
  }, [copy.errors.google, runtime]);

  const requestEmailCode = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      const result = await runtime.requestEmailOtp(email);
      const message = failureMessage(result, copy);
      if (message !== null) {
        setError(message);
        return;
      }
      if (result.state === "email_otp_sent") {
        setEmail(result.email);
        setScreen("email_code");
      }
    },
    [copy, email, runtime],
  );

  const verifyEmailCode = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const code = String(form.get("code") ?? "");
      setError(null);
      setScreen("identity_pending");
      const result = await runtime.verifyEmailOtp(email, code);
      applyIdentityCompletion(result);
    },
    [applyIdentityCompletion, email, runtime],
  );

  if (
    screen === "callback_pending" ||
    screen === "consent_pending" ||
    screen === "identity_pending" ||
    screen === "logout_pending" ||
    screen === "start_pending"
  ) {
    return (
      <main className="auth-page" aria-busy="true">
        <p aria-live="polite" className="auth-status">{copy.status}</p>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section aria-labelledby="auth-title" className="auth-panel">
        <h1 id="auth-title">{copy.title}</h1>
        <p className="auth-intro">{copy.intro}</p>

        <button className="auth-google" onClick={startGoogle} type="button">
          {copy.google}
        </button>

        {screen === "email_code" ? (
          <form className="auth-form" onSubmit={(event) => void verifyEmailCode(event)}>
            <label htmlFor="email-code">{copy.emailCodeSent(email)}</label>
            <input
              autoComplete="one-time-code"
              id="email-code"
              inputMode="numeric"
              maxLength={6}
              name="code"
              pattern="[0-9]{6}"
              required
            />
            <button type="submit">{copy.verifyCode}</button>
            <button className="auth-link" onClick={() => setScreen("login")} type="button">
              {copy.changeEmail}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={(event) => void requestEmailCode(event)}>
            <label htmlFor="email">{copy.email}</label>
            <input
              autoComplete="email"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder={copy.emailPlaceholder}
              required
              type="email"
              value={email}
            />
            <button type="submit">{copy.sendCode}</button>
          </form>
        )}

        {error !== null ? <p className="auth-error" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}
