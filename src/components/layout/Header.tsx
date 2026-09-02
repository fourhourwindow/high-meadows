import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LogoMark } from "../LogoMark";
import "./Header.css";

const NAV_LINKS: { to: string; label: string; end?: boolean }[] = [
  { to: "/", label: "Home", end: true },
  { to: "/gallery", label: "Gallery" },
  { to: "/booking", label: "Availability & Pricing" },
  { to: "/contact", label: "Contact" },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Collapses the mobile menu on navigation — clicking a link should take
  // you to the page, not leave the dropdown hanging open over it.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <NavLink to="/" className="site-header__mark" aria-label="High Meadows — home">
          <LogoMark variant="primary" className="site-header__logo" />
        </NavLink>

        <button
          type="button"
          className={`site-header__toggle ${menuOpen ? "site-header__toggle--open" : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="site-header-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          id="site-header-nav"
          className={`site-header__nav ${menuOpen ? "site-header__nav--open" : ""}`}
          aria-label="Primary"
        >
          <div className="site-header__nav-list">
            {NAV_LINKS.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end}>
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
