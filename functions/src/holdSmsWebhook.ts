import * as functions from "firebase-functions/v2/https";
import { sendSms, ADMIN_PHONE_NUMBER } from "./sms";
import { sendSlackMessage } from "./slack";

/**
 * Receives Netlify's "outgoing webhook" form notifications and turns them
 * into a text message via Twilio AND a Slack message via Incoming
 * Webhook — sent in parallel, each independently. Handles BOTH forms
 * defined in index.html — hold-notification and contact — since they're
 * genuinely different fields, not just different labels for the same
 * data. Netlify includes which form triggered the webhook as `form_name`
 * in the payload; that's what branches the message below.
 *
 * Slack works immediately with no approval process. SMS depends on your
 * Twilio A2P 10DLC campaign being approved — until then, sendSms() will
 * log a failure but Slack still goes through fine, since the two are
 * sent independently and neither blocks the other.
 *
 * SETUP:
 *   1. Change WEBHOOK_SHARED_SECRET below to your own long random string.
 *   2. Deploy this function, note its URL (printed after deploy).
 *   3. In Netlify: Site configuration > Forms > Form notifications >
 *      Add notification > Outgoing webhook — do this TWICE, once for
 *      each form. Both point at the SAME URL with the SAME
 *      ?secret=<your secret> appended — you're just registering the
 *      same endpoint against two different trigger events. (If you
 *      already set these up for SMS, nothing here needs to change —
 *      Slack rides along on the exact same webhook calls.)
 *
 * The shared secret exists because Netlify's outgoing webhook UI doesn't
 * offer custom headers or request signing — without SOME check, this
 * URL would be a public, unauthenticated endpoint that anyone who found
 * it could hit repeatedly to run up your Twilio bill or spam your Slack
 * channel. A hard-to-guess secret in the URL is a lightweight but real
 * deterrent; keep the URL itself private the same way you'd treat an API
 * key.
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
    // `data`, and the triggering form's name under `form_name`. Falling
    // back to a couple of shapes defensively, since the exact structure
    // is only fully confirmed by seeing a real payload — check this
    // function's logs if a notification comes through with missing/wrong
    // values.
    const body = (req.body ?? {}) as Record<string, unknown>;
    const payload = body.payload as Record<string, unknown> | undefined;
    const data = (body.data as Record<string, unknown>) ?? (payload?.data as Record<string, unknown>) ?? body;
    const formName = (body.form_name as string) ?? (payload?.form_name as string) ?? "";

    let notificationText: string;
    if (formName === "contact") {
      const name = (data.name as string) ?? "Someone";
      const eventDate = (data.eventDate as string) || "no date given";
      const message = (data.message as string) ?? "";
      // Trimmed since a free-text message field could run long — Twilio
      // bills per 160-character segment (Slack has no such limit, but
      // one shared message keeps both notifications consistent).
      notificationText = `New inquiry: ${name} — event date ${eventDate}. ${message}`.slice(0, 300);
    } else {
      // hold-notification, or an unrecognized form — same fallback
      // behavior as before rather than silently doing nothing.
      const clientName = (data.clientName as string) ?? "Someone";
      const packageName = (data.packageName as string) ?? "a package";
      const dateRange = (data.dateRange as string) ?? "";
      const totalPrice = (data.totalPrice as string) ?? "";
      notificationText = `New hold: ${clientName} — ${packageName} ${dateRange} (${totalPrice})`;
    }

    // Sent independently — if Twilio is still awaiting A2P approval (or
    // fails for any other reason), that never stops the Slack message
    // from going through, and vice versa.
    await Promise.all([
      sendSms({ to: ADMIN_PHONE_NUMBER, body: notificationText }),
      sendSlackMessage(notificationText),
    ]);

    res.status(200).send("OK");
  }
);
