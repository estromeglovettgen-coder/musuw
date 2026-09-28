import { diagnosticAssetName, reportDiagnostic, type DiagnosticEvent, type DiagnosticPhase, type DiagnosticResource } from './client-diagnostics';

type MetricOptions = {
  performance?: Pick<Performance, 'now' | 'getEntriesByType'>;
  origin?: string;
  report?: (event: DiagnosticEvent) => void;
};
const milliseconds = (value: number) => Math.min(120_000, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
const noMetrics = { routerStart() {}, routerReady() {}, mountStart() {}, mounted() {}, failed() {} };

// Called at the first entry-module statement, after its static dependencies load.
export function startStartupMetrics(surface: 'app' | 'auth', options: MetricOptions = {}) {
  try {
    const timing = options.performance ?? window.performance;
    const origin = options.origin ?? window.location.origin;
    const report = options.report ?? reportDiagnostic;
    const entry = timing.now();
    let routerStart = entry, mountStart = entry, finished = false, failed = false;
    const emit = (phase: DiagnosticPhase, duration: number, extras: Partial<DiagnosticEvent> = {}) => {
      try { report({ phase, outcome: 'ok', duration_ms: milliseconds(duration), ...extras }); } catch { /* Best effort. */ }
    };
    const navigation = timing.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (navigation && navigation.responseEnd >= navigation.responseStart && navigation.responseStart > 0) {
      emit(surface === 'app' ? 'app.navigation' : 'auth.navigation', navigation.responseEnd - navigation.startTime, {
        timings: { ttfb_ms: milliseconds(navigation.responseStart - navigation.startTime), download_ms: milliseconds(navigation.responseEnd - navigation.responseStart) },
      });
    }
    emit(surface === 'app' ? 'app.entry' : 'auth.entry', entry);
    function resources(): DiagnosticResource[] {
      try {
        return (timing.getEntriesByType('resource') as PerformanceResourceTiming[])
          .filter(resource => {
            try {
              const url = new URL(resource.name, origin);
              const match = url.pathname.match(/^\/(?:auth\/)?assets\/([^/]+)$/);
              return url.origin === origin && !!match?.[1] && diagnosticAssetName.test(match[1]) && resource.duration >= 0;
            } catch { return false; }
          })
          .sort((a, b) => b.duration - a.duration).slice(0, 3)
          .map(resource => ({
            name: new URL(resource.name, origin).pathname.split('/').pop()!,
            duration_ms: milliseconds(resource.duration),
            ttfb_ms: milliseconds(resource.responseStart - resource.requestStart),
            download_ms: milliseconds(resource.responseEnd - resource.responseStart),
          }));
      } catch { return []; }
    }
    return {
      routerStart() { try { routerStart = timing.now(); } catch {} },
      routerReady() { try { emit('app.router', timing.now() - routerStart); } catch {} },
      mountStart() { try { mountStart = timing.now(); } catch {} },
      mounted() {
        try {
          if (finished) return;
          finished = true;
          const now = timing.now();
          emit(surface === 'app' ? 'app.mount' : 'auth.mount', now - mountStart, { resources: resources() });
          if (!failed) {
            if (surface === 'app') emit('app.bootstrap', now - entry);
            emit(surface === 'app' ? 'app.startup' : 'auth.startup', now);
          }
        } catch {}
      },
      failed() {
        try {
          if (failed) return;
          failed = true;
          emit(surface === 'app' ? 'app.startup' : 'auth.startup', timing.now(), { outcome: 'error' });
        } catch {}
      },
    };
  } catch { return noMetrics; }
}
