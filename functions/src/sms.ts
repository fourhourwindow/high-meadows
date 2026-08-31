/**
 * Minimal Twilio SMS sender using their REST API directly via fetch — no
 * need for the full twilio npm package for a single, simple use case.
 *
 * Authenticates with an API Key rather than your raw Account SID + Auth
 * Token — this is what Twilio itself recommends for anything beyond local
 * testing, since an API Key can be revoked individually without needing
 * to reset your master Auth Token (which every other Twilio integration
 * you might add later would also be using).
 *
 * Sends via a Messaging Service rather than a raw phone number — this is
 * required, not optional, for US business texting. A number on its own
 * isn't associated with your A2P 10DLC campaign registration; only a
 * Messaging Service is. Sending with a plain `From` number instead
 * produces error 30034 ("Message from an Unregistered Number") even when
 * the number and campaign are both correctly set up.
 *
 * SETUP (one-time, done by you — not in code):
 *   1. Sign up at twilio.com. On a trial account, you'll need to verify
 *      your own cell number before Twilio will let you send to it.
 *   2. Buy a Twilio phone number: Phone Numbers > Buy a number. Costs
 *      roughly $1/month, plus a small per-message fee.
 *   3. Create a Messaging Service (Messaging > Services), add your
 *      phone number to it, and complete A2P 10DLC brand + campaign
 *      registration for it — this can take anywhere from a few hours to
 *      a couple of weeks to be approved.
 *   4. Copy the Messaging Service SID (starts with "MG...") from
 *      Messaging > Services > (your service).
 *   5. Create an API Key: Console > Account > API keys & tokens > Create
 *      API key. Choose type "Standard" — enough access to send messages
 *      without granting account-management permissions a "Main" key
 *      would. Copy the Key SID and Secret immediately; the secret is
 *      only ever shown once.
 *   6. From your functions folder, run:
 *        firebase functions:secrets:set TWILIO_ACCOUNT_SID
 *        firebase functions:secrets:set TWILIO_API_KEY_SID
 *        firebase functions:secrets:set TWILIO_API_KEY_SECRET
 *      (Account SID is on your Console dashboard's main page — Twilio
 *      still needs this in the request URL even when authenticating with
 *      an API Key instead of the Auth Token.)
 *   7. Update TWILIO_MESSAGING_SERVICE_SID and ADMIN_PHONE_NUMBER below.
 */
export const TWILIO_MESSAGING_SERVICE_SID = "MG00000000000000000000000000000000"; // ← your Messaging Service SID
export const ADMIN_PHONE_NUMBER = "+15550000000"; // ← your own cell number, E.164 format

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
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  if (!accountSid || !apiKeySid || !apiKeySecret) {
    console.error("Twilio credentials not configured — skipping SMS send");
    return;
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          // Username is the API Key SID, password is the API Key Secret —
          // NOT the Account SID / Auth Token pair, even though the URL
          // above still needs the real Account SID.
          Authorization:
            "Basic " + Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          MessagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
          Body: body,
        }).toString(),
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
