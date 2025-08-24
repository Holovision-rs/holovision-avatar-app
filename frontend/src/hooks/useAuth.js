import { useMemo } from "react";

// Pomoćna funkcija za dekodiranje JWT
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch (err) {
    console.error("Greška pri dekodiranju tokena:", err);
    return null;
  }
}

export default function useAuth() {
  const token = useMemo(() => localStorage.getItem("token"), []);

  const user = useMemo(() => {
    return token ? decodeToken(token) : null;
  }, [token]);

  const isAuthenticated = !!token;

  const logout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login"; // ili "/"
  };

  return {
    token,
    user,
    isAuthenticated,
    logout,
  };
}