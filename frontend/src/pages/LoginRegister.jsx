import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://holovision-avatar-app.onrender.com";

const LoginRegister = () => {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

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

      // Fetch user data
      const meRes = await fetch(`${BACKEND_URL}/api/me`, {
        headers: {
          Authorization: `Bearer ${data.token}`,
        },
      });

      const user = await meRes.json();
      if (!meRes.ok) throw new Error(user.message || "Failed to fetch user");

      console.log("🧪 User object:", user);

      // ✅ Login & save to context + localStorage
   login(data.token, user);

      // 🔁 Redirect
      navigate(user.isAdmin ? "/admin" : "/");

    } catch (err) {
      setMessage(`❌ ${err.message}`);
      console.error("⚠️ Error:", err.message);
    }
  };

  return (
    <div style={styles.container}>
      <h2>{isLogin ? "Login" : "Register"}</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />
        <input
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
        />
        <button type="submit" style={styles.button}>
          {isLogin ? "Login" : "Register"}
        </button>
      </form>
      <p style={{ marginTop: 10 }}>
        {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
        <button onClick={() => setIsLogin(!isLogin)} style={styles.link}>
          {isLogin ? "Register" : "Login"}
        </button>
      </p>
      {message && <p>{message}</p>}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: "300px",
    margin: "100px auto",
    padding: "20px",
    border: "1px solid #ccc",
    borderRadius: "10px",
    textAlign: "center",
    fontFamily: "sans-serif",
    backgroundColor: "#f9f9f9",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  input: {
    padding: "8px",
    fontSize: "14px",
  },
  button: {
    padding: "10px",
    backgroundColor: "#007bff",
    color: "#fff",
    fontWeight: "bold",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  link: {
    background: "none",
    border: "none",
    color: "#007bff",
    cursor: "pointer",
    textDecoration: "underline",
    fontSize: "14px",
  },
};

export default LoginRegister;