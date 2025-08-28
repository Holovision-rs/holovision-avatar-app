import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // <--- Dodaj ovo
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    subscription: {
      type: String,
      enum: ['free', 'silver', 'gold'],
      default: 'free',
    },
    usageLog: [
      {
        timestamp: { type: Date, required: true },
        minutes: { type: Number, required: true },
      },
    ],
    monthlyUsageMinutes: {
	  type: Number,
  	  default: 0,
  	},
  	usageMonth: {
  	  type: String, // format: "2025-08"
  	  default: () => new Date().toISOString().slice(0, 7),
  	},
    monthlyPaidMinutes: {
      type: Number,
      default: 0,
    },
    isAdmin: {
    type: Boolean,
    default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);