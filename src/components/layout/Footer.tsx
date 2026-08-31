import { Link } from "react-router-dom";
import { ContourMap } from "../ContourMap";
import { LogoMark } from "../LogoMark";
import { ContactDetails } from "../ContactDetails";
import "./Footer.css";

export function Footer() {
  return (
    <footer className="site-footer">
      <ContourMap variant="divider" className="site-footer__divider" />
      <div className="container site-footer__inner">
        <div>
          <LogoMark variant="reversed" className="site-footer__logo" />
          <p className="site-footer__meta">
            13 acres in the heart of Virginia wine country
          </p>
        </div>
        <ContactDetails />
      </div>
      <div className="container site-footer__bottom">
        <Link to="/privacy" className="site-footer__admin-link">
          Privacy Policy
        </Link>
        <Link to="/terms" className="site-footer__admin-link">
          Terms &amp; Conditions
        </Link>
        <Link to="/login" className="site-footer__admin-link">
          Admin login
        </Link>
      </div>
    </footer>
  );
}
