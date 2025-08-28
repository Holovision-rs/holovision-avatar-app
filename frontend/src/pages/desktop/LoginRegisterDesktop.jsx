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
      className="w-screen h-screen bg-no-repeat bg-cover bg-center flex items-center justify-between px-6 p-left-15"
      style={{ backgroundImage: "url('/background.png')" }} // koristi pravo ime slike
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
            <p className="text-center text-sm text-white"> 
            Enter your details to sign in to your avatar account.
            </p>
          {message && (
            <p className="text-red-500 text-sm text-center">{message}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Enter your email address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-transparent border border-purple-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>

            <div>
              <input
                type="password"
                placeholder="Enter your password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-transparent border border-purple-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3  bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition duration-300"
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
      <div className="hidden md:flex flex-col justify-end items-center h-full right-20">
        <img
          src="/robot.png" // koristi tačan path
          alt="Futuristic Robot"
          className="max-h-[90%] object-contain"
        />
          <h1 className="absolute text-white font-bold text-6xl top-60 left-60">
              Welcome.
          </h1>
          <p className="absolute text-white font-bold top-60 left-60">Join the Holovision community.</p>
      </div>
    </div>
  );
};

export default LoginRegister;