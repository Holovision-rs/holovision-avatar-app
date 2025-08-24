import express from "express";
import User from "../models/User.js";
import { loginUser, registerUser, updateSubscription } from "../controllers/userController.js";
import { verifyToken } from "../middleware/auth.js";
import { checkMonthlyUsage } from "../middleware/checkMonthlyUsage.js";
import { requireTier } from "../middleware/subscriptionAccess.js";
import { authMiddleware } from "../middleware/Auth.js";

const router = express.Router();

// 📌 Login i registracija
router.post("/login", loginUser);
router.post("/register", registerUser);

router.post("/me/usage-log", authMiddleware, async (req, res) => {
  const { timestamp, minutes } = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.usageLog = user.usageLog || [];
    user.usageLog.push({ timestamp, minutes });

    user.monthlyUsageMinutes += minutes;

    await user.save();

    res.status(201).json({ message: "Usage added", usage: { timestamp, minutes } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
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
router.get('/users/:id/usage-log', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("usageLog");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user.usageLog);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/users/:id/usage-log
router.post('/:id/usage-log', async (req, res) => {
  const userId = req.params.id;
  const { timestamp, minutes } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Dodaj usage entry
    user.usageLog = user.usageLog || [];
    user.usageLog.push({ timestamp, minutes });

    await user.save();

    res.status(201).json({ message: 'Usage added', usage: { timestamp, minutes } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// 📌 Kraj sesije — dodaj minutažu
router.post("/session-end", verifyToken, checkMonthlyUsage, async (req, res) => {
  const { durationInSeconds } = req.body;
  const durationInMinutes = Math.ceil(durationInSeconds / 60);

  try {
    req.currentUser.monthlyUsageMinutes += durationInMinutes;
    await req.currentUser.save();
    res.status(200).json({ message: "Usage updated", used: req.currentUser.monthlyUsageMinutes });
  } catch (err) {
    res.status(500).json({ message: "Failed to update usage" });
  }
});

export default router;