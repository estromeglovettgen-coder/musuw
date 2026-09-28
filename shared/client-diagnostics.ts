// Best-effort operational evidence, never analytics or authentication state.
export const diagnosticPhases = [
  'auth.session', 'auth.exchange', 'auth.authorize', 'auth.password',
  'auth.otp_send', 'auth.otp_verify', 'auth.native_session', 'auth.oidc_start',
  'auth.session_state', 'auth.continuation', 'auth.navigation', 'auth.entry', 'auth.startup', 'auth.mount',
  'auth.other', 'app.navigation', 'app.entry', 'app.bootstrap', 'app.router', 'app.mount', 'app.startup',
  'api.auth', 'api.documents', 'api.other',
] as const;
export const diagnosticReasons = [
  'session_present', 'session_missing', 'session_unavailable', 'oidc_start', 'consent_resume',
  'native_callback', 'login_required', 'authorization_complete', 'authorization_invalid',
] as const;
export type DiagnosticPhase = typeof diagnosticPhases[number];
export type DiagnosticTiming = Readonly<{ ttfb_ms: number; download_ms: number }>;
export type DiagnosticResource = DiagnosticTiming & Readonly<{ name: string; duration_ms: number }>;
export type DiagnosticEvent = Readonly<{
  phase: DiagnosticPhase;
  outcome: 'ok' | 'network' | 'timeout' | 'http' | 'identity' | 'error';
  duration_ms: number;
  request_id?: string;
  status?: number;
  reason?: typeof diagnosticReasons[number];
  timings?: DiagnosticTiming;
  resources?: readonly DiagnosticResource[];
}>;
const storageKey = 'musuw.diagnostic-flow';
const cookieName = 'musuw_diagnostic_journey';
const ttl = 10 * 60_000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const diagnosticAssetName = /^[A-Za-z0-9_.-]{1,100}-[A-Za-z0-9_-]{8}\.(js|css)$/;
const duration = (value: number) => Number.isInteger(value) && value >= 0 && value <= 120_000;
type Correlation = { id: string; created: number };
type ReporterOptions = {
  fetch: typeof globalThis.fetch;
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  now: () => number;
  randomUUID: () => string;
  cookies?: { read: () => string; write: (value: string) => void };
  context?: () => { pathname: string; userAgent: string; viewportWidth: number; visibility?: string; navigationType?: string };
};
function validCorrelation(value: Correlation | undefined, now: number): value is Correlation {
  return !!value && typeof value.id === 'string' && uuidPattern.test(value.id) &&
    Number.isFinite(value.created) && now >= value.created && now - value.created < ttl;
}
function hints(options: ReporterOptions) {
  try {
    const context = options.context?.();
    if (!context) return {};
    const ua = context.userAgent;
    const browser_kind = /quark/i.test(ua) ? 'quark' : /edg(e|a|ios)?\//i.test(ua) ? 'edge' : /firefox|fxios/i.test(ua) ? 'firefox' : /chrome|crios/i.test(ua) ? 'chrome' : /safari/i.test(ua) ? 'safari' : 'other';
    // These describe client hints, not proof of the device or browser in use.
    const platform_kind = /android|iphone|ipad|ipod|mobile/i.test(ua) ? 'mobile' : /windows|macintosh|linux|cros/i.test(ua) ? 'desktop' : 'other';
    const pathname = context.pathname.split(/[?#]/)[0] ?? '';
    const authPage = pathname.match(/^\/auth\/(start|consent|callback|error|logout)\/?$/)?.[1];
    const page = pathname === '/oauth/consent' ? 'consent' : authPage ?? (pathname === '/' || pathname.startsWith('/platform') ? 'app' : 'other');
    return {
      page, browser_kind, platform_kind,
      ...(Number.isInteger(context.viewportWidth) && context.viewportWidth >= 0 && context.viewportWidth <= 10000 ? { viewport_width: context.viewportWidth } : {}),
      ...(['visible', 'hidden'].includes(context.visibility ?? '') ? { visibility: context.visibility } : {}),
      ...(['navigate', 'reload', 'back_forward', 'prerender', 'unknown'].includes(context.navigationType ?? '') ? { navigation_type: context.navigationType } : {}),
    };
  } catch { return {}; }
}

export function createDiagnosticReporter(options: ReporterOptions) {
  let sent = 0;
  let flow: Correlation | undefined;
  let journey: Correlation | undefined;
  let journeyAttempted = false;
  let documentId: string | undefined;
  let storageStatus: 'session_available' | 'session_unavailable' = 'session_available';
  let flowStatus: 'restored' | 'new' | 'expired' | 'unavailable' = 'new';
  return (event: DiagnosticEvent): void => {
    try {
      if (sent >= 40 || !diagnosticPhases.includes(event.phase) ||
          !['ok', 'network', 'timeout', 'http', 'identity', 'error'].includes(event.outcome) || !duration(event.duration_ms) ||
          (event.reason !== undefined && !diagnosticReasons.includes(event.reason)) ||
          (event.request_id !== undefined && !/^[A-Za-z0-9_-]{1,64}$/.test(event.request_id)) ||
          (event.status !== undefined && (!Number.isInteger(event.status) || (event.status !== 0 && (event.status < 100 || event.status > 599)))) ||
          (event.timings !== undefined && (!duration(event.timings.ttfb_ms) || !duration(event.timings.download_ms))) ||
          (event.resources !== undefined && (!Array.isArray(event.resources) || event.resources.length > 3 || event.resources.some(v => !v || !diagnosticAssetName.test(v.name) || !duration(v.duration_ms) || !duration(v.ttfb_ms) || !duration(v.download_ms))))) return;
      const now = options.now();
      if (!validCorrelation(flow, now)) {
        flowStatus = flow ? 'expired' : 'new';
        flow = undefined;
        try {
          const raw = options.storage.getItem(storageKey);
          let saved: Correlation | undefined;
          try { saved = JSON.parse(raw ?? 'null'); } catch { /* Corrupt values expire, storage still works. */ }
          if (validCorrelation(saved, now)) { flow = saved; flowStatus = 'restored'; }
          else if (raw) flowStatus = 'expired';
        } catch { storageStatus = 'session_unavailable'; flowStatus = 'unavailable'; }
        if (!flow) {
          flow = { id: options.randomUUID(), created: now };
          try { options.storage.setItem(storageKey, JSON.stringify(flow)); }
          catch { storageStatus = 'session_unavailable'; flowStatus = 'unavailable'; }
        }
      }
      documentId ??= options.randomUUID();
      if (!uuidPattern.test(flow.id) || !uuidPattern.test(documentId)) return;
      if (options.cookies && (!journeyAttempted || (journey && !validCorrelation(journey, now)))) {
        journeyAttempted = true;
        journey = undefined;
        try {
          const existing = options.cookies.read().split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
          const [id, created] = (existing ?? '').split('.');
          const saved = { id: id ?? '', created: Number(created) };
          if (validCorrelation(saved, now)) journey = saved;
          else {
            const candidate = { id: options.randomUUID(), created: now };
            const value = `${cookieName}=${candidate.id}.${candidate.created}`;
            options.cookies.write(`${value}; Max-Age=600; Path=/; SameSite=Lax; Secure`);
            if (uuidPattern.test(candidate.id) && options.cookies.read().split(';').some(v => v.trim() === value)) journey = candidate;
          }
        } catch { /* Cookie access cannot affect the login or imply persistence. */ }
      }
      // Explicit fields only: never serialize raw UA, URL, error, form, or extras.
      const payload = {
        phase: event.phase, outcome: event.outcome, duration_ms: event.duration_ms,
        flow_id: flow.id, document_id: documentId, storage_status: storageStatus, flow_status: flowStatus,
        ...(journey ? { journey_id: journey.id } : {}), ...hints(options),
        ...(event.request_id === undefined ? {} : { request_id: event.request_id }),
        ...(event.status === undefined ? {} : { status: event.status }),
        ...(event.reason === undefined ? {} : { reason: event.reason }),
        ...(event.timings === undefined ? {} : { timings: { ttfb_ms: event.timings.ttfb_ms, download_ms: event.timings.download_ms } }),
        ...(event.resources === undefined ? {} : { resources: event.resources.map(v => ({ name: v.name, duration_ms: v.duration_ms, ttfb_ms: v.ttfb_ms, download_ms: v.download_ms })) }),
      };
      const body = JSON.stringify(payload);
      if (new TextEncoder().encode(body).length > 2048) return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let signal: AbortSignal | undefined;
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') signal = AbortSignal.timeout(2000);
      else if (typeof AbortController !== 'undefined') {
        const controller = new AbortController();
        signal = controller.signal;
        timer = setTimeout(() => controller.abort(), 2000);
      }
      sent++;
      try {
        void options.fetch('/api/v1/client-diagnostics', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
          credentials: 'omit', mode: 'same-origin', referrerPolicy: 'no-referrer', keepalive: true,
          ...(signal ? { signal } : {}),
        }).catch(() => {}).finally(() => { if (timer !== undefined) clearTimeout(timer); });
      } catch { if (timer !== undefined) clearTimeout(timer); }
    } catch { /* Diagnostics must never affect the user's action. */ }
  };
}

let browserReporter: ReturnType<typeof createDiagnosticReporter> | undefined;
export function reportDiagnostic(event: DiagnosticEvent): void {
  try {
    if (!browserReporter) {
      browserReporter = createDiagnosticReporter({
        fetch: window.fetch.bind(window),
        storage: { getItem: key => window.sessionStorage.getItem(key), setItem: (key, value) => window.sessionStorage.setItem(key, value) },
        cookies: { read: () => document.cookie, write: value => { document.cookie = value; } },
        context: () => ({ pathname: location.pathname, userAgent: navigator.userAgent, viewportWidth: innerWidth, visibility: document.visibilityState, navigationType: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type ?? 'unknown' }),
        now: Date.now,
        randomUUID: () => {
          if (typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
          const bytes = window.crypto.getRandomValues(new Uint8Array(16));
          bytes[6] = ((bytes[6] ?? 0) & 15) | 64; bytes[8] = ((bytes[8] ?? 0) & 63) | 128;
          const hex = Array.from(bytes, v => v.toString(16).padStart(2, '0')).join('');
          return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        },
      });
    }
    browserReporter(event);
  } catch { /* Also safe when window, storage, or Web Crypto is unavailable. */ }
}
