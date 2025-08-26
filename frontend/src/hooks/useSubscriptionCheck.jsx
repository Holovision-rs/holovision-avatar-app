import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import throttle from "lodash.throttle";

export function useSubscriptionCheck() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, logout, refreshUser } = useAuth();

  // ⚡ Provera lokalnog user stanja kad se promeni
  useEffect(() => {
    if (user?.monthlyPaidMinutes <= 0 && location.pathname !== "/upgrade") {
      navigate("/upgrade");
    }
  }, [user?.monthlyPaidMinutes, location.pathname, navigate]);

  // 🔁 Intervalna provera pretplate (throttle + refresh)
  useEffect(() => {
    if (!token || !refreshUser) return;

    let cancelled = false;

    const throttledCheck = throttle(async () => {
      try {
        const freshUser = await refreshUser();
        if (!cancelled && freshUser?.monthlyPaidMinutes <= 0 && location.pathname !== "/upgrade") {
          navigate("/upgrade");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("❌ Subscription check error:", err);

          // ⛔ Ako token nije validan
          if (err.status === 401 || err.status === 403) {
            logout?.();
            if (location.pathname !== "/login") {
              navigate("/login");
            }
          }
        }
      }
    }, 30000); // throttle: najviše jednom u 30 sekundi

    throttledCheck(); // odmah pozovi
    const interval = setInterval(throttledCheck, 5000); // pokušaj svakih 5s

    return () => {
      cancelled = true;
      clearInterval(interval);
      throttledCheck.cancel();
    };
  }, [token, refreshUser, logout, navigate, location.pathname]);
}