import React from "react";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <nav style={{ display: "flex", justifyContent: "space-between", padding: "10px" }}>
      <span>👤 {user?.email}</span>
      <button onClick={logout}>Logout</button>
    </nav>
  );
};

export default Navbar;