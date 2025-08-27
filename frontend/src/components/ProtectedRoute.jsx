import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user } = useAuth();
  console.log("🔒 ProtectedRoute:", user);
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !user.isAdmin) return <Navigate to="/" replace />;
  if (!adminOnly && user.monthlyPaidMinutes === 0) {
    return <Navigate to="/upgrade" replace />;
  }

  return children;
};

export default ProtectedRoute;