import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function useSubscriptionCheck() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, logout, refreshUser } = useAuth();

  const intervalRef = useRef(null);
  const isChecking = useRef(false);

  useEffect(() => {

    if (!token || !refreshUser) return;

    const checkSubscription = async () => {
      if (isChecking.current) {
        return;
      }
      isChecking.current = true;
      try {
        const freshUser = await refreshUser(); 
        const paid = Number(user?.monthlyPaidMinutes) || 0;
        const used = Number(user?.monthlyUsageMinutes) || 0;
        const remaining = paid - used;

        if (remaining <= 0 && location.pathname !== "/upgrade") {
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
      } finally {
        isChecking.current = false;
      }
    };

    checkSubscription(); // odmah na mount

    intervalRef.current = setInterval(() => {
      console.log("⏱️ Running subscription check...");
      checkSubscription(); // koristi zaštitu unutar
    }, 60000);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [token, refreshUser, logout, location.pathname, navigate]);
}