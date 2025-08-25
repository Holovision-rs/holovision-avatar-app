import { useEffect, useRef } from "react";

export const useSessionTimer = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return;

    const startTime = Date.now();

    const handleBeforeUnload = () => {
      const durationInSeconds = Math.floor((Date.now() - startTime) / 1000);

      const payload = JSON.stringify({ durationInSeconds });

      navigator.sendBeacon(
        "/api/session-end",
        new Blob([payload], { type: "application/json" })
      );
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      handleBeforeUnload(); // fallback ako komponenta bude unmountovana
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled]);
};