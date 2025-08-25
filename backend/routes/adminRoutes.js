// 📁 routes/adminRoutes.js
import express from "express";
import User from "../models/User.js";
import { getUserUsageLog } from "../controllers/userController.js";
import { authMiddleware } from "../middleware/Auth.js";
import { requireAdmin } from "../middleware/adminOnly.js";

const router = express.Router();

// 📌 Dohvatanje usage logova za datog korisnika (admin funkcionalnost sa mesečnim filterom)
router.get("/users/:id/usage-log", authMiddleware, requireAdmin, getUserUsageLog);
// 📌 Lista svih korisnika (admin only)
router.get("/users", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// 📌 Brisanje korisnika (admin only)
router.delete("/users/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete user" });
  }
});
// 📌 Dodavanje plaćenih minuta (admin)
router.post("/users/:id/add-paid", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { paidMinutes } = req.body;

  if (!Number.isInteger(paidMinutes) || paidMinutes <= 0) {
    return res.status(400).json({ message: "Invalid minutes" });
  }

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.monthlyPaidMinutes += paidMinutes;
    await user.save();

    res.status(200).json({
      message: "Paid minutes added",
      monthlyPaidMinutes: user.monthlyPaidMinutes,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to update" });
  }
});

// 📌 Ručno dodavanje minuta (admin)
router.patch("/users/:id/add-minutes", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { minutes } = req.body;

  if (!Number.isInteger(minutes) || minutes <= 0) {
    return res.status(400).json({ message: "Invalid minutes" });
  }

  try {
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.monthlyUsageMinutes += minutes;
    await user.save();

    res.status(200).json({
      message: "Minutes added",
      monthlyUsageMinutes: user.monthlyUsageMinutes,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to update" });
  }
});

// 📌 Izmena pretplate (admin only)
router.patch("/users/:id/subscription", authMiddleware, requireAdmin, async (req, res) => {
  const { subscription } = req.body;

  if (!["free", "silver", "gold"].includes(subscription)) {
    return res.status(400).json({ message: "Invalid subscription type" });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { subscription },
      { new: true }
    ).select("-password");

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to update subscription" });
  }
});

export default router;