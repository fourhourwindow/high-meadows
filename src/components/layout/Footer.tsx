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
    </footer>
  );
}
