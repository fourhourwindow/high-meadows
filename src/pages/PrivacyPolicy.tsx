import "./LegalPage.css";

export function PrivacyPolicy() {
  return (
    <div className="container legal-page">
      <span className="eyebrow">Legal</span>
      <h1>Privacy Policy</h1>
      <p className="legal-page__updated">Last updated: 08/31/2026</p>

      {/* <p className="legal-page__notice">
        This page was drafted to describe how this site actually works, as a
        starting point — it has not been reviewed by an attorney. Have it
        reviewed by qualified legal counsel before relying on it, especially
        once the site is processing real payments.
      </p> */}

      <h2>What this covers</h2>
      <p>
        This policy describes how High Meadows ("we," "us") collects and
        uses information through highmeadowslane.com.
      </p>

      <h2>Information we collect</h2>
      <p>When you use this site, we may collect:</p>
      <ul>
        <li>
          <strong>Contact form submissions</strong> — your name, email,
          preferred event date, guest count, and message, submitted through
          our contact form.
        </li>
        <li>
          <strong>Booking and hold information</strong> — your name, email,
          phone number, guest count, selected package, and requested dates,
          when you request a hold on the availability calendar.
        </li>
        <li>
          <strong>Payment information</strong> — if you pay a deposit,
          payment is processed directly by Stripe, our payment processor. We
          do not receive or store your full card number.
        </li>
        <li>
          <strong>Usage data</strong> — through Google Analytics, we collect
          standard analytics information such as pages visited and general
          location derived from your IP address, and we track when a
          contact form is submitted or a hold is created.
        </li>
      </ul>

      <h2>How we use this information</h2>
      <ul>
        <li>To respond to inquiries and manage your booking or hold</li>
        <li>To send you information about your hold, including its expiration</li>
        <li>To process deposit payments through Stripe</li>
        <li>To understand how visitors use the site, via Google Analytics</li>
      </ul>

      <h2>Service providers we use</h2>
      <p>
        We rely on the following third parties to run this site. Each
        processes some of the information described above as part of
        providing their service to us:
      </p>
      <ul>
        <li>
          <strong>Google Firebase</strong> — stores booking and hold records,
          and handles administrator login for site staff. Customers do not
          create accounts or log in.
        </li>
        <li>
          <strong>Netlify</strong> — hosts this site and processes form
          submissions (the contact form and internal booking notifications).
        </li>
        <li>
          <strong>Google Analytics</strong> — collects anonymized usage
          statistics. See{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noreferrer"
          >
            Google's privacy policy
          </a>{" "}
          for how Google handles this data.
        </li>
        <li>
          <strong>Stripe</strong> — processes deposit payments. See{" "}
          <a href="https://stripe.com/privacy" target="_blank" rel="noreferrer">
            Stripe's privacy policy
          </a>
          .
        </li>
        <li>
          <strong>Twilio</strong> — delivers a text message notification to
          our staff when a new hold is placed. Some booking details (name,
          package, dates, price) pass through Twilio's systems as part of
          sending that notification to us — Twilio does not contact you
          directly.
        </li>
      </ul>

      <h2>Cookies and local storage</h2>
      <p>
        Google Analytics may set cookies to distinguish visitors. The site
        also stores a small amount of non-personal information in your
        browser's local storage — such as which calendar month you were
        last viewing — purely to make the calendar more convenient to use.
        This isn't used to identify or track you.
      </p>

      <h2>Children's privacy</h2>
      <p>
        This site is not directed at children under 13, and we do not
        knowingly collect personal information from children.
      </p>

      <h2>Your choices</h2>
      <p>
        To ask what information we have about you, or to request it be
        corrected or deleted, contact us using the information on our{" "}
        <a href="/contact">Contact page</a>.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Changes will be posted
        on this page with an updated date.
      </p>

      <h2>Contact us</h2>
      <p>Questions about this policy can be sent to info@highmeadowslane.com.</p>
    </div>
  );
}
