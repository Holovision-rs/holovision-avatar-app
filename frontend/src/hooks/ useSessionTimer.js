import { useEffect } from "react";

export const useSessionTimer = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return;

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

    const handleBeforeUnload = () => {
      const tabCount = decrementTabCount();

      // Samo poslednji tab šalje trajanje
      if (tabCount === 0) {
        const durationInSeconds = Math.floor((Date.now() - startTime) / 1000);

        // Spreči dupli slanje u slučaju race condition
        const lastSent = localStorage.getItem(LAST_SESSION_KEY);
        const now = Date.now();
        if (!lastSent || now - parseInt(lastSent, 10) > 2000) {
          localStorage.setItem(LAST_SESSION_KEY, now.toString());

          const payload = JSON.stringify({ durationInSeconds });
          const blob = new Blob([payload], { type: "application/json" });

          navigator.sendBeacon("/api/session-end", blob);
        }
      }
    };

    incrementTabCount();
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      handleBeforeUnload();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled]);
};