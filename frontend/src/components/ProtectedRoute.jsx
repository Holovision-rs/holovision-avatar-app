import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, refreshUser, logout } = useAuth();
  const [status, setStatus] = useState("checking"); // 'checking', 'authorized', 'unauthorized', 'upgrade'

  useEffect(() => {
    const validate = async () => {
      try {
        const freshUser = await refreshUser();
        console.log("🔐 ProtectedRoute refreshed user:", freshUser);

        if (!freshUser) {
          setStatus("unauthorized");
        } else if (adminOnly && !freshUser.isAdmin) {
          setStatus("unauthorized");
        } else if (!adminOnly && freshUser.monthlyPaidMinutes === 0) {
          setStatus("upgrade");
        } else {
          setStatus("authorized");
        }
      } catch (err) {
        console.error("❌ ProtectedRoute error:", err);
        logout?.();
        setStatus("unauthorized");
      }
    };

    validate();
  }, [adminOnly, refreshUser, logout]);

  if (status === "checking") {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
        <p style={{ fontSize: "1.2rem", fontWeight: "bold" }}>
          🔐 Proveravam pristup...
        </p>
      </div>
    );
  }

  if (status === "unauthorized") return <Navigate to="/login" replace />;
  if (status === "upgrade") return <Navigate to="/upgrade" replace />;

  return children;
};

export default ProtectedRoute;