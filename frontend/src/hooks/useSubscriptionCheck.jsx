import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function useSubscriptionCheck() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, logout, refreshUser } = useAuth();
  const intervalRef = useRef(null); 

  useEffect(() => {
  console.log("🧠 token:", token);
    if (!token || !refreshUser) return;

    const checkSubscription = async () => {
      try {
        const freshUser = await refreshUser();
        console.log("🧠 Refreshed user:", freshUser);

        if (freshUser?.monthlyPaidMinutes === 0 && location.pathname !== "/upgrade") {
          console.warn("🚨 Redirecting to /upgrade");
          navigate("/upgrade");
        }
      } catch (err) {
        console.error("❌ Subscription check error:", err);
        if (err.status === 401 || err.status === 403) {
          logout?.();
          if (location.pathname !== "/login") {
            navigate("/login");
          }
        }
      }
    };

    checkSubscription();

    // Očisti prethodni interval ako postoji
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      console.log("⏱️ Running subscription check...");
      checkSubscription();
    }, 60000); // svake 1 minute

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  },[token, refreshUser, logout, location.pathname, navigate]);
}