import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/admin.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://holovision-avatar-app.onrender.com";

const MobileDashboard = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        const err = await res.json();
        setMessage(err.message || "Access denied");
        setTimeout(() => navigate("/login"), 2000);
      }
    } catch (err) {
      setMessage("Failed to fetch users");
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

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="admin-container">
      <div className="sidebar">
        <div className="logo">HOLOVISION</div>
        <ul>
          <li className="active">Dashboard</li>
          <li>Users</li>
          <li>Usage</li>
          <li>Settings</li>
        </ul>
        <button
          onClick={() => {
            localStorage.removeItem("token");
            navigate("/login");
          }}
          className="logout-btn"
        >
          Logout
        </button>
      </div>

      <div className="dashboard-content">
        <h2>Admin Panel (Mobile)</h2>

        <input
          type="text"
          placeholder="Search by email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-search"
        />

        {message && <p className="admin-message">{message}</p>}
        <p>Total users: {filtered.length}</p>

        <div className="mobile-users-list">
          {filtered.map((u) => (
            <div key={u._id} className="mobile-user-card">
              <p><strong>Email:</strong> {u.email}</p>
              <p><strong>Subscription:</strong> {u.subscription}</p>
              <p><strong>Used:</strong> {u.monthlyUsageMinutes} min</p>
              <p><strong>Month:</strong> {u.usageMonth}</p>
              <select
                value={u.subscription}
                onChange={(e) => handleSubscriptionChange(u._id, e.target.value)}
                className="subscription-select"
              >
                <option value="free">Free</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
              </select>
              <button onClick={() => handleDelete(u._id)} className="delete-button">
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MobileDashboard;