import { useEffect, useRef } from "react";

export function useSessionTimer({ enabled }) {
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    // Zabeleži početak
    startTimeRef.current = Date.now();

    return () => {
      if (!startTimeRef.current) return;

      const endTime = Date.now();
      const durationInSeconds = Math.round((endTime - startTimeRef.current) / 1000);

      // Automatski pošalji trajanje sesije
      const token = localStorage.getItem("token");
      fetch("/api/session-end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ durationInSeconds }),
      })
        .then((res) => res.json())
        .then((data) => console.log("📤 Sent session duration:", data))
        .catch((err) => console.error("❌ Error sending session duration:", err));
    };
  }, [enabled]);
}