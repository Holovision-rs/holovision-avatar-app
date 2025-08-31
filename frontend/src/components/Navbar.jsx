import React from "react";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  return (
    <nav className="bg-gradient-to-r from-blue-600 to-purple-600 text-white fixed top-10 left-1/2 transform -translate-x-1/2 w-fit md:w-1/3 z-50 bg-black px-6 py-3  shadow-md  w-1/2 top-0 left-1/2 ">
      <span>{user?.name}</span>
      <button onClick={logout}>Logout</button>
    </nav>
  );
};

export default Navbar;