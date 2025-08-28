import React from "react";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <nav style={{ display: "flex", justifyContent: "space-between", padding: "10px" }}>
      <span> {user?.name}</span>
      <span className="flex justify-center mb-4">
        <img
          src={`https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}`}
          alt="Avatar"
          className="w-20 h-20 mx-auto mb-6"
        />
      </span>
      <button onClick={logout}>Logout</button>
    </nav>
  );
};

export default Navbar;