// models/payment.model.js
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "eur",
    },

    paymentMethod: {
      type: String,
      default: "card", // Stripe default
    },

    transactionId: {
      type: String,
      unique: true,
      required: true, // paymentIntent.id
    },

    status: {
      type: String,
      enum: ["succeeded", "failed", "pending"],
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);
