import React, { useState, useEffect } from "react";
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

  const getAvatarUrl = (user) => {
    let style = "pixel-art";
    if (user.email.toLowerCase().includes("admin")) {
      style = "croodles";
    } else if (user.subscription === "gold") {
      style = "bottts";
    } else if (user.subscription === "silver") {
      style = "adventurer";
    } else if (user.subscription === "free") {
      style = "pixel-art";
    }
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${user._id}`;
  };

  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    if (!selectedUser && users.length > 0) {
      const defaultAdmin = users.find((u) =>
        u.email.toLowerCase().includes("admin")
      );
      if (defaultAdmin) {
        setSelectedUser(defaultAdmin);
      }
    }
  }, [users, selectedUser]);

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

        <div className="flex flex-col md:flex-row gap-6 mb-8">
          {/* Leva kolona */}
          <div className="flex-1 flex flex-col gap-6">
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
                      <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#fc00ff" />
                        <stop offset="100%" stopColor="#00dbde" />
                      </linearGradient>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fc00ff" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#1b1b1b" stopOpacity={0} />
                      </linearGradient>
                      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
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
                      isAnimationActive={true}
                      animationBegin={0}
                      animationDuration={1000}
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
          </div>

          {/* Desna kolona */}
            {selectedUser && (
              <div className="w-full md:w-[320px] bg-[#1c1c2b] text-white p-4 margin-16 shadow-purple rounded-xl">
                <div className="flex flex-col items-center mb-4">
                  <img
                    src={getAvatarUrl(selectedUser)}
                    alt="Avatar"
                    className="w-16 h-16 rounded-full border border-purple-500 mb-2 bg-[#2c2c3b] p-1"
                  />
                  <h3 className="text-lg font-semibold text-purple-400">User</h3>
                </div>

                <div className="flex flex-col gap-4">
                  {/* Subscription */}
                  <div className="bg-[#2a2a3b] p-4 rounded-xl shadow-inner">
                    <p className="text-xs text-gray-400">Subscription</p>
                    <p className={`text-2xl font-bold ${
                      selectedUser.subscription === "gold"
                        ? "text-yellow-400"
                        : selectedUser.subscription === "silver"
                        ? "text-gray-300"
                        : "text-green-400"
                    }`}>{selectedUser.subscription}</p>
                  </div>

                  {/* Used minutes */}
                  <div className="bg-[#2a2a3b] p-4 rounded-xl shadow-inner">
                    <p className="text-xs text-gray-400">Used</p>
                    <p className="text-2xl font-bold text-pink-400">{selectedUser.monthlyUsageMinutes || 0} min</p>
                  </div>

                  {/* Paid minutes */}
                  <div className="bg-[#2a2a3b] p-4 rounded-xl shadow-inner">
                    <p className="text-xs text-gray-400">Paid</p>
                    <p className="text-2xl font-bold text-purple-400">{selectedUser.monthlyPaidMinutes || 0} min</p>
                  </div>

                  {/* Month */}
                  <div className="bg-[#2a2a3b] p-4 rounded-xl shadow-inner">
                    <p className="text-xs text-gray-400">Month</p>
                    <p className="text-2xl font-bold text-blue-400">{selectedUser.usageMonth}</p>
                  </div>
                </div>
              </div>
            )}
        </div>

        <div className="mt-6">
          <table className="user-table">
            <thead>
              <tr>
                <th>Avatar</th>
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
                  <td>
                    <img
                      src={getAvatarUrl(u)}
                      alt="avatar"
                      className="w-8 h-8 rounded-full border border-purple-600"
                    />
                  </td>
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
      </main>
    </div>
  );
};

export default DesktopDashboard;