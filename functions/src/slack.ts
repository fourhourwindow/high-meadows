/**
 * Minimal Slack notification sender using a Slack Incoming Webhook — no
 * Slack app installation or Netlify plan tier requirements, unlike
 * Netlify's own native Slack integration. Works immediately, with no
 * approval process of any kind (unlike Twilio's A2P 10DLC review).
 *
 * SETUP (one-time, done by you — not in code):
 *   1. Go to api.slack.com/apps > Create New App > From scratch. Name it
 *      something like "High Meadows Notifications" and pick your
 *      workspace.
 *   2. In the app's settings, go to Features > Incoming Webhooks, and
 *      toggle it on.
 *   3. Click "Add New Webhook to Workspace," choose the channel you want
 *      notifications posted to, and authorize it.
 *   4. Copy the webhook URL it gives you — looks like
 *      https://hooks.slack.com/services/T000/B000/xxxxxxxxxxxxxxxxxxxx
 *   5. From your functions folder, run:
 *        firebase functions:secrets:set SLACK_WEBHOOK_URL
 *      and paste that URL when prompted.
 *
 * Treat this URL as a secret even though it's not a traditional API key —
 * anyone who has it can post messages into your Slack channel.
 */
export async function sendSlackMessage(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("SLACK_WEBHOOK_URL not configured — skipping Slack notification");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`Slack notification failed (${response.status}):`, body);
    }
  } catch (err) {
    console.error("Slack notification request failed:", err);
  }
}
