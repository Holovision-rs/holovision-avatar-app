import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function useSubscriptionCheck() {
  const navigate = useNavigate();
  const { user, token, logout, refreshUser } = useAuth();

  // ⚡ Reakcija na lokalno stanje korisnika
  useEffect(() => {
    if (user?.monthlyPaidMinutes === 0) {
      navigate("/upgrade");
    }
  }, [user?.monthlyPaidMinutes]);

  // 🔁 Proverava svakih 60 sekundi i osvežava korisnika
  useEffect(() => {
    if (!token || !refreshUser) return;

    const checkSubscription = async () => {
      try {
        const freshUser = await refreshUser();
        if (freshUser?.monthlyPaidMinutes === 0) {
          navigate("/upgrade");
        }
      } catch (err) {
        // ⛔ Ako token nije validan (npr. 401), izloguj korisnika
        if (err.status === 401 || err.status === 403) {
          console.warn("Token više nije validan. Logout...");
          logout?.();
          navigate("/login");
        } else {
          console.error("❌ Subscription check error:", err);
        }
      }
    };

    checkSubscription(); // Odmah na mount
    const interval = setInterval(checkSubscription, 60000); // Svakih 1 minut
    return () => clearInterval(interval);
  }, [token, refreshUser, logout, navigate]);
}