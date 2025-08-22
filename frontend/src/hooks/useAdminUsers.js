import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export const useAdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data);
        setMessage("");
      } else {
        const err = await res.json();
        setMessage(err.message || "Access denied");
        setTimeout(() => navigate("/login"), 2000);
      }
    } catch (err) {
      setMessage("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setMessage("No token. Redirecting...");
      setTimeout(() => navigate("/login"), 2000);
    } else {
      fetchUsers();
    }
  }, []);

  return { users, setUsers, message, loading, fetchUsers };
};