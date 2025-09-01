import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Globe } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <nav className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-purple-600 text-white fixed top-5 left-1/2 transform -translate-x-1/2 w-[90%] md:w-1/3 z-50 px-6 py-3 shadow-md w-1/2 left-1/2 ">
  	<span>HOLOVISION</span>
      	<button onClick={logout}>Logout</button>
		<button
		  onClick={() => navigate("/website")}
		  className="flex items-center gap-2 text-white"
		>
		  <Globe className="w-5 h-5" />
		  <span>Go to Website</span>
		</button>
    </nav>
  );
};

export default Navbar;