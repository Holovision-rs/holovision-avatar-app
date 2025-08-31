import React from "react";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  return (
    <nav className="fixed top-0 left-1/2 transform -translate-x-1/2 w-fit z-50 bg-black px-6 py-3 rounded-lg shadow-md">
      <span>{user?.name}</span>
      <button onClick={logout}>Logout</button>
    </nav>
  );
};

export default Navbar;