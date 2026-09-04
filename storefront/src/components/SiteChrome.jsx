import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "@phosphor-icons/react/ArrowUpRight";
import { List } from "@phosphor-icons/react/List";
import { Moon } from "@phosphor-icons/react/Moon";
import { Sun } from "@phosphor-icons/react/Sun";
import { X } from "@phosphor-icons/react/X";
import { getStorefrontCopy } from "../i18n";
import {
  MARKETING_FOOTER_GROUPS,
  MARKETING_NAVIGATION,
} from "../homepageMarketingRefresh";
import { APP_LOGIN_URL, APP_URL } from "../productHandoff";
import { readStorefrontAuthentication } from "../storefrontAuthStatus";

const defaultCopy = getStorefrontCopy("en");
const navigationLabels = Object.freeze({
  en: Object.freeze(["Features", "Platform", "Pricing", "Security", "Contact"]),
  zh: Object.freeze(["功能", "平台", "定价", "安全", "联系"]),
});

function publicNavigationLabels(copy) {
  return copy?.pricing?.currencyCode === "CNY" ? navigationLabels.zh : navigationLabels.en;
}

const footerLabels = Object.freeze({
  en: Object.freeze([
    Object.freeze({ title: "Product", links: Object.freeze(["Features", "Platform", "Pricing"]) }),
    Object.freeze({ title: "Trust", links: Object.freeze(["FAQ", "Security", "Contact"]) }),
    Object.freeze({ title: "Legal", links: Object.freeze(["Terms", "Privacy", "Refunds", "Subscription", "Cookies"]) }),
  ]),
  zh: Object.freeze([
    Object.freeze({ title: "产品", links: Object.freeze(["功能", "平台", "定价"]) }),
    Object.freeze({ title: "信任", links: Object.freeze(["常见问题", "安全", "联系"]) }),
    Object.freeze({ title: "法律", links: Object.freeze(["服务条款", "隐私", "退款", "订阅与取消", "Cookie"]) }),
  ]),
});

function publicFooterLabels(copy) {
  return copy?.pricing?.currencyCode === "CNY" ? footerLabels.zh : footerLabels.en;
}

export function Brand({ copy = defaultCopy }) {
  return (
    <a className="brand" href="/" aria-label={copy.brand.homeLabel}>
      <span className="brand-mark" aria-hidden="true">
        <img src="/images/musuw-logo.png" alt="" width="30" height="30" draggable={false} />
      </span>
    </a>
  );
}

export function ButtonLink({
  children,
  href,
  variant = "primary",
  className = "",
  icon = false,
  onClick,
  disabled = false,
  ariaBusy = false,
  newTab = false,
}) {
  if (onClick) {
    return (
      <button
        type="button"
        className={`button button-${variant} ${className}`}
        onClick={onClick}
        disabled={disabled}
        aria-busy={ariaBusy}
      >
        <span>{children}</span>
        {icon ? <ArrowUpRight size={17} weight="bold" aria-hidden="true" /> : null}
      </button>
    );
  }

  return (
    <a
      className={`button button-${variant} ${className}`}
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noreferrer" : undefined}
    >
      <span>{children}</span>
      {icon ? <ArrowUpRight size={17} weight="bold" aria-hidden="true" /> : null}
    </a>
  );
}

export function LanguageSwitcher({ locale = "en", onLocaleChange }) {
  const isZh = locale === "zh-CN" || locale === "zh";

  return (
    <div className="lang-switcher">
      <select
        className="lang-select"
        value={isZh ? "zh-CN" : "en"}
        onChange={(event) => onLocaleChange?.(event.target.value)}
        aria-label={isZh ? "选择语言" : "Select language"}
      >
        <option value="zh-CN">ZH</option>
        <option value="en">EN</option>
      </select>
    </div>
  );
}

export function ProductEntryLinks({ authenticated = false, copy = defaultCopy }) {
  if (authenticated) {
    return <ButtonLink href={APP_URL}>{copy.nav.openApp}</ButtonLink>;
  }

  return (
    <>
      <ButtonLink href={APP_LOGIN_URL} variant="secondary">
        {copy.nav.login}
      </ButtonLink>
      <ButtonLink href={APP_LOGIN_URL}>{copy.nav.getStarted}</ButtonLink>
    </>
  );
}

export function SiteHeader({
  copy = defaultCopy,
  navigation = MARKETING_NAVIGATION,
  locale,
  onLocaleChange,
  theme = "light",
  onThemeToggle,
}) {
  const [open, setOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const mobileNavId = useId();
  const menuButtonRef = useRef(null);
  const headerRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const labels = publicNavigationLabels(copy);
  const currentLocale = locale || (copy?.pricing?.currencyCode === "CNY" ? "zh-CN" : "en");
  const isZh = currentLocale === "zh-CN" || currentLocale === "zh";
  const isDark = theme === "dark";
  const themeLabel = isDark
    ? isZh
      ? "切换到浅色模式"
      : "Switch to light mode"
    : isZh
      ? "切换到深色模式"
      : "Switch to dark mode";

  useEffect(() => {
    let mounted = true;
    void readStorefrontAuthentication().then((nextAuthenticated) => {
      if (mounted && nextAuthenticated) setAuthenticated(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const closeMenu = () => setOpen(false);
    window.addEventListener("hashchange", closeMenu);
    return () => window.removeEventListener("hashchange", closeMenu);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const previousBodyOverflow = document.body.style.overflow;
    const closeAtDesktop = (event) => {
      if (event.matches) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButtonRef.current?.focus();
    };
    const closeOnOutsidePointer = (event) => {
      if (headerRef.current?.contains(event.target)) return;
      setOpen(false);
      menuButtonRef.current?.focus();
    };
    document.body.style.overflow = "hidden";
    if (desktopQuery.matches) setOpen(false);
    desktopQuery.addEventListener("change", closeAtDesktop);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      desktopQuery.removeEventListener("change", closeAtDesktop);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [open]);

  return (
    <header
      className="site-header"
      ref={headerRef}
      style={{
        WebkitBackdropFilter: "blur(2px)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div className="container nav-shell">
        <Brand copy={copy} />
        <nav className="desktop-nav" aria-label={copy.nav.primaryAria}>
          {navigation.map((item, index) => (
            <a key={item.href} href={item.href}>
              {labels[index] ?? item.label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <button
            type="button"
            className="theme-toggle"
            aria-label={themeLabel}
            title={themeLabel}
            onClick={onThemeToggle}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <LanguageSwitcher locale={currentLocale} onLocaleChange={onLocaleChange} />
          <ProductEntryLinks authenticated={authenticated} copy={copy} />
          <button
            aria-controls={mobileNavId}
            className="menu-button"
            type="button"
            aria-label={open ? copy.nav.closeMenu : copy.nav.openMenu}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            ref={menuButtonRef}
          >
            {open ? <X size={22} weight="bold" /> : <List size={24} weight="bold" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open ? (
          <motion.nav
            className="mobile-nav"
            id={mobileNavId}
            aria-label={copy.nav.mobileAria}
            initial={reduceMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
          >
            {navigation.map((item, index) => (
              <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
                {labels[index] ?? item.label}
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            ))}
            <div className="mobile-nav-actions">
              <ProductEntryLinks authenticated={authenticated} copy={copy} />
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

export function SiteFooter({ copy = defaultCopy, groups = MARKETING_FOOTER_GROUPS }) {
  const labels = publicFooterLabels(copy);

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Brand copy={copy} />
        </div>
        {groups.map((group, groupIndex) => (
          <div className="footer-group" key={group.title}>
            <h3>{labels[groupIndex]?.title ?? group.title}</h3>
            {group.links.map(([label, href], linkIndex) => (
              <a href={href} key={label}>
                {labels[groupIndex]?.links[linkIndex] ?? label}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="container footer-bottom">
        <span>{copy.footer.copyright}</span>
      </div>
    </footer>
  );
}

export function SectionIntro({ label, title, body, align = "center", icon: Icon }) {
  return (
    <div className={`section-intro section-intro-${align}`}>
      {label ? (
        <p className="section-label">
          {Icon ? (
            <span className="section-label-icon" aria-hidden="true">
              <Icon size={20} weight="regular" />
            </span>
          ) : null}
          {label}
        </p>
      ) : null}
      <h2>{title}</h2>
      {body ? <p className="section-body">{body}</p> : null}
    </div>
  );
}
