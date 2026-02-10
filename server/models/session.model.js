// import mongoose, { Schema } from "mongoose";

// const sessionSchema = new Schema(
//     {
//         heroId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//         uplifterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//         startTime: { type: Date, default: Date.now },
//         endTime: { type: Date },
//         duration: { type: Number },
//         status: { type: String, enum: ["ongoing", "completed", "pending","declined"], default: "ongoing" },
//         initialMood: { type: Number, min: 0, max: 5 },
//         finalMood: { type: Number, min: 0, max: 5 },
//         ratingGiven: { type: Number, min: 0, max: 5 },
//         paymentStatus: { type: String, enum: ["paid", "free"], required: true },
//         inappropriate: { type: Boolean, default: false },
//         feedback: { type: String },
//     },
//     {
//         timestamps: true
//     }
// );

// const Session = mongoose.model("Session", sessionSchema);
// export default Session;


import mongoose, { Schema } from "mongoose";

const sessionSchema = new Schema(
  {
    heroId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    uplifterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    duration: {
      type: Number, // seconds
    },

    status: {
      type: String,
      enum: ["ongoing", "completed", "pending", "declined"],
      default: "ongoing",
    },

    initialMood: { type: Number, min: 0, max: 5 },
    finalMood: { type: Number, min: 0, max: 5 },
    ratingGiven: { type: Number, min: 0, max: 5 },

    paymentStatus: {
      type: String,
      enum: ["paid", "free"],
      default: "free", // 🔥 IMPORTANT
    },

    inappropriate: { type: Boolean, default: false },
    feedback: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Session", sessionSchema);
