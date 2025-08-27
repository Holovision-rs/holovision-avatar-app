import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function useSubscriptionCheck() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, logout, refreshUser } = useAuth();

  const intervalRef = useRef(null);
 console.log("🧠 Refreshed intervalRef.current:",intervalRef.current); // debug
  useEffect(() => {

    if (!token || !refreshUser || intervalRef.current) return;

    const checkSubscription = async () => {
      try {
        const freshUser = await refreshUser();
        console.log("🧠 Refreshed user:", freshUser); // debug

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

    checkSubscription(); // odmah

    intervalRef.current = setInterval(checkSubscription, 60000);

    return () => clearInterval(intervalRef.current);
  }, [token, refreshUser, logout, location.pathname, navigate]);
}