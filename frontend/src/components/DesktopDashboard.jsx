// src/components/DesktopDashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DonutChartWithLabels from "./DonutChartWithLabels";
import "../styles/admin.css";
import {
  PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useAdminUsers } from "../hooks/useAdminUsers";

const {
  users,
  setUsers,
  message,
  fetchUsers,
  handleDelete,
  handleAddMinutes,
  handleAddPaidMinutes,
  handleSubscriptionChange
} = useAdminUsers();

const navigate = useNavigate();
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://holovision-avatar-app.onrender.com";
const COLORS = ["#3baedb", "#876efe", "#614bde"];

const DesktopDashboard = () => {

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const token = localStorage.getItem("token");
  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalMinutes = users.reduce((acc, u) => acc + (u.monthlyUsageMinutes || 0), 0);
  const totalQuota = users.reduce((acc, u) => {
      if (u.subscription === "silver") return acc + 300;
      if (u.subscription === "gold") return acc + 1500;
      return acc; // free korisnici nemaju dodatnu kvotu
    }, 0);

  const usageDonut = [
      { name: "Used", value: totalMinutes },
      { name: "Remaining", value: Math.max(totalQuota - totalMinutes, 0) }
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
            <h3>Total Minutes Paid</h3>
            <p>{totalQuota}</p>
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
            <th>Used</th>
            <th>Paid</th>
            <th>Month</th>
            <th>Add Used</th>
            <th>Add Paid</th>
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
                <td>{u.monthlyPaidMinutes || 0}</td>
                <td>{u.usageMonth}</td>

                {/* Add Used Minutes */}
                <td>
                  <input
                    type="number"
                    min="1"
                    style={{ width: "60px" }}
                    placeholder="min"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const minutes = parseInt(e.target.value, 10);
                        if (!isNaN(minutes)) {
                          handleAddMinutes(u._id, minutes);
                          e.target.value = "";
                        }
                      }
                    }}
                  />
                </td>

                {/* Add Paid Minutes */}
                <td>
                  <input
                    type="number"
                    min="1"
                    style={{ width: "60px" }}
                    placeholder="min"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const minutes = parseInt(e.target.value, 10);
                        if (!isNaN(minutes)) {
                          handleAddPaidMinutes(u._id, minutes);
                          e.target.value = "";
                        }
                      }
                    }}
                  />
                </td>

                {/* Subscription Change */}
                <td>
                <select
                    value={u.subscription}
                    onChange={(e) => handleSubscriptionChange(u._id, e.target.value)}
                    className="px-2 py-1 rounded-md border border-gray-300 bg-white text-black text-sm"
                  >
                    <option value="free">Free</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                </select>
                </td>

                {/* Delete Button */}
                <td>
                  <button
                    onClick={() => handleDelete(u._id)}
                    style={{ backgroundColor: "red", color: "white", border: "none", padding: "4px 8px", cursor: "pointer" }}
                  >
                    X
                  </button>
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