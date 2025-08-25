import { useEffect } from "react";

export const useSessionTimer = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return;

    const SESSION_KEY = "holovision-active-tabs";
    const startTime = Date.now();

    const incrementTabCount = () => {
      const count = parseInt(localStorage.getItem(SESSION_KEY) || "0", 10);
      localStorage.setItem(SESSION_KEY, count + 1);
    };

    const decrementTabCount = () => {
      const count = parseInt(localStorage.getItem(SESSION_KEY) || "1", 10);
      const newCount = Math.max(count - 1, 0);
      localStorage.setItem(SESSION_KEY, newCount);
      return newCount;
    };

    const handleBeforeUnload = () => {
      const tabCount = decrementTabCount();

      // ⚠️ Samo ako je ovo poslednji tab
      if (tabCount === 0) {
        const durationInSeconds = Math.floor((Date.now() - startTime) / 1000);

        const payload = JSON.stringify({ durationInSeconds });

        navigator.sendBeacon(
          "/api/session-end",
          new Blob([payload], { type: "application/json" })
        );
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