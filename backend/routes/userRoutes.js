import express from "express";
import User from "../models/User.js";
import { loginUser, registerUser, updateSubscription } from "../controllers/userController.js";
import { verifyToken } from "../middleware/auth.js";
import { checkMonthlyUsage } from "../middleware/checkMonthlyUsage.js";
import { requireTier } from "../middleware/subscriptionAccess.js";

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