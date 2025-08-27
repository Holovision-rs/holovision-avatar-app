import {
  createContext,
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  const lastRefreshRef = useRef(0);
  const isRefreshingRef = useRef(false);

  const login = (token, userData) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    navigate("/login");
  };

  const refreshUser = useCallback(async (force = false) => {
    const now = Date.now();
    const MIN_INTERVAL = 60 * 1000;

    if (!force && now - lastRefreshRef.current < MIN_INTERVAL) {
      console.log("⏳ refreshUser SKIPPED (previše često)");
      return user;
    }

    if (isRefreshingRef.current) {
      console.log("⏳ refreshUser already running, skipping");
      return user;
    }

    isRefreshingRef.current = true;

    try {
      console.log("🔄 refreshUser CALLED");

      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        console.log("❌ Failed to refresh user");
        const error = new Error("Failed to refresh user");
        error.status = res.status;
        throw error;
      }

      const updatedUser = await res.json();
      updatedUser.monthlyPaidMinutes = Math.max(updatedUser.monthlyPaidMinutes, 0);
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      
      lastRefreshRef.current = now;

      return updatedUser;
    } catch (err) {
      console.error("❌ refreshUser ERROR:", err);
      throw err;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [token]);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      login,
      logout,
      refreshUser,
    }),
    [token, user, refreshUser]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);