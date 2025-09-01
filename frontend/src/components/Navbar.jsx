import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Globe } from "lucide-react";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="flex items-center justify-between fixed top-5 left-1/2 transform -translate-x-1/2 w-[90%] md:w-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 shadow-md z-50 rounded-lg">
      <span className="font-semibold text-lg">HOLOVISION</span>

      <div className="flex items-center gap-4">
        <button
          onClick={logout}
          className="text-white hover:underline"
        >
          Logout
        </button>
        <button
          onClick={() => navigate("/website")}
          className="flex items-center gap-2 text-white hover:underline"
        >
          <Globe className="w-5 h-5" />
          <span>Website</span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;