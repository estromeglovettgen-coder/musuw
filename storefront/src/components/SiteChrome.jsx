import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, EnvelopeSimple, List, X, XLogo } from "@phosphor-icons/react";
import { footerGroups, navItems } from "../data/homeContent";
import { getStorefrontCopy } from "../i18n";
import { APP_LOGIN_URL, APP_URL } from "../productHandoff";
import { readStorefrontAuthentication } from "../storefrontAuthStatus";

const defaultCopy = getStorefrontCopy("en");

export function Brand({ copy = defaultCopy }) {
  return (
    <a className="brand" href="/" aria-label={copy.brand.homeLabel}>
      <span className="brand-mark" aria-hidden="true">
        <img src="/images/musuw-logo.png" alt="" width="48" height="30" draggable={false} />
      </span>
      <span>musuw</span>
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

export function SiteHeader({ copy = defaultCopy }) {
  const [open, setOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const mobileNavId = useId();
  const menuButtonRef = useRef(null);
  const reduceMotion = useReducedMotion();

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
    const desktopQuery = window.matchMedia("(min-width: 1081px)");
    const closeAtDesktop = (event) => {
      if (event.matches) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButtonRef.current?.focus();
    };
    if (desktopQuery.matches) setOpen(false);
    desktopQuery.addEventListener("change", closeAtDesktop);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      desktopQuery.removeEventListener("change", closeAtDesktop);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <header
      className="site-header"
      style={{
        WebkitBackdropFilter: "blur(2px)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div className="container nav-shell">
        <Brand copy={copy} />
        <nav className="desktop-nav" aria-label={copy.nav.primaryAria}>
          {navItems.map((item, index) => (
            <a key={item.label} href={item.href}>
              {copy.nav.items[index].label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
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
            {navItems.map((item, index) => (
              <a key={item.label} href={item.href} onClick={() => setOpen(false)}>
                {copy.nav.items[index].label}
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

export function SiteFooter({ copy = defaultCopy }) {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Brand copy={copy} />
        </div>
        {footerGroups.map((group, groupIndex) => (
          <div className="footer-group" key={group.title}>
            <h3>{copy.footer.groups[groupIndex].title}</h3>
            {group.links.map(([label, href], linkIndex) => (
              <a href={href} key={label}>
                {copy.footer.groups[groupIndex].links[linkIndex]}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="container footer-bottom">
        <div className="social-links" aria-label={copy.footer.socialAria}>
          <a href="https://x.com/greeenyang" aria-label="X" target="_blank" rel="noreferrer">
            <XLogo size={19} weight="fill" />
          </a>
          <a href="mailto:support@didren.com" aria-label="Email">
            <EnvelopeSimple size={19} weight="fill" />
          </a>
        </div>
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
