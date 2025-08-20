import express from "express";
import User from "../models/User.js";
import { loginUser, registerUser, updateSubscription } from "../controllers/userController.js";
import { verifyToken } from "../middleware/auth.js";
import { requireTier } from "../middleware/subscription.js";

const router = express.Router();

router.post("/login", loginUser);
router.post("/register", registerUser);
router.put("/subscription", verifyToken, updateSubscription); // 🔐 zaštićena ruta

// Primer rute dostupne samo za silver i gold korisnike
router.get("/avatar/use", verifyToken, requireTier(["silver", "gold"]), (req, res) => {
  res.json({ message: "You have access to avatar usage!" });
});
// Dohvatanje podataka o korisniku preko tokena
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;