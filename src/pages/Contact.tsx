import { ContactForm } from "../components/ContactForm";
import "./Contact.css";

export function Contact() {
  return (
    <div className="container contact-page">
      <span className="eyebrow">Contact</span>
      <h1>Let's talk about your date.</h1>
      <p className="contact-page__lede">
        Whether you're just starting to look or ready to hold a weekend,
        send us a note and we'll get back to you within a day or two.
      </p>
      <ContactForm context="contact-page" />
    </div>
  );
}
