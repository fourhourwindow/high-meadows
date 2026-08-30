import { useEffect, useState } from "react";

/**
 * Real contact info, but never written as a literal string anywhere in this
 * file or the compiled bundle — each value is a character-code array,
 * reassembled in the browser after mount. This mainly defeats the common
 * class of bots that regex raw HTML or built JS assets for email/phone
 * patterns without executing anything; it won't stop a scraper that runs a
 * full headless browser and reads the final rendered page, since at that
 * point the real text is genuinely there for actual visitors (and screen
 * readers) to read. Update the numbers below via the same char-code
 * approach if the address/phone/email ever change — don't paste the plain
 * string back in.
 */
const STREET_CODES = [53, 53, 32, 72, 105, 103, 104, 32, 77, 101, 97, 100, 111, 119, 115, 32, 76, 97, 110, 101];
const CITY_STATE_ZIP_CODES = [83, 99, 111, 116, 116, 115, 118, 105, 108, 108, 101, 44, 32, 86, 65, 32, 50, 52, 53, 57, 48];
const PHONE_DISPLAY_CODES = [56, 48, 52, 45, 56, 51, 51, 45, 52, 52, 57, 51];
const PHONE_HREF_CODES = [116, 101, 108, 58, 43, 49, 56, 48, 52, 56, 51, 51, 52, 52, 57, 51];
const EMAIL_DISPLAY_CODES = [105, 110, 102, 111, 64, 104, 105, 103, 104, 109, 101, 97, 100, 111, 119, 115, 108, 97, 110, 101, 46, 99, 111, 109];
const EMAIL_HREF_CODES = [109, 97, 105, 108, 116, 111, 58, 105, 110, 102, 111, 64, 104, 105, 103, 104, 109, 101, 97, 100, 111, 119, 115, 108, 97, 110, 101, 46, 99, 111, 109];

function fromCodes(codes: number[]): string {
  return String.fromCharCode(...codes);
}

interface ContactDetails {
  street: string;
  cityStateZip: string;
  phoneDisplay: string;
  phoneHref: string;
  emailDisplay: string;
  emailHref: string;
}

export function ContactDetails() {
  const [details, setDetails] = useState<ContactDetails | null>(null);

  useEffect(() => {
    // Assembled only after mount — never present as a match-able string in
    // the page's initial HTML or in the static bundle text.
    setDetails({
      street: fromCodes(STREET_CODES),
      cityStateZip: fromCodes(CITY_STATE_ZIP_CODES),
      phoneDisplay: fromCodes(PHONE_DISPLAY_CODES),
      phoneHref: fromCodes(PHONE_HREF_CODES),
      emailDisplay: fromCodes(EMAIL_DISPLAY_CODES),
      emailHref: fromCodes(EMAIL_HREF_CODES),
    });
  }, []);

  if (!details) return null;

  return (
    <address className="contact-details">
      <span>{details.street}</span>
      <span>{details.cityStateZip}</span>
      <a href={details.phoneHref} rel="nofollow">
        {details.phoneDisplay}
      </a>
      <a href={details.emailHref} rel="nofollow">
        {details.emailDisplay}
      </a>
    </address>
  );
}
