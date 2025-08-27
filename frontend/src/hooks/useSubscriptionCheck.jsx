import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function useSubscriptionCheck() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, logout, refreshUser } = useAuth();

  const intervalRef = useRef(null);
  const locationRef = useRef(location.pathname);

  useEffect(() => {
    if (!token || !refreshUser) return;

    const checkSubscription = async () => {
      try {
        const freshUser = await refreshUser();
        console.log("🧠 Refreshed user:", freshUser);

        if (
          freshUser?.monthlyPaidMinutes === 0 &&
          locationRef.current !== "/upgrade"
        ) {
          console.warn("🚨 Redirecting to /upgrade");
          navigate("/upgrade");
        }
      } catch (err) {
        console.error("❌ Subscription check error:", err);
        if (err.status === 401 || err.status === 403) {
          logout?.();
          if (locationRef.current !== "/login") {
            navigate("/login");
          }
        }
      }
    };

    // Pokreni odmah
    checkSubscription();

    // Očisti stari interval ako postoji
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Pokreći proveru svakih 60 sekundi
    intervalRef.current = setInterval(() => {
      console.log("⏱️ Running subscription check...");
      checkSubscription();
    }, 60000);

    // Clean-up pri unmountovanju
    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [token, refreshUser, logout, navigate]);
}