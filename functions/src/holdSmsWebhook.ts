import * as functions from "firebase-functions/v2/https";
import { sendSms, ADMIN_PHONE_NUMBER } from "./sms";
import { sendSlackMessage } from "./slack";

/**
 * Receives Netlify's "outgoing webhook" form notifications and turns them
 * into a text message via Twilio AND a Slack message via Incoming
 * Webhook — sent in parallel, each independently. Handles BOTH forms
 * defined in index.html — hold-notification and contact.
 *
 * SMS and Slack get DIFFERENT message bodies on purpose: Twilio bills per
 * 160-character segment, so the text stays terse; Slack costs nothing per
 * character, so it carries the full details (email, phone, guest count,
 * expiry) that the short SMS deliberately omits.
 *
 * Slack works immediately with no approval process. SMS depends on your
 * Twilio A2P 10DLC campaign being approved — until then, sendSms() will
 * log a failure but Slack still goes through fine, since the two are
 * sent independently and neither blocks the other.
 *
 * The shared secret exists because Netlify's outgoing webhook UI doesn't
 * offer custom headers or request signing — without SOME check, this
 * URL would be a public, unauthenticated endpoint that anyone who found
 * it could hit repeatedly to run up your Twilio bill or spam your Slack
 * channel. Keep the URL private the same way you'd treat an API key.
 */
const WEBHOOK_SHARED_SECRET = "lkasdf89asdahsdjasdfkjasdnf239832";

export const holdSmsWebhook = functions.onRequest(
  {
    secrets: [
      "TWILIO_ACCOUNT_SID",
      "TWILIO_API_KEY_SID",
      "TWILIO_API_KEY_SECRET",
      "SLACK_WEBHOOK_URL",
    ],
  },
  async (req, res) => {
    if (req.query.secret !== WEBHOOK_SHARED_SECRET) {
      res.status(403).send("Forbidden");
      return;
    }

    // Netlify's outgoing webhook payload nests submitted fields under
    // `data`, and the triggering form's name under `form_name`.
    const body = (req.body ?? {}) as Record<string, unknown>;
    const payload = body.payload as Record<string, unknown> | undefined;
    const data = (body.data as Record<string, unknown>) ?? (payload?.data as Record<string, unknown>) ?? body;
    const formName = (body.form_name as string) ?? (payload?.form_name as string) ?? "";

    let smsText: string;
    let slackText: string;

    if (formName === "contact") {
      const name = (data.name as string) ?? "Someone";
      const email = (data.email as string) ?? "no email";
      const eventDate = (data.eventDate as string) || "no date given";
      const guestCount = (data.guestCount as string) ?? "?";
      const message = (data.message as string) ?? "";

      // Terse for SMS (billed per 160-char segment)...
      smsText = `New inquiry: ${name} — event date ${eventDate}. ${message}`.slice(0, 300);
      // ...full details for Slack (free, no length pressure).
      slackText =
        `:incoming_envelope: *New inquiry*\n` +
        `*Name:* ${name}\n` +
        `*Email:* ${email}\n` +
        `*Event date:* ${eventDate}\n` +
        `*Guests:* ${guestCount}\n` +
        `*Message:* ${message}`;
    } else {
      // hold-notification, or an unrecognized form.
      const clientName = (data.clientName as string) ?? "Someone";
      const email = (data.email as string) ?? "no email";
      const phone = (data.phone as string) ?? "no phone";
      const guestCount = (data.guestCount as string) ?? "?";
      const packageName = (data.packageName as string) ?? "a package";
      const dateRange = (data.dateRange as string) ?? "";
      const totalPrice = (data.totalPrice as string) ?? "";
      const holdExpiresAt = (data.holdExpiresAt as string) ?? "";

      smsText = `New hold: ${clientName} — ${packageName} ${dateRange} (${totalPrice})`;
      slackText =
        `:calendar: *New hold placed*\n` +
        `*Name:* ${clientName}\n` +
        `*Email:* ${email}\n` +
        `*Phone:* ${phone}\n` +
        `*Guests:* ${guestCount}\n` +
        `*Package:* ${packageName}\n` +
        `*Dates:* ${dateRange}\n` +
        `*Total:* ${totalPrice}\n` +
        `*Hold expires:* ${holdExpiresAt}`;
    }

    // Sent independently — if Twilio is still awaiting A2P approval (or
    // fails for any other reason), that never stops the Slack message
    // from going through, and vice versa.
    await Promise.all([
      sendSms({ to: ADMIN_PHONE_NUMBER, body: smsText }),
      sendSlackMessage(slackText),
    ]);

    res.status(200).send("OK");
  }
);
