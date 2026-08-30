import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * React Router preserves scroll position across navigations by default
 * (fine for back/forward, not for a fresh page like clicking "Gallery" from
 * the nav while scrolled halfway down Home). Mount this once, inside
 * BrowserRouter, and it resets scroll on every path change.
 *
 * Renders nothing — this is a behavior-only component.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Belt-and-suspenders against global.css's html { scroll-behavior:
    // smooth }: disable it on the root element, force the jump, then
    // restore it — but on the NEXT frame, not synchronously. Restoring it
    // in the same tick can undo the override before the browser's scroll
    // engine has actually read/applied it, which silently brings the
    // animation back.
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      root.style.scrollBehavior = previousScrollBehavior;
    });
  }, [pathname]);

  return null;
}
