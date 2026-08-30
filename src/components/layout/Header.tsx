import { NavLink } from "react-router-dom";
import { LogoMark } from "../LogoMark";
import "./Header.css";

export function Header() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <NavLink to="/" className="site-header__mark" aria-label="High Meadows — home">
          <LogoMark variant="primary" className="site-header__logo" />
        </NavLink>
        <nav className="site-header__nav" aria-label="Primary">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/gallery">Gallery</NavLink>
          <NavLink to="/booking">Availability &amp; Pricing</NavLink>
          <NavLink to="/contact">Contact</NavLink>
        </nav>
      </div>
    </header>
  );
}
