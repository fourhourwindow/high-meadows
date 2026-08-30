import { Link } from "react-router-dom";
import { ContourMap } from "../components/ContourMap";
import { AvailabilityCalendar } from "../components/AvailabilityCalendar";
import { ContactForm } from "../components/ContactForm";
import "./Home.css";

export function Home() {
  return (
    <>
      <section className="hero">
        <ContourMap variant="hero" className="hero__map" />
        <div className="container hero__content">
          <span className="eyebrow">Scottsville, Virginia</span>
          <h1>13 acres, one house, one cottage, one long weekend.</h1>
          <p className="hero__lede">
            A private wedding property in the heart of Virginia wine country —
            room for your whole family under one roof, and a quiet cottage set
            apart for the two of you.
          </p>
          <div className="hero__actions">
            <Link to="/booking" className="btn btn-primary">
              See availability &amp; pricing
            </Link>
            <a href="#contact" className="btn btn-secondary">
              Ask a question
            </a>
          </div>
        </div>
      </section>

      <ContourMap variant="divider" className="section-divider" />

      <section className="section">
        <div className="container grounds">
          <div>
            <span className="eyebrow">The Grounds</span>
            <h2>Two houses, thirteen acres, no neighbors in sight.</h2>
          </div>
          <div className="grounds__cards">
            <div className="grounds__card">
              <h3>Main House</h3>
              <p>
                7 bedrooms and 8 bathrooms, enough for the wedding party and
                both families to stay together for the weekend.
              </p>
            </div>
            <div className="grounds__card">
              <h3>The Cottage</h3>
              <p>
                A detached, private cottage — one bedroom, two bathrooms, a
                small kitchen, a large living room, and a deck looking out
                over the property. Built for the bride and groom.
              </p>
            </div>
            <div className="grounds__card">
              <h3>The Land</h3>
              <p>
                13 acres of rolling grounds set in the heart of Virginia wine
                country, with room for a ceremony site, tents, and parking.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tinted">
        <div className="container">
          <span className="eyebrow">What's Nearby</span>
          <h2>Close enough to town, far enough from everything else.</h2>
          <div className="nearby">
            <div className="nearby__stat">
              <span className="nearby__number">¾ mi</span>
              <span className="nearby__label">to downtown Scottsville</span>
            </div>
            <div className="nearby__stat">
              <span className="nearby__number">19 mi</span>
              <span className="nearby__label">to downtown Charlottesville</span>
            </div>
            <div className="nearby__stat">
              <span className="nearby__number">10</span>
              <span className="nearby__label">wineries within 16 miles</span>
            </div>
            <div className="nearby__stat">
              <span className="nearby__number">9</span>
              <span className="nearby__label">breweries within 16 miles</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container availability-preview">
          <div>
            <span className="eyebrow">Check a Date</span>
            <h2>See what's open.</h2>
            <p>
              A quick look at venue availability. For full pricing and
              packages — Venue Only, Venue + Cottage, or the full property —
              head to the availability &amp; pricing page.
            </p>
            <Link to="/booking" className="btn btn-secondary">
              View packages &amp; pricing
            </Link>
          </div>
          <AvailabilityCalendar />
        </div>
      </section>

      <ContourMap variant="divider" className="section-divider" />

      <section className="section" id="contact">
        <div className="container">
          <span className="eyebrow">Get in Touch</span>
          <h2>Tell us about your day.</h2>
          <ContactForm context="home" />
        </div>
      </section>
    </>
  );
}
