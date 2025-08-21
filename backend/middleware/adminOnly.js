export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.email !== "admin@mail.com") {
    return res.status(403).json({ message: "Access denied. Admin only." });
  }
  next();
};