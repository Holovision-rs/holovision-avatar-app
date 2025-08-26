import { useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function useSubscriptionCheck() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, logout, refreshUser } = useAuth();

  // ⚡ Lokalna provera odmah
  useEffect(() => {
    if (user?.monthlyPaidMinutes === 0 && location.pathname !== "/upgrade") {
      navigate("/upgrade");
    }
  }, [user?.monthlyPaidMinutes, location.pathname, navigate]);

  // ✅ Memoizovana funkcija za proveru pretplate
  const checkSubscription = useMemo(() => {
    return async () => {
      try {
        const freshUser = await refreshUser();
        if (freshUser?.monthlyPaidMinutes === 0 && location.pathname !== "/upgrade") {
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
  }, [refreshUser, logout, location.pathname, navigate]);

  // 🔁 Provera svakih 60 sekundi
  useEffect(() => {
    if (!token || !checkSubscription) return;

    checkSubscription(); // odmah na mount

    const interval = setInterval(() => {
      checkSubscription();
    }, 60000); // svakih 60s

    return () => clearInterval(interval);
  }, [token, checkSubscription]);
}