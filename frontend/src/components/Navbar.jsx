import React from "react";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-black bg-opacity-80 shadow-md">
      <span>{user?.name}</span>
      <button onClick={logout}>Logout</button>
    </nav>
  );
};

export default Navbar;