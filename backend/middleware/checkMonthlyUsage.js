import User from "../models/User.js";
import { subscriptionLimits } from "./subscriptionAccess.js";

export const checkMonthlyUsage = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const nowMonth = new Date().toISOString().slice(0, 7); // npr. "2025-08"
    const userMonth = user.usageMonth || nowMonth;

    // Reset ako je novi mesec
    if (userMonth !== nowMonth) {
      user.monthlyUsageMinutes = 0;
      user.usageMonth = nowMonth;
      await user.save();
    }

    const limit = subscriptionLimits[user.subscription || "free"] || 0;

    if (user.monthlyUsageMinutes >= limit) {
      return res.status(403).json({
        message: `Monthly limit reached (${limit} min for ${user.subscription})`,
      });
    }

    req.currentUser = user; // Dostupan u narednim handlerima
    next();
  } catch (err) {
    res.status(500).json({ message: "Failed to check usage limit" });
  }
};