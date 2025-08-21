import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

export const registerUser = async (req, res) => {
  const { email, password, isAdmin  } = req.body;
  const userExists = await User.findOne({ email });
  if (userExists) return res.status(400).json({ message: "User already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({ email, password: hashedPassword, isAdmin });
  res.status(201).json({ token: generateToken(user._id) });
};

export const loginUser = async (req, res) => {
  try {
    console.log("Login payload:", req.body); // 🔍 DEBUG

    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      console.log("Invalid credentials"); // 🔍
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const responsePayload = {
      _id: user._id,
      email: user.email,
      subscription: user.subscription,
      monthlyUsageMinutes: user.monthlyUsageMinutes,
      usageMonth: user.usageMonth,
      token: generateToken(user._id),
    };

    console.log("Login successful, sending:", responsePayload); // 🔍
    res.status(200).json(responsePayload);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
};

export const updateSubscription = async (req, res) => {
  const { id, newTier } = req.body;

  if (!['free', 'silver', 'gold'].includes(newTier)) {
    return res.status(400).json({ message: "Invalid tier" });
  }

  try {
    const user = await User.findByIdAndUpdate(id, { subscription: newTier }, { new: true });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Error updating subscription" });
  }
};
