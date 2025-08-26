import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function useSubscriptionCheck() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, logout, refreshUser } = useAuth();

  const intervalRef = useRef(null); // ✅ sprečava više intervala

  // Lokalna provera odmah
  useEffect(() => {
    if (user?.monthlyPaidMinutes === 0 && location.pathname !== "/upgrade") {
      navigate("/upgrade");
    }
  }, [user?.monthlyPaidMinutes, location.pathname, navigate]);

  // Poziva se SAMO jednom ako postoji token
  useEffect(() => {
    if (!token || !refreshUser || intervalRef.current) return;

    const checkSubscription = async () => {
      try {
        const freshUser = await refreshUser();
        if (freshUser?.monthlyPaidMinutes === 0 && location.pathname !== "/upgrade") {
          navigate("/upgrade");
        }
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          logout?.();
          if (location.pathname !== "/login") {
            navigate("/login");
          }
        } else {
          console.error("❌ Subscription check error:", err);
        }
      }
    };

    checkSubscription(); // odmah

    // ✅ stabilan interval — samo jedan
    intervalRef.current = setInterval(checkSubscription, 160000);

    return () => clearInterval(intervalRef.current);
  }, [token, refreshUser, logout, location.pathname, navigate]);
}