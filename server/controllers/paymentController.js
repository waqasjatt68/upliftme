import Payment from "../models/payment.model.js";
import User from "../models/user.model.js";
import Stripe from "stripe";
import Subscription from "../models/subscription.model.js";
import { PLAN_CONFIG } from "../constants.js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY is not set in .env – payment features will fail.");
}
if (!stripeWebhookSecret) {
  console.warn("STRIPE_WEBHOOK_SECRET is not set in .env – webhook verification will fail.");
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey.trim()) : null;

// Process a new payment using Stripe
// import Subscription from "../models/Subscription.js";

export const createPaymentIntent = async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ message: "Payments are not configured. Set STRIPE_SECRET_KEY in .env." });
  }
  try {
    const userId = req.user._id;
    const { planType } = req.body;
    // console.log(planType);
    // console.log(PLAN_CONFIG);
    // console.log(planType, PLAN_CONFIG[planType]);
    
    if (!planType || !PLAN_CONFIG[planType]) {
      return res.status(400).json({ message: "Invalid or missing plan type." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const plan = PLAN_CONFIG[planType];
    const amountInCents = Math.round(plan.amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: plan.currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      metadata: {
        userId: userId.toString(),
        planType,
        bundleSize: plan.bundleSize?.toString() || '',
      },
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Payment Intent Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  if (!stripe || !stripeWebhookSecret) {
    console.error("Webhook skipped: Stripe or STRIPE_WEBHOOK_SECRET not configured.");
    return res.status(503).send("Webhook not configured.");
  }

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret.trim());
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Respond immediately so Stripe doesn't timeout (they expect < ~30s)
  res.status(200).json({ received: true });

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;

    setImmediate(async () => {
      try {
        const paymentExists = await Payment.findOne({
          transactionId: paymentIntent.id,
        });

        if (!paymentExists) {
          await Payment.create({
            userId: paymentIntent.metadata.userId,
            transactionId: paymentIntent.id,
            amount: paymentIntent.amount_received / 100,
            currency: paymentIntent.currency,
            status: paymentIntent.status,
            planType: paymentIntent.metadata.planType,
            paymentMethod: paymentIntent.payment_method_types?.[0] || "card"
          });
          console.log("💾 Payment saved in database");
        } else {
          console.log("⚠️ Payment already exists, skipping duplicate save");
        }

        const userId = paymentIntent.metadata.userId;
        const planType = paymentIntent.metadata.planType;
        const bundleSize = parseInt(paymentIntent.metadata.bundleSize || "0");
        const amountPaid = paymentIntent.amount_received / 100;

        const existingSub = await Subscription.findOne({ userId });

        if (!existingSub) {
          if (planType === "extended") {
            console.warn("❌ Cannot apply extended plan for first-time user");
            return;
          }

          const newSub = new Subscription({
            userId,
            totalSpent: amountPaid,
            lastUpdated: new Date(),
            hasWeeklySubscription: planType === "weekly",
            sessionBalance: planType === "weekly" ? bundleSize : 0,
            weeklyExpiresAt: planType === "weekly"
              ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              : null,
            purchasedBundles: [
              { bundleSize, amountPaid },
            ],
          });

          await newSub.save();
          await User.findByIdAndUpdate(userId, {
            $set: {
              "subscription.sessionBalance": newSub.sessionBalance,
              "subscription.specialKeyAccess": newSub.hasExtendedSubscription || false,
              "subscription.purchasedBundles": newSub.purchasedBundles
            }
          });
          console.log("🆕 Created new subscription");
          return;
        }

        const updateFields = {
          $inc: { totalSpent: amountPaid },
          $set: { lastUpdated: new Date() },
          $push: { purchasedBundles: { bundleSize, amountPaid } },
        };

        if (planType === "weekly") {
          updateFields.$set.hasWeeklySubscription = true;
          updateFields.$set.sessionBalance = bundleSize;
          updateFields.$set.weeklyExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }

        if (planType === "extended") {
          if (existingSub.hasWeeklySubscription && existingSub.sessionBalance <= 0) {
            updateFields.$set.hasExtendedSubscription = true;
            updateFields.$inc.sessionBalance = bundleSize;
          } else {
            console.warn("⛔ User not eligible for extended plan purchase");
            return;
          }
        }

        const updatedSub = await Subscription.findOneAndUpdate(
          { userId },
          updateFields,
          { upsert: true, new: true }
        );
        await User.findByIdAndUpdate(userId, {
          $set: {
            "subscription.sessionBalance": updatedSub.sessionBalance,
            "subscription.specialKeyAccess": updatedSub.hasExtendedSubscription || false,
            "subscription.purchasedBundles": updatedSub.purchasedBundles
          }
        });
        console.log("🔄 Updated subscription");
      } catch (err) {
        console.error("❌ Webhook processing failed:", err);
      }
    });
  }
};

export const getAllPayments = async (req, res) => {
    try {
        const payments = await Payment.find().populate("userId");
        res.status(200).json(payments);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get a payment by transaction ID
export const getPaymentByTransactionId = async (req, res) => {
    try {
        const payment = await Payment.findOne({ transactionId: req.params.transactionId }).populate("userId");
        
        if (!payment) {
            return res.status(404).json({ message: "Payment not found." });
        }
        res.status(200).json(payment);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Update payment status
export const updatePaymentStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const payment = await Payment.findOneAndUpdate(
            { transactionId: req.params.transactionId },
            { status },
            { new: true }
        );
        if (!payment) {
            return res.status(404).json({ message: "Payment not found." });
        }
        res.status(200).json({ message: "Payment status updated successfully.", payment });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Delete a payment record
export const deletePayment = async (req, res) => {
    try {
        const payment = await Payment.findOneAndDelete({ transactionId: req.params.transactionId });
        if (!payment) {
            return res.status(404).json({ message: "Payment not found." });
        }
        res.status(200).json({ message: "Payment record deleted successfully." });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
