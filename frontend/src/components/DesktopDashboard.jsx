import React, { useState } from "react";
import DonutChartWithLabels, {
  renderDonutLabel,
  renderQuotaLabel,
} from "./DonutChartWithLabels";
import "../styles/admin.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
} from "recharts";
import { useAdminUsers } from "../hooks/useAdminUsers";

const COLORS = ["#ef00ff", "#876efe", "#00fffd"];

const DesktopDashboard = () => {
  const {
    users,
    message,
    fetchUsers,
    handleDelete,
    handleAddMinutes,
    handleAddPaidMinutes,
    handleSubscriptionChange,
  } = useAdminUsers();

  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalMinutes = users.reduce(
    (acc, u) => acc + (u.monthlyUsageMinutes || 0),
    0
  );

  const totalQuota = users.reduce((acc, u) => {
    if (u.subscription === "silver") return acc + 300;
    if (u.subscription === "gold") return acc + 1500;
    return acc;
  }, 0);

  const usageDonut = [
    { name: "Used", value: totalMinutes },
    { name: "Remaining", value: Math.max(totalQuota - totalMinutes, 0) },
  ];

  const subsData = ["free", "silver", "gold"].map((sub) => ({
    name: sub.charAt(0).toUpperCase() + sub.slice(1),
    value: users.filter((u) => u.subscription === sub).length,
  }));

  const usageChartData = users.map((u) => ({
    name: u.email,
    minutes: u.monthlyUsageMinutes || 0,
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
            <DonutChartWithLabels
              data={subsData}
              labelRenderer={renderDonutLabel}
            />
          </div>

          <div className="chart-wrapper">
            <h3>Quota</h3>
            <DonutChartWithLabels
              data={usageDonut}
              labelRenderer={renderQuotaLabel}
              customLegend={[
                { name: "Remaining", color: COLORS[1] },
                { name: "Used", color: COLORS[0] },
              ]}
            />
          </div>

          <div className="chart-wrapper">
            <h3>Usage per User</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={usageChartData}>
                <defs>
                  <linearGradient
                    id="lineGradient"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0"
                  >
                    <stop offset="0%" stopColor="#fc00ff" />
                    <stop offset="100%" stopColor="#00dbde" />
                  </linearGradient>
                  <linearGradient
                    id="areaGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#fc00ff" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#1b1b1b" stopOpacity={0} />
                  </linearGradient>
                  <filter
                    id="glow"
                    x="-50%"
                    y="-50%"
                    width="200%"
                    height="200%"
                  >
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#aaa" />
                <YAxis stroke="#aaa" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1b1b1b",
                    border: "none",
                    borderRadius: "4px",
                    boxShadow: "0 0 8px #751ae07d",
                    color: "#fff",
                  }}
                  labelStyle={{ color: "#fff" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="minutes"
                  fill="url(#areaGradient)"
                  stroke="none"
                />
                <Line
                  type="monotone"
                  dataKey="minutes"
                  stroke="url(#lineGradient)"
                  strokeWidth={3}
                  dot={{
                    r: 6,
                    stroke: "#fff",
                    strokeWidth: 2,
                    fill: "#1b1b1b",
                    filter: "url(#glow)",
                  }}
                  isAnimationActive={false}
                />
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

        <div className="table-and-sidebar relative flex flex-col md:flex-row gap-4 md:pr-80">
          <div style={{ flex: 1 }}>
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
                  <tr
                    key={u._id}
                    onClick={() => setSelectedUser(u)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{u.email}</td>
                    <td>{u.subscription}</td>
                    <td>{u.monthlyUsageMinutes || 0}</td>
                    <td>{u.monthlyPaidMinutes || 0}</td>
                    <td>{u.usageMonth}</td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        placeholder="min"
                        className="w-[60px] px-2 py-1 rounded-md border border-gray-300 text-black bg-white"
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
                    <td>
                      <input
                        type="number"
                        min="1"
                        placeholder="min"
                        className="w-[60px] px-2 py-1 rounded-md border border-gray-300 text-black bg-white"
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
                    <td>
                      <select
                        value={u.subscription}
                        onChange={(e) =>
                          handleSubscriptionChange(u._id, e.target.value)
                        }
                        className="px-2 py-1 rounded-md border border-gray-300 bg-white text-black text-sm"
                      >
                        <option value="free">Free</option>
                        <option value="silver">Silver</option>
                        <option value="gold">Gold</option>
                      </select>
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(u._id)}
                        style={{
                          borderRadius: "2px",
                          backgroundColor: "#751ae0",
                          color: "white",
                          border: "none",
                          padding: "4px 8px",
                          cursor: "pointer",
                        }}
                      >
                        X
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedUser && (
            <div className="bg-[#1c1c2b] text-white rounded-xl p-4 shadow-lg w-full md:w-80 mt-4 md:mt-0 md:absolute md:top-0 md:right-0 z-20">
              <h3 className="text-lg font-semibold text-purple-400 mb-3">
                User Detail
              </h3>
              <p>
                <span className="font-semibold">Email:</span> {selectedUser.email}
              </p>
              <p>
                <span className="font-semibold">Subscription:</span> {selectedUser.subscription}
              </p>
              <p>
                <span className="font-semibold">Used:</span> {selectedUser.monthlyUsageMinutes || 0} min
              </p>
              <p>
                <span className="font-semibold">Paid:</span> {selectedUser.monthlyPaidMinutes || 0} min
              </p>
              <p>
                <span className="font-semibold">Month:</span> {selectedUser.usageMonth}
              </p>
              <button
                onClick={() => setSelectedUser(null)}
                className="mt-4 bg-purple-600 hover:bg-purple-700 text-white py-1 px-3 rounded"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DesktopDashboard;