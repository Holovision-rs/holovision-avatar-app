import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";

export const useSessionTimer = (enabled = true) => {
  const { token, isAuthenticated } = useAuth();
  const minutesSentRef = useRef(0);

  useEffect(() => {
    if (!enabled || !isAuthenticated || !token) return;

    const SESSION_KEY = "holovision-active-tabs";
    const LAST_SESSION_KEY = "holovision-last-sent";
    const startTime = Date.now();

    const getTabCount = () => parseInt(localStorage.getItem(SESSION_KEY) || "0", 10);
    const setTabCount = (val) => localStorage.setItem(SESSION_KEY, val.toString());

    const incrementTabCount = () => setTabCount(getTabCount() + 1);
    const decrementTabCount = () => {
      const newCount = Math.max(getTabCount() - 1, 0);
      setTabCount(newCount);
      return newCount;
    };

    const sendUsage = async (minutes) => {
      const payload = JSON.stringify({
        timestamp: new Date().toISOString(),
        minutes,
      });

      try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/me/usage-log`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: payload,
        });

        if (!res.ok) {
          console.warn("⚠️ fetch nije uspeo, pokušavam sendBeacon...");
          navigator.sendBeacon(
            `${import.meta.env.VITE_BACKEND_URL}/api/users/me/usage-log`,
            new Blob([payload], { type: "application/json" })
          );
        }
      } catch (err) {
        console.error("❌ Greška pri slanju usage log (fetch):", err);
      }
    };

    const interval = setInterval(() => {
      const now = Date.now();
      const totalMinutes = Math.floor((now - startTime) / 60000);
      const newMinutes = totalMinutes - minutesSentRef.current;

      if (newMinutes > 0) {
        minutesSentRef.current += newMinutes;
        sendUsage(newMinutes);
      }
    }, 60000);

    const handleBeforeUnload = () => {
      const tabCount = decrementTabCount();
      if (tabCount === 0 && token) {
        const now = Date.now();
        const totalMinutes = Math.floor((now - startTime) / 60000);
        const newMinutes = totalMinutes - minutesSentRef.current;

        if (newMinutes > 0) {
          const payload = JSON.stringify({
            timestamp: new Date().toISOString(),
            minutes: newMinutes,
          });

          navigator.sendBeacon(
            `${import.meta.env.VITE_BACKEND_URL}/api/users/me/usage-log`,
            new Blob([payload], { type: "application/json" })
          );
          localStorage.setItem(LAST_SESSION_KEY, now.toString());
        }
      }
    };

    incrementTabCount();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      handleBeforeUnload();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, isAuthenticated, token]);
};