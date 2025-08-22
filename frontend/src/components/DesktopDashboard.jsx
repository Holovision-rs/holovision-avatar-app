// src/components/DesktopDashboard.jsx
import React, { useEffect, useState } from "react";
import DonutChartWithLabels from "./DonutChartWithLabels";
import "../styles/admin.css";
import {
  PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://holovision-avatar-app.onrender.com";
const COLORS = ["#3baedb", "#876efe", "#614bde"];

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

  const totalMinutes = users.reduce((acc, u) => acc + (u.monthlyUsageMinutes || 0), 0);
  const usageDonut = [
    { name: "Used", value: totalMinutes },
    { name: "Remaining", value: Math.max(10000 - totalMinutes, 0) }
  ];
  const subsData = ["free", "silver", "gold"].map((sub) => ({
    name: sub.charAt(0).toUpperCase() + sub.slice(1),
    value: users.filter((u) => u.subscription === sub).length
  }));

  const usageChartData = users.map((u) => ({
    name: u.email,
    minutes: u.monthlyUsageMinutes || 0
  }));

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <h2 className="logo">HOLOVISION</h2>
        <nav>
          <ul>
            <li className="active">Dashboard</li>
            <li>Users</li>
            <li>Usage</li>
            <li>Settings</li>
          </ul>
        </nav>
        <button
          className="logout-btn"
          onClick={() => {
            localStorage.removeItem("token");
            window.location.href = "/login";
          }}
        >
          Logout
        </button>
      </aside>

      <main className="dashboard-content">
        <h1>Admin Dashboard</h1>

        <div className="top-charts">
          <div className="chart-wrapper">
            <h3>Subscriptions</h3>
            <DonutChartWithLabels data={subsData} />
          </div>

          <div className="chart-wrapper">
            <h3>Quota</h3>
            <DonutChartWithLabels data={usageDonut} />
          </div>

          <div className="chart-wrapper">
            <h3>Usage per User</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={usageChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="minutes" stroke="#614bde" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="cards">
          <div className="card">
            <h3>Total Users</h3>
            <p>{users.length}</p>
          </div>
          <div className="card">
            <h3>Total Minutes Used</h3>
            <p>{totalMinutes}</p>
          </div>
        </div>

        <input
          className="search-input"
          placeholder="Search users by email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {message && <p className="message">{message}</p>}

        <table className="user-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Subscription</th>
              <th>Minutes</th>
              <th>Month</th>
              <th>Change</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u._id}>
                <td>{u.email}</td>
                <td>{u.subscription}</td>
                <td>{u.monthlyUsageMinutes || 0}</td>
                <td>{u.usageMonth}</td>
                <td>
                  <select
                    value={u.subscription}
                    onChange={(e) => handleSubscriptionChange(u._id, e.target.value)}
                    className="subscription-select"
                  >
                    <option value="free">Free</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                  </select>
                </td>
                <td>
                  <button onClick={() => handleDelete(u._id)} className="delete-btn">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
};

export default DesktopDashboard;