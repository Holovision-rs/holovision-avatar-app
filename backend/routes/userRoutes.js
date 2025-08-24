import express from "express";
import User from "../models/User.js";
import { loginUser, registerUser, updateSubscription } from "../controllers/userController.js";
import { verifyToken } from "../middleware/auth.js";
import { checkMonthlyUsage } from "../middleware/checkMonthlyUsage.js";
import { requireTier } from "../middleware/subscriptionAccess.js";
import { authMiddleware } from "../middleware/Auth.js";
import { adminAuth } from "../middleware/adminAuth.js";

const router = express.Router();

// 📌 Login i registracija
router.post("/login", loginUser);
router.post("/register", registerUser);
// 📌 Dohvati informacije o trenutno ulogovanom korisniku
router.get("/me", verifyToken, async (req, res) => {
  try {
    res.status(200).json(req.user); // `req.user` već očišćen od lozinke u `verifyToken`
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// 📌 Izmena pretplate
router.put("/subscription", verifyToken, updateSubscription);

// 📌 Korišćenje avatara — samo za silver/gold korisnike
router.get("/avatar/use", verifyToken, requireTier(["silver", "gold"]), (req, res) => {
  res.json({ message: "You have access to avatar usage!" });
});

// 📌 Dodavanje usage za trenutnog korisnika (koristi se u Avatar.js)
router.post("/me/usage-log", authMiddleware, async (req, res) => {
  const { timestamp, minutes } = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.usageLog = user.usageLog || [];
    user.monthlyUsageMinutes = user.monthlyUsageMinutes || 0;

    user.usageLog.push({ timestamp, minutes });
    user.monthlyUsageMinutes += minutes;

    await user.save();

    res.status(201).json({ message: "Usage added", usage: { timestamp, minutes } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 Dodavanje usage log za bilo kog korisnika (koristi admin dashboard)
router.post("/:id/usage-log", adminAuth, async (req, res) => {
  const userId = req.params.id;
  const { timestamp, minutes } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.usageLog = user.usageLog || [];
    user.usageLog.push({ timestamp, minutes });

    await user.save();

    res.status(201).json({ message: "Usage added", usage: { timestamp, minutes } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 Dohvatanje usage logova za datog korisnika (admin funkcionalnost sa mesečnim filterom)
router.get("/:id/usage-log", adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("usageLog");
    if (!user) return res.status(404).json({ error: "User not found" });

    const { month } = req.query;
    if (month) {
      const [year, monthStr] = month.split("-");
      const monthIndex = parseInt(monthStr) - 1;
      const start = new Date(year, monthIndex, 1);
      const end = new Date(year, monthIndex + 1, 1);

      const filtered = user.usageLog.filter((entry) => {
        const ts = new Date(entry.timestamp);
        return ts >= start && ts < end;
      });

      return res.json(filtered);
    }

    res.json(user.usageLog); // ako nije prosleđen ?month parametar
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// 📌 Kraj sesije — dodaj minutažu (računa se iz trajanja)
router.post("/session-end", verifyToken, checkMonthlyUsage, async (req, res) => {
  const { durationInSeconds } = req.body;
  const durationInMinutes = Math.ceil(durationInSeconds / 60);

  try {
    req.currentUser.monthlyUsageMinutes = req.currentUser.monthlyUsageMinutes || 0;
    req.currentUser.monthlyUsageMinutes += durationInMinutes;
    await req.currentUser.save();

    res.status(200).json({ message: "Usage updated", used: req.currentUser.monthlyUsageMinutes });
  } catch (err) {
    res.status(500).json({ message: "Failed to update usage" });
  }
});

export default router;