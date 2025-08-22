import React, { useEffect, useState } from "react";
import "../styles/admin.css";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://holovision-avatar-app.onrender.com";

const DesktopDashboard = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

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
      }
    } catch (err) {
      setMessage("Failed to fetch users");
    }
  };

  useEffect(() => {
    if (token) fetchUsers();
  }, []);

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure?")) return;

    const res = await fetch(`/api/admin/users/${userId}`, {
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
    const res = await fetch(`/api/admin/users/${userId}/subscription`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subscription: newSub }),
    });

    if (res.ok) {
      fetchUsers(); // reload
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
        <h2>HOLOVISION</h2>
        <ul>
          <li className="active">Dashboard</li>
          <li>Users</li>
          <li>Usage</li>
          <li>Settings</li>
        </ul>
        <button className="logout-btn">Logout</button>
      </div>
      <div className="dashboard-content">
        <div className="card">
          <div className="card-title">Total Users</div>
          <div className="card-value">123</div>
        </div>
        <div className="card">
          <div className="card-title">Total Minutes</div>
          <div className="card-value">458</div>
        </div>
        <table className="user-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Subscription</th>
              <th>Usage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>admin@holovision.rs</td>
              <td>Gold</td>
              <td>43 min</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};


export default DesktopDashboard;
