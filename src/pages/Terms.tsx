import "./LegalPage.css";

export function Terms() {
  return (
    <div className="container legal-page">
      <span className="eyebrow">Legal</span>
      <h1>Terms &amp; Conditions</h1>
      <p className="legal-page__updated">Last updated: [DATE]</p>

      <p className="legal-page__notice">
        This page was drafted to describe how this site actually works, as a
        starting point — it has not been reviewed by an attorney. Have it
        reviewed by qualified legal counsel before relying on it, especially
        once the site is processing real payments.
      </p>

      <h2>Using this site</h2>
      <p>
        By using highmeadowslane.com, you agree to these terms. This site is
        operated by High Meadows, a wedding and event venue in Scottsville,
        Virginia.
      </p>

      <h2>Availability and holds</h2>
      <p>
        The calendar on this site shows current availability, but is not a
        guarantee of a date until a hold or booking is confirmed. Requesting
        a hold reserves your selected dates temporarily — holds expire
        automatically after a limited time if a deposit is not received,
        and the dates then become available to others. The exact hold
        window and expiration time are shown to you when you place a hold.
      </p>

      <h2>Pricing</h2>
      <p>
        Prices shown on this site vary by date, season, and package, and are
        subject to change. The price shown at the time you place a hold is
        the price locked in for that specific hold — later pricing changes
        on the site do not affect a hold or booking already in place.
      </p>

      <h2>Deposits and payment</h2>
      <p>
        Converting a hold into a confirmed booking requires a deposit,
        processed through our payment provider, Stripe. The remaining
        balance is due under the terms provided to you at booking.
      </p>

      <h2>Cancellations and refunds</h2>
      <p>
        Cancellation of a confirmed booking is handled on a sliding scale —
        the closer to the event date a booking is cancelled, the smaller
        the refund. The specific refund schedule in effect at the time of
        your booking will be provided to you directly; contact us if you'd
        like these details before booking.
      </p>

      <h2>Site content</h2>
      <p>
        Photos, text, and other content on this site belong to High Meadows
        or are used with permission, and may not be reused without consent.
      </p>

      <h2>No warranty</h2>
      <p>
        This site is provided as-is. We aim to keep availability and pricing
        information accurate and current, but errors can occur — a specific
        quote or hold confirmation always governs over general information
        shown elsewhere on the site.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the Commonwealth of
        Virginia.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms from time to time. Changes will be posted
        on this page with an updated date.
      </p>

      <h2>Contact us</h2>
      <p>Questions about these terms can be sent to info@highmeadowslane.com.</p>
    </div>
  );
}
