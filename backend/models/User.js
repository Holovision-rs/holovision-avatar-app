import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    subscription: {
      type: String,
      enum: ['free', 'silver', 'gold'],
      default: 'free',
    },
    monthlyUsageMinutes: {
	  type: Number,
	  default: 0,
	},
	usageMonth: {
	  type: String, // format: "2025-08"
	  default: () => new Date().toISOString().slice(0, 7),
	},
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);