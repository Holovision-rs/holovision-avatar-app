import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ShieldCheck, ShieldPlus } from "lucide-react";
import { motion } from "framer-motion";

// ✅ Hook za dinamicku visinu
function useWindowHeight() {
  const [height, setHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return height;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const LoginRegister = () => {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const height = useWindowHeight(); 
  const [avatarSeed] = useState(() => Math.random().toString(36).substring(7));

  useEffect(() => {
    console.log("🟢 LoginRegister komponenta učitana");
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? `${BACKEND_URL}/api/login` : `${BACKEND_URL}/api/register`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const text = await response.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error("❌ Invalid response from server");
      }

      if (!response.ok) throw new Error(data.message);
      if (!data.token) throw new Error("No token received");

      const meRes = await fetch(`${BACKEND_URL}/api/me`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });

      const user = await meRes.json();

      if (!meRes.ok) throw new Error(user.message || "Failed to fetch user");

      login(data.token, user);

      const paid = Number(user?.monthlyPaidMinutes) || 0;
      const used = Number(user?.monthlyUsageMinutes) || 0;
      const remaining = paid - used;

      console.log("⏱️ Remaining minutes:", remaining);

      if (user.isAdmin) {
          navigate("/admin");
        } else if (remaining <= 0) {
          navigate("/account");
        } else {
          navigate("/");
        }

    } catch (err) {
      setMessage(`❌ ${err.message}`);
      console.error("⚠️ Error:", err.message);
    }
  };

  return (
 <div
      className="w-screen h-screen bg-no-repeat bg-cover bg-center flex items-center justify-between px-6 sm:px-12"
      style={{ backgroundImage: "url('/login-bg.png')" }} // koristi pravo ime slike
    >
      {/* Leva strana - login forma */}
      <div className="flex flex-col justify-center max-w-sm w-full space-y-6 z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full space-y-4"
        >
          <img
            src={`https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}`}
            alt="Avatar"
            className="w-20 h-20 mx-auto"
          />

          <h2 className="text-3xl font-bold text-white text-center">
            {isLogin ? "Sign in" : "Sign up"}
          </h2>

          {message && (
            <p className="text-red-500 text-sm text-center">{message}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-transparent border border-purple-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>

            <div>
              <input
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-transparent border border-purple-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 text-white font-semibold bg-pink-600 hover:bg-pink-700 rounded-md transition"
            >
              {isLogin ? "Sign in" : "Sign up"}
            </button>
          </form>

          <p className="text-center text-sm text-white">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-400 hover:underline"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </div>

      {/* Srednja vertikalna senka kao razdvajanje */}
      <div className="w-2 h-[70%] bg-gradient-to-r from-black/40 to-transparent rounded-full shadow-xl hidden md:block"></div>

      {/* Desna strana - robot ili animacija */}
      <div className="hidden md:flex flex-col justify-end items-center h-full pb-10">
        {/* Ovo može biti slika robota */}
        <img
          src="/robot.png" // koristi tačan path
          alt="Futuristic Robot"
          className="max-h-[90%] object-contain"
        />
      </div>
    </div>
  );
};

export default LoginRegister;