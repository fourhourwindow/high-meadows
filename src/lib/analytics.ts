const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

let initialized = false;

/**
 * Injects the gtag.js script and initializes GA4 — but only if
 * VITE_GA_MEASUREMENT_ID is actually set. Call once, at app startup.
 * Safe to call more than once (guarded by `initialized`), since React's
 * StrictMode double-invokes effects in development.
 *
 * `send_page_view: false` is deliberate: gtag's automatic page-view only
 * fires once, on this initial script load. Since this is a single-page
 * React app, every other "page" the visitor sees is just client-side
 * routing — no real page load happens, so gtag would never know about it
 * on its own. AnalyticsTracker.tsx sends page_view events manually on every
 * route change instead; disabling the automatic one here avoids double
 * counting that very first page.
 */
export function initAnalytics(): void {
  if (initialized || !GA_MEASUREMENT_ID) return;
  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
}

/** Call on every route change — see AnalyticsTracker.tsx. */
export function trackPageView(path: string): void {
  if (!GA_MEASUREMENT_ID || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
  });
}

/** For the actual business events worth knowing about — a hold created, an
 * inquiry submitted — not just raw traffic. Params are optional extra
 * detail GA can report/filter on (e.g. package name, package price). */
export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!GA_MEASUREMENT_ID || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}
