import jwt from "jsonwebtoken";
import User from "../models/User.js";


export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;

    // ✅ Tek sad postoji req.user
    console.log("✅ Auth.js middleware - korisnik:", req.user);

    next();
  } catch (err) {
    console.error("❌ Token error:", err.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};
