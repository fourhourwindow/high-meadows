import * as functions from "firebase-functions/v2/https";
import { sendSms, ADMIN_PHONE_NUMBER } from "./sms";

/**
 * Receives Netlify's "outgoing webhook" form notification for the
 * hold-notification form (see index.html + BookingFlow.tsx) and turns it
 * into a text message via Twilio.
 *
 * SETUP:
 *   1. Change WEBHOOK_SHARED_SECRET below to your own long random string.
 *   2. Deploy this function, note its URL (printed after deploy — looks
 *      like https://us-central1-high-meadows.cloudfunctions.net/holdSmsWebhook).
 *   3. In Netlify: Site configuration > Forms > Form notifications >
 *      Add notification > Outgoing webhook. Form: hold-notification.
 *      URL: your function's URL with ?secret=<your secret> appended,
 *      e.g. https://.../holdSmsWebhook?secret=abc123...
 *
 * The shared secret exists because Netlify's outgoing webhook UI doesn't
 * offer custom headers or request signing — without SOME check, this
 * URL would be a public, unauthenticated endpoint that anyone who found
 * it could hit repeatedly to run up your Twilio bill. A hard-to-guess
 * secret in the URL is a lightweight but real deterrent; keep the URL
 * itself private the same way you'd treat an API key.
 */
const WEBHOOK_SHARED_SECRET = "REPLACE_WITH_A_LONG_RANDOM_STRING";

export const holdSmsWebhook = functions.onRequest(
  { secrets: ["TWILIO_ACCOUNT_SID", "TWILIO_API_KEY_SID", "TWILIO_API_KEY_SECRET"] },
  async (req, res) => {
    if (req.query.secret !== WEBHOOK_SHARED_SECRET) {
      res.status(403).send("Forbidden");
      return;
    }

    // Netlify's outgoing webhook payload nests submitted fields under
    // `data`. Falling back to a couple of shapes defensively, since the
    // exact structure is only fully confirmed by seeing a real payload —
    // check this function's logs after your first test submission if the
    // text comes through with missing/wrong values, and adjust here.
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data =
      (body.data as Record<string, unknown>) ??
      ((body.payload as any)?.data as Record<string, unknown>) ??
      body;

    const clientName = (data.clientName as string) ?? "Someone";
    const packageName = (data.packageName as string) ?? "a package";
    const dateRange = (data.dateRange as string) ?? "";
    const totalPrice = (data.totalPrice as string) ?? "";

    await sendSms({
      to: ADMIN_PHONE_NUMBER,
      body: `New hold: ${clientName} — ${packageName} ${dateRange} (${totalPrice})`,
    });

    res.status(200).send("OK");
  }
);
