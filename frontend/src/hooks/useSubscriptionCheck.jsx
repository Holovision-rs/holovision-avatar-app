import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function useSubscriptionCheck() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  const { token, logout, refreshUser } = useAuth();
  const intervalRef = useRef(null);

    useEffect(() => {
      if (!token || !refreshUser ) return;

      const checkSubscription = async () => {
        const freshUser = await refreshUser();
        

        if (freshUser?.monthlyPaidMinutes === 0 && location.pathname !== "/upgrade") {
          navigate("/upgrade");
        }
      };

      checkSubscription(); // odmah

      const intervalId = setInterval(() => {
        console.log("⏱️ Running subscription check...");
        checkSubscription();
      }, 60000);

      .current = true;

      return () => clearInterval(intervalId);
    }, [token, refreshUser, logout, navigate]);
}