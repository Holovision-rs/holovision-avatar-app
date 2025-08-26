import React from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const LogoutButton = () => {
  const { logout } = useAuth();

  return (
    <button
      onClick={logout}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      title="Logout"
    >
      <LogOut color="white" size={24} />
    </button>
  );
};

export default LogoutButton;