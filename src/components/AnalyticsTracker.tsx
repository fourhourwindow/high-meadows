import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "../lib/analytics";

// Paths under here aren't tracked — this is the site owner's own traffic
// (testing, managing bookings), not a real visitor, and including it would
// quietly skew every report toward "wow, the booking page converts great"
// when it's actually just Sean checking his own calendar.
const EXCLUDED_PREFIXES = ["/admin", "/login"];

export function AnalyticsTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return;
    trackPageView(pathname);
  }, [pathname]);

  return null;
}
