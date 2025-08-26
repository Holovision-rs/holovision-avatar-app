import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import throttle from "lodash.throttle";

export function useSubscriptionCheck() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, logout, refreshUser } = useAuth();

  useEffect(() => {
    if (user?.monthlyPaidMinutes <= 0 && location.pathname !== "/upgrade") {
      navigate("/upgrade");
    }
  }, [user?.monthlyPaidMinutes, location.pathname, navigate]);

  useEffect(() => {
    if (!token || !refreshUser) return;

    let isCancelled = false;

    const throttledCheck = throttle(async () => {
      try {
        const freshUser = await refreshUser();
        if (!isCancelled && freshUser?.monthlyPaidMinutes <= 0 && location.pathname !== "/upgrade") {
          navigate("/upgrade");
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("❌ Subscription check error:", err);

          if (err.status === 401 || err.status === 403) {
            logout?.();
            if (location.pathname !== "/login") {
              navigate("/login");
            }
          }
        }
      }
    }, 60000); // throttle na 60s

    const interval = setInterval(() => {
      throttledCheck();
    }, 15000); // pokuša svakih 15s, throttled blokira višak

    throttledCheck(); // odmah prva provera

    return () => {
      isCancelled = true;
      clearInterval(interval);
      throttledCheck.cancel(); // prekid throttle state-a
    };
  }, [token, refreshUser, logout, location.pathname, navigate]);
}