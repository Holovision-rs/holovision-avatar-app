import React, { useEffect, useState } from "react";
import "../styles/admin.css";

const DesktopDashboard = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("token");

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users", {
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
      <h2>Admin Dashboard</h2>
      <button
        className="logout-btn"
        onClick={() => {
          localStorage.removeItem("token");
          window.location.href = "/login";
        }}
      >
        Logout
      </button>

      <input
        type="text"
        placeholder="Search by email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {message && <p className="message">{message}</p>}
      <p>Total users: {filtered.length}</p>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Subscription</th>
            <th>Minutes Used</th>
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
              <td>{u.monthlyUsageMinutes}</td>
              <td>{u.usageMonth}</td>
              <td>
                <select
                  value={u.subscription}
                  onChange={(e) =>
                    handleSubscriptionChange(u._id, e.target.value)
                  }
                >
                  <option value="free">Free</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                </select>
              </td>
              <td>
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(u._id)}
                >
                  X
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DesktopDashboard;
