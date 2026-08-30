import * as functions from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";
import { confirmBookingPayment } from "./booking";
import { approveUpgrade, approveDowngrade } from "./upgradeDowngrade";

// Set via: firebase functions:secrets:set STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

/**
 * Single Stripe webhook endpoint for the whole app. Metadata on each
 * PaymentIntent/Checkout Session tells us which flow it belongs to
 * (initial booking deposit, upgrade payment, or downgrade refund) — set
 * that metadata when you create the Checkout Session on the client-facing
 * side, e.g. { bookingId, purpose: "deposit" | "upgrade" | "balance",
 * changeRequestId? }.
 */
export const stripeWebhook = functions.onRequest(
  { rawBody: true } as any,
  async (req, res) => {
    let event: Stripe.Event;
    try {
      const signature = req.headers["stripe-signature"] as string;
      event = stripe.webhooks.constructEvent((req as any).rawBody, signature, webhookSecret);
    } catch (err) {
      logger.error("Stripe signature verification failed", err);
      res.status(400).send("Webhook signature verification failed");
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const { bookingId, purpose, changeRequestId } = session.metadata ?? {};
          const paymentIntentId = session.payment_intent as string;

          if (purpose === "deposit" && bookingId) {
            await confirmBookingPayment(bookingId, paymentIntentId);
          } else if (purpose === "upgrade" && changeRequestId) {
            await approveUpgrade(changeRequestId, paymentIntentId);
          }
          // "balance" (final payment before the event) would update the
          // booking's balanceDue/paid fields here — omitted for brevity.
          break;
        }

        case "refund.created": {
          const refund = event.data.object as Stripe.Refund;
          const changeRequestId = refund.metadata?.changeRequestId;
          if (changeRequestId) {
            await approveDowngrade(changeRequestId, refund.id);
          }
          break;
        }

        default:
          // Unhandled event types are fine to ignore — Stripe sends many.
          break;
      }
      res.status(200).send({ received: true });
    } catch (err) {
      logger.error("Error handling Stripe webhook", err);
      res.status(500).send("Webhook handler error");
    }
  }
);
