import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

export const registerUser = async (req, res) => {
  const { email, password } = req.body;
  const existingUser = await User.findOne({ email });

  if (existingUser)
    return res.status(400).json({ message: "User already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await User.create({
    email,
    password: hashedPassword,
  });

  const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET);

    res.status(201).json({
      token,
      user: {
        _id: newUser._id,
        email: newUser.email,
        subscription: newUser.subscription,
        isAdmin: newUser.isAdmin,
        usageMonth: newUser.usageMonth,
        monthlyUsageMinutes: newUser.monthlyUsageMinutes,
        monthlyPaidMinutes: newUser.monthlyPaidMinutes,
      }
    });
  };

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("➡️ Login attempt:", req.body.email);

    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("❌ Password mismatch");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    console.log("✅ Login successful:", user.email);

    res.status(200).json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        subscription: user.subscription,
        monthlyUsageMinutes: user.monthlyUsageMinutes,
        monthlyPaidMinutes: user.monthlyPaidMinutes,
        usageMonth: user.usageMonth,
        isAdmin: user.isAdmin,
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
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
