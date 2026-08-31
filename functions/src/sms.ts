/**
 * Minimal Twilio SMS sender using their REST API directly via fetch — no
 * need for the full twilio npm package for a single, simple use case.
 *
 * SETUP (one-time, done by you — not in code):
 *   1. Sign up at twilio.com. On a trial account, you'll need to verify
 *      your own cell number before Twilio will let you send to it.
 *   2. Buy a Twilio phone number: Phone Numbers > Buy a number. This is
 *      the number texts appear to come FROM — costs roughly $1/month,
 *      plus a small per-message fee (a fraction of a cent each).
 *   3. From the Twilio console dashboard, copy your Account SID and Auth
 *      Token, then run:
 *        firebase functions:secrets:set TWILIO_ACCOUNT_SID
 *        firebase functions:secrets:set TWILIO_AUTH_TOKEN
 *   4. Update TWILIO_FROM_NUMBER and ADMIN_PHONE_NUMBER below with your
 *      Twilio number and your own cell number, both in E.164 format
 *      (e.g. +15551234567 — country code, no dashes or spaces).
 */
export const TWILIO_FROM_NUMBER = "+15550000000"; // ← your Twilio number
export const ADMIN_PHONE_NUMBER = "+15550000000"; // ← your own cell number

interface SendSmsInput {
  to: string;
  body: string;
}

/**
 * Logs failures rather than throwing — same reasoning as sendEmail did:
 * a notification failing shouldn't be treated as a bigger problem than it
 * is, since by the time this runs the actual hold is already safely saved.
 */
export async function sendSms({ to, body }: SendSmsInput): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    console.error("Twilio credentials not configured — skipping SMS send");
    return;
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: body }).toString(),
      }
    );
    if (!response.ok) {
      const text = await response.text();
      console.error(`Twilio SMS failed (${response.status}):`, text);
    }
  } catch (err) {
    console.error("Twilio SMS request failed:", err);
  }
}
