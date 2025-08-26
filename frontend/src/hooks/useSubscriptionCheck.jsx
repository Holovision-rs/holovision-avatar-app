import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; 


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
        if (res.status === 401) {
          logout(); 
          navigate("/login");
          return;
        }
        if (!res.ok) throw new Error("Greška pri proveri pretplate");

        const user = await res.json();
        if (user.monthlyPaidMinutes === 0) {
          navigate("/upgrade");
        }
      } catch (err) {
        console.error("Subscription check error:", err);
      }
    };

    checkSubscription();

    const interval = setInterval(checkSubscription, 30000); 
    return () => clearInterval(interval);
  }, []);
}