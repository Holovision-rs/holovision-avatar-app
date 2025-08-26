// components/Navbar.jsx
import React from "react";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <nav style={styles.nav}>
      <span style={styles.email}>👤 {user?.email}</span>
      <button onClick={logout} style={styles.button}>
        Logout
      </button>
    </nav>
  );
};

const styles = {
  nav: {
    position: "absolute",
    top: 0,
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 20px",
    backgroundColor: "rgba(0,0,0,0.6)",
    color: "#fff",
    zIndex: 1000,
  },
  email: {
    fontWeight: "bold",
  },
  button: {
    background: "#ff4d4d",
    border: "none",
    color: "#fff",
    padding: "5px 10px",
    borderRadius: "4px",
    cursor: "pointer",
  },
};

export default Navbar;