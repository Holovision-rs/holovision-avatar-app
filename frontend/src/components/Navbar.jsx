import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <nav className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-purple-600 text-white fixed top-5 left-1/2 transform -translate-x-1/2 w-[90%] md:w-1/3 z-50 px-6 py-3 shadow-md w-1/2 left-1/2 ">
  	<span>HOLOVISION</span>
      	<button onClick={logout}>Logout</button>
      	<button
        onClick={() => navigate("/website")}
        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
      >
        go to Website
      </button>
    </nav>
  );
};

export default Navbar;