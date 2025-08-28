import React, { useEffect, useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ShieldAlert } from "lucide-react";

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, refreshUser, logout } = useAuth();
  const [status, setStatus] = useState("checking"); // 'checking', 'authorized', 'unauthorized', 'upgrade'
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    const validate = async () => {
      const now = Date.now();
      const MIN_INTERVAL = 60000;

      // Ako je već pozvano u poslednjih 60 sekundi, koristi cached user
      if (now - lastRefreshRef.current < MIN_INTERVAL) {
        console.log("⏳ ProtectedRoute SKIPPING refreshUser");
        evaluateUser(user);
        return;
      }

      try {
        const freshUser = await refreshUser();
        console.log("🔐 ProtectedRoute refreshed user:", freshUser);
        lastRefreshRef.current = now;
        evaluateUser(freshUser);
      } catch (err) {
        console.error("❌ ProtectedRoute error:", err);
        logout?.();
        setStatus("unauthorized");
      }
    };

    const evaluateUser = (currentUser) => {
      const safeMinutes = Math.max(currentUser?.monthlyPaidMinutes ?? 0, 0);

      if (!currentUser) {
        setStatus("unauthorized");
      } else if (adminOnly && !currentUser.isAdmin) {
        setStatus("unauthorized");
      } else if (!adminOnly && safeMinutes <= 0) {
        setStatus("upgrade");
      } else {
        setStatus("authorized");
      }
    };

    validate();
  }, [adminOnly, refreshUser, logout, user]);

  if (status === "checking") {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
        <p style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
        <ShieldAlert  color="white" size={26} /> Checking access...
        </p>
      </div>
    );
  }

  if (status === "unauthorized") return <Navigate to="/login" replace />;
  if (status === "upgrade") return <Navigate to="/upgrade" replace />;

  return children;
};

export default ProtectedRoute;