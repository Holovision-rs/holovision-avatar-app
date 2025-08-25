import User from "../models/User.js";
import { subscriptionLimits } from "./subscriptionAccess.js";

export const checkMonthlyUsage = async (req, res, next) => {
  try {
    const user = req.user;
    const nowMonth = new Date().toISOString().slice(0, 7); // "2025-08"

    if (!user.usageMonth || user.usageMonth !== nowMonth) {
      user.monthlyUsageMinutes = 0;
      user.usageMonth = nowMonth;
      await user.save(); // samo ako se nešto menja
    }

    const limit = subscriptionLimits[user.subscription || "free"] || 0;

    if (user.monthlyUsageMinutes >= limit) {
      return res.status(403).json({
        message: `Monthly limit reached (${limit} min for ${user.subscription})`,
      });
    }

    next();
  } catch (err) {
    res.status(500).json({ message: "Failed to check usage limit" });
  }
};