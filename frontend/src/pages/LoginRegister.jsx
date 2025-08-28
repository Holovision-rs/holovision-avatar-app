import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
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

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://holovision-avatar-app.onrender.com";

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
      navigate(user.isAdmin ? "/admin" : "/");

    } catch (err) {
      setMessage(`❌ ${err.message}`);
      console.error("⚠️ Error:", err.message);
    }
  };

  return (
    <div className="flex items-center justify-center px-4 overflow-hidden"  style={{ height }}> 
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-[75vw] h-[100vw] max-w-[400px] max-h-[500px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4 flex flex-col justify-center"
      >

      <div className="flex justify-center mb-4">
        <img
          src={`https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}`}
          alt="Avatar"
          className="w-15 h-15 mx-auto mb-6"
        />
      </div>
        <h2 className="text-3xl font-bold text-center text-white mb-6">
          {isLogin ? (
            <span className="inline-flex items-center gap-2">
             
              Sign in
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
             
               Sign up
            </span>
          )}
        </h2>

        {message && (
          <p className="text-red-500 text-sm text-center mb-4">{message}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#121212] text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Password</label>
            <input
              type="password"
              placeholder="******"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#121212] text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 text-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition duration-300"
          >
            {isLogin ? "Sign in" : "Sign up"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-400 hover:underline transition"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default LoginRegister;