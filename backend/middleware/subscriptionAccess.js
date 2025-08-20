export const subscriptionLimits = {
  free: 10,      // 2 minuta dnevno
  silver: 300,   // 10 minuta dnevno
  gold: 1500,     // 60 minuta dnevno
};



export const requireTier = (allowedTiers) => {
  return (req, res, next) => {
    try {
      const userTier = req.user.subscription;
      if (!allowedTiers.includes(userTier)) {
        return res.status(403).json({ message: "Access denied for your subscription level" });
      }
      next();
    } catch (error) {
      res.status(500).json({ message: "Authorization failed" });
    }
  };
};