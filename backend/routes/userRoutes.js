import express from "express";
import User from "../models/User.js";
import { loginUser, registerUser, updateSubscription } from "../controllers/userController.js";
import { verifyToken } from "../middleware/auth.js";
import { checkMonthlyUsage } from "../middleware/checkMonthlyUsage.js";
import { requireTier } from "../middleware/subscriptionAccess.js";
import { isAdmin } from "../middleware/isAdmin.js";
import { requireAdmin } from "../middleware/adminOnly.js"; // moraš napraviti middleware
const router = express.Router();

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
router.post("/login", loginUser);
router.post("/register", registerUser);
router.put("/subscription", verifyToken, updateSubscription); // 🔐 zaštićena ruta
router.get("/admin/users", verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, "email subscription monthlyUsageMinutes usageMonth");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});
// Primer rute dostupne samo za silver i gold korisnike
router.get("/avatar/use", verifyToken, requireTier(["silver", "gold"]), (req, res) => {
  res.json({ message: "You have access to avatar usage!" });
});
// Dohvatanje podataka o korisniku preko tokena
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password isAdmin");
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;