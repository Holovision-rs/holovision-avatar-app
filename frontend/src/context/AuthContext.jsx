import { createContext, useState, useEffect, useContext, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();

  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  const lastRefreshRef = useRef(0); // 🕒 Čuva vreme poslednjeg refresh-a

  // 🔐 Login
  const login = (newToken, userData) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    lastRefreshRef.current = 0; // resetuj vreme osvežavanja
  };

  // 🔓 Logout
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    navigate("/login");
  };

  // 🔄 Refresh user, sa kontrolom frekvencije i opcijom forsiranja
  const refreshUser = useCallback(async (force = false) => {
    const now = Date.now();
    const MIN_INTERVAL = 60 * 1000; // 60 sekundi

    if (!force && now - lastRefreshRef.current < MIN_INTERVAL) {
      console.log("⏳ refreshUser SKIPPED (previše često)");
      return user;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.log("❌ Failed to refresh user");
        const error = new Error("Failed to refresh user");
        error.status = res.status;
        throw error;
      }

      console.log("🔄 refreshUser CALLED");
      const updatedUser = await res.json();
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      lastRefreshRef.current = now;
      return updatedUser;

    } catch (err) {
      throw err;
    }
  }, [token, user]);

  // ♻️ Prilikom mountovanja
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      lastRefreshRef.current = 0; // resetujemo refresh timer pri reloadu
    }
  }, [token]);

  // 📦 Sve vrednosti za kontekst
  const value = useMemo(() => ({
    token,
    user,
    login,
    logout,
    refreshUser,
  }), [token, user, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ✅ Hook za korišćenje auth konteksta
export const useAuth = () => useContext(AuthContext);