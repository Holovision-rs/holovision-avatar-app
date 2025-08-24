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
      console.log('proba useAdminUser.js');
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

  // 🔁 Handle subscription
  const handleSubscriptionChange = async (userId, newSub) => {
    const res = await fetch(`${BACKEND_URL}/api/admin/users/${userId}/subscription`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subscription: newSub }),
    });

    if (res.ok) {
      fetchUsers();
    } else {
      alert("Failed to update subscription");
    }
  };

  // 🕓 Dodaj potrošene minute (usage)
  const handleAddMinutes = async (userId, minutes) => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/users/${userId}/add-minutes`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ minutes })
    });

    if (res.ok) {
      fetchUsers();
    } else {
      const error = await res.json();
      alert("Failed to add minutes: " + (error.message || "Unknown error"));
    }
  } catch (err) {
    alert("Error adding minutes: " + err.message);
  }
};

  // 💳 Dodaj plaćene minute (paid)
  const handleAddPaidMinutes = async (userId, paidMinutes) => {
    const res = await fetch(`${BACKEND_URL}/api/admin/users/${userId}/add-paid`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ paidMinutes })
    });

    if (res.ok) {
      fetchUsers();
    } else {
      alert("Failed to add paid minutes");
    }
  };

  // ❌ Brisanje korisnika
  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure?")) return;

    const res = await fetch(`${BACKEND_URL}/api/admin/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      setUsers(users.filter((u) => u._id !== userId));
    } else {
      alert("Failed to delete user");
    }
  };

  return {
    users,
    setUsers,
    message,
    loading,
    fetchUsers,
    handleDelete,
    handleAddMinutes,
    handleAddPaidMinutes,
    handleSubscriptionChange,
  };
};