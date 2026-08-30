import { useState } from "react";
import { getRateSnapshot } from "../lib/firebase";
import { trackEvent } from "../lib/analytics";
import "./ContactForm.css";

interface ContactFormProps {
  /** Slightly different framing depending on where it's embedded. */
  context?: "home" | "contact-page";
}

/**
 * Submits to Netlify Forms — no backend code required. Netlify detects the
 * static twin of this form in index.html at build time, then this
 * component posts to it via fetch at runtime (the standard pattern for
 * JS-rendered forms, since Netlify's build-time bot can't see form markup
 * that only exists after React renders).
 *
 * Before submitting, it also calls getRateSnapshot to fetch a fresh price
 * quote and embeds it as a hidden field. This means the email notification
 * always shows exactly what this person was quoted at the moment they
 * asked — even if rates change in the admin dashboard afterward, this
 * specific submission's snapshot never does.
 *
 * Email delivery itself is configured in the Netlify dashboard, not in
 * code — see the note in index.html next to the hidden form.
 */
export function ContactForm({ context = "contact-page" }: ContactFormProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    eventDate: "",
    guestCount: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");

    try {
      let rateSnapshot = "";
      try {
        const result = await getRateSnapshot({ eventDate: form.eventDate || undefined });
        rateSnapshot = JSON.stringify(result.data);
      } catch (snapshotErr) {
        // Don't block the inquiry over a pricing-lookup hiccup — send
        // without a snapshot rather than losing the inquiry entirely.
        console.error("Couldn't fetch rate snapshot:", snapshotErr);
      }

      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          "form-name": "contact",
          ...form,
          rateSnapshot,
        }).toString(),
      });
      if (!response.ok) throw new Error(`Netlify Forms returned ${response.status}`);
      trackEvent("contact_form_submitted", { context });
      setStatus("success");
    } catch (err) {
      console.error("Contact form submission failed:", err);
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="contact-form__success">
        <h3>Thank you.</h3>
        <p>We've received your inquiry and will be in touch within a day or two.</p>
      </div>
    );
  }

  return (
    <form
      className="contact-form"
      name="contact"
      data-netlify="true"
      netlify-honeypot="bot-field"
      onSubmit={handleSubmit}
    >
      {context === "home" && (
        <p className="contact-form__intro">
          Have a date in mind? Tell us a bit about your event.
        </p>
      )}

      {/* Spam honeypot — real visitors never see or fill this in. Netlify
          silently discards any submission where it's non-empty. */}
      <p className="contact-form__hidden" aria-hidden="true">
        <label>
          Don't fill this out if you're human: <input name="bot-field" tabIndex={-1} autoComplete="off" />
        </label>
      </p>

      <div className="contact-form__row">
        <label>
          Name
          <input
            name="name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            name="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
      </div>

      <div className="contact-form__row">
        <label>
          Preferred date
          <input
            type="date"
            name="eventDate"
            value={form.eventDate}
            onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
          />
        </label>
        <label>
          Estimated guest count
          <input
            type="number"
            name="guestCount"
            min={1}
            value={form.guestCount}
            onChange={(e) => setForm({ ...form, guestCount: e.target.value })}
          />
        </label>
      </div>

      <label>
        Message
        <textarea
          name="message"
          rows={4}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </label>

      {status === "error" && (
        <p role="alert" className="contact-form__error">
          Something went wrong sending that — please try again, or email us directly.
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Send inquiry"}
      </button>
    </form>
  );
}
