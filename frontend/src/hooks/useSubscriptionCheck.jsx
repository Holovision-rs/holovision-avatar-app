import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function useSubscriptionCheck() {
  const navigate = useNavigate();
  const { user } = useAuth();

  
  useEffect(() => {
    if (user?.monthlyPaidMinutes === 0) {
      navigate("/upgrade");
    }
  }, [user?.monthlyPaidMinutes]);
  useEffect(() => {
    const checkSubscription = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error("Greška pri proveri pretplate");

        const user = await res.json();
        if (user.monthlyPaidMinutes === 0) {
          navigate("/upgrade");
        }
      } catch (err) {
        console.error("Subscription check error:", err);
        // po želji možeš redirectovati na /login ako je token nevalidan
      }
    };

    checkSubscription();

    const interval = setInterval(checkSubscription, 30000); // proverava svakih 30 sekundi
    return () => clearInterval(interval);
  }, []);
}