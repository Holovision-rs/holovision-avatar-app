// 📁 routes/adminRoutes.js
import express from "express";
import User from "../models/User.js";
import { verifyToken } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/adminOnly.js";

const router = express.Router();

// Lista svih korisnika
router.get("/users", verifyToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// Brisanje korisnika
router.delete("/users/:id", verifyToken, requireAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// Izmena pretplate
router.patch("/users/:id/subscription", verifyToken, requireAdmin, async (req, res) => {
  try {
    const { subscription } = req.body;

    if (!["free", "silver", "gold"].includes(subscription)) {
      return res.status(400).json({ message: "Invalid subscription type" });
    }

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