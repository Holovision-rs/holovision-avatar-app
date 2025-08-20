import express from "express";
import { loginUser, registerUser } from "../controllers/userController.js";
import { verifyToken } from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();

// Registracija i login
router.post("/login", loginUser);
router.post("/register", registerUser);

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