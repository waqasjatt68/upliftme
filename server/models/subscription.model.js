import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // --- For weekly plan ---
    hasWeeklySubscription: { type: Boolean, default: false },
    hasExtendedSubscription: { type: Boolean, default: false },
    weeklyExpiresAt: { type: Date }, // When the weekly plan expires
    
    // --- For session bundle plan ---
    sessionBalance: { type: Number, default: 0 }, // Total available sessions

    purchasedBundles: [
      {
        bundleSize: { type: Number, required: true }, // e.g., 10
        amountPaid: { type: Number, required: true }, // e.g., 25
        purchaseDate: { type: Date, default: Date.now },
      },
    ],

    // Optional: Premium/MVP access flag
    specialKeyAccess: { type: Boolean, default: false },

    // Tracking info
    totalSpent: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Middleware to update `lastUpdated` before saving
subscriptionSchema.pre("save", function () {
  this.lastUpdated = Date.now();

});

const Subscription = mongoose.model("Subscription", subscriptionSchema);
export default Subscription;
