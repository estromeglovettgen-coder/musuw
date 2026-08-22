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

export const AUTH_LEGAL_LINKS = Object.freeze({
  privacy: "https://musuw.com/privacy",
  terms: "https://musuw.com/terms",
});

const EMAIL_CODE_COOLDOWN_SECONDS = 60;

export function authLegalHref(
  document: keyof typeof AUTH_LEGAL_LINKS,
  locale: AuthLocale,
): string {
  return `${AUTH_LEGAL_LINKS[document]}?lang=${locale === "zh-CN" ? "zh-CN" : "en"}`;
}

export function maskAuthEmail(value: string): string {
  const separator = value.indexOf("@");
  if (separator <= 0 || separator === value.length - 1) return "••••";
  const local = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

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
  divider: string;
  status: string;
  email: string;
  emailPlaceholder: string;
  emailCodeSent: (email: string) => string;
  sendCode: string;
  sendingCode: string;
  verifyCode: string;
  changeEmail: string;
  resendCode: string;
  resendIn: (seconds: number) => string;
  legal: Readonly<{
    acknowledgement: string;
    connector: string;
    privacy: string;
    terms: string;
  }>;
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
    title: "登录 Musuw",
    intro: "使用 Google 或邮箱验证码继续。",
    google: "使用 Google 登录",
    divider: "或",
    status: "正在继续登录…",
    email: "邮箱",
    emailPlaceholder: "name@example.com",
    emailCodeSent: (email) => `已向 ${email} 发送六位验证码`,
    sendCode: "发送验证码",
    sendingCode: "发送中…",
    verifyCode: "验证并继续",
    changeEmail: "更换邮箱",
    resendCode: "重新发送验证码",
    resendIn: (seconds) => `${seconds} 秒后可重新发送`,
    legal: {
      acknowledgement: "继续即表示你同意",
      terms: "《服务条款》",
      connector: "，并确认已阅读",
      privacy: "《隐私政策》",
    },
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
    title: "Log in to Musuw",
    intro: "Continue with Google or an email code.",
    google: "Continue with Google",
    divider: "or",
    status: "Continuing sign-in…",
    email: "Email",
    emailPlaceholder: "name@example.com",
    emailCodeSent: (email) => `We sent a six-digit code to ${email}`,
    sendCode: "Send code",
    sendingCode: "Sending…",
    verifyCode: "Verify and continue",
    changeEmail: "Use a different email",
    resendCode: "Resend code",
    resendIn: (seconds) => `Resend in ${seconds}s`,
    legal: {
      acknowledgement: "By continuing, you agree to the",
      terms: "Terms of Service",
      connector: "and acknowledge the",
      privacy: "Privacy Policy",
    },
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
  const [verificationCode, setVerificationCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
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
    if (resendAvailableAt === null) return;

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1_000));
      setResendSeconds(remaining);
      if (remaining === 0) setResendAvailableAt(null);
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);

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
    if (screen !== "login" || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    setScreen("identity_pending");
    void runtime.startGoogle().catch(() => {
      setError(copy.errors.google);
      setScreen("login");
      setIsSubmitting(false);
    });
  }, [copy.errors.google, isSubmitting, runtime, screen]);

  const sendEmailCode = useCallback(async () => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await runtime.requestEmailOtp(email);
      const message = failureMessage(result, copy);
      if (message !== null) {
        setError(message);
        return;
      }
      if (result.state === "email_otp_sent") {
        setEmail(result.email);
        setVerificationCode("");
        setResendAvailableAt(Date.now() + EMAIL_CODE_COOLDOWN_SECONDS * 1_000);
        setResendSeconds(EMAIL_CODE_COOLDOWN_SECONDS);
        setScreen("email_code");
      }
    } catch {
      setError(copy.errors.emailSend);
    } finally {
      setIsSubmitting(false);
    }
  }, [copy, email, isSubmitting, runtime]);

  const requestEmailCode = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await sendEmailCode();
    },
    [sendEmailCode],
  );

  const resendEmailCode = useCallback(() => {
    if (resendSeconds > 0) return;
    void sendEmailCode();
  }, [resendSeconds, sendEmailCode]);

  const verifyEmailCode = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSubmitting) return;
      setError(null);
      setScreen("identity_pending");
      setIsSubmitting(true);
      try {
        const result = await runtime.verifyEmailOtp(email, verificationCode);
        const message = failureMessage(result, copy);
        if (message !== null) {
          setError(message);
          setScreen("email_code");
        } else {
          applyIdentityCompletion(result);
        }
      } catch {
        setError(copy.errors.incomplete);
        setScreen("email_code");
      } finally {
        setIsSubmitting(false);
      }
    },
    [applyIdentityCompletion, copy, email, isSubmitting, runtime, verificationCode],
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
        <section aria-labelledby="auth-status-title" className="auth-card auth-card--status">
          <img alt="Musuw" className="auth-logo" height="48" src="/musuw-logo.png" width="48" />
          <p aria-live="polite" className="auth-status" id="auth-status-title">{copy.status}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section aria-labelledby="auth-title" className="auth-card" aria-busy={isSubmitting}>
        <header className="auth-header">
          <img alt="Musuw" className="auth-logo" height="48" src="/musuw-logo.png" width="48" />
        </header>
        <h1 id="auth-title">{copy.title}</h1>
        <p className="auth-intro">{copy.intro}</p>

        <button
          className="auth-google"
          disabled={screen !== "login" || isSubmitting}
          onClick={startGoogle}
          type="button"
        >
          {copy.google}
        </button>

        <div className="auth-divider" role="separator">
          <span>{copy.divider}</span>
        </div>

        {screen === "email_code" ? (
          <form
            className="auth-form"
            key="email-code"
            noValidate
            onSubmit={(event) => void verifyEmailCode(event)}
          >
            <label htmlFor="email-code">{copy.emailCodeSent(maskAuthEmail(email))}</label>
            <input
              aria-describedby={error === copy.errors.invalidCode ? "auth-error" : undefined}
              aria-invalid={error === copy.errors.invalidCode}
              autoComplete="one-time-code"
              autoFocus
              id="email-code"
              onChange={(event) => {
                setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                if (error !== null) setError(null);
              }}
              inputMode="numeric"
              maxLength={6}
              name="code"
              pattern="[0-9]{6}"
              required
              value={verificationCode}
            />
            <button disabled={isSubmitting || verificationCode.length !== 6} type="submit">
              {copy.verifyCode}
            </button>
            <div className="auth-form-actions">
              <button
                className="auth-link auth-resend"
                disabled={isSubmitting || resendSeconds > 0}
                onClick={resendEmailCode}
                type="button"
              >
                {isSubmitting
                  ? copy.sendingCode
                  : resendSeconds > 0
                    ? copy.resendIn(resendSeconds)
                    : copy.resendCode}
              </button>
              <button
                className="auth-link"
                disabled={isSubmitting}
                onClick={() => {
                  setError(null);
                  setVerificationCode("");
                  setResendAvailableAt(null);
                  setResendSeconds(0);
                  setScreen("login");
                }}
                type="button"
              >
                {copy.changeEmail}
              </button>
            </div>
          </form>
        ) : (
          <form
            className="auth-form"
            key="email-address"
            noValidate
            onSubmit={(event) => void requestEmailCode(event)}
          >
            <label htmlFor="email">{copy.email}</label>
            <input
              aria-describedby={error === copy.errors.invalidEmail ? "auth-error" : undefined}
              aria-invalid={error === copy.errors.invalidEmail}
              autoComplete="email"
              id="email"
              onChange={(event) => {
                setEmail(event.target.value);
                if (error !== null) setError(null);
              }}
              placeholder={copy.emailPlaceholder}
              required
              type="email"
              value={email}
            />
            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? copy.sendingCode : copy.sendCode}
            </button>
          </form>
        )}

        <p className="auth-legal-note">
          {copy.legal.acknowledgement}{" "}
          <a href={authLegalHref("terms", locale)} rel="noopener noreferrer" target="_blank">
            {copy.legal.terms}
          </a>{" "}
          {copy.legal.connector}{" "}
          <a href={authLegalHref("privacy", locale)} rel="noopener noreferrer" target="_blank">
            {copy.legal.privacy}
          </a>
        </p>

        {error !== null ? <p className="auth-error" id="auth-error" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}
