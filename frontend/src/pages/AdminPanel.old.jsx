import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAdminGuard from "../hooks/useAdminGuard";
import "../styles/admin.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const AdminPanel = () => {
  console.log("🧩 AdminPanel komponenta učitana");

  
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
      fetchUsers(); // reload
    } else {
      alert("Failed to add paid minutes");
    }
  };
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
        fetchUsers(); // Reload
      } else {
        alert("Failed to add minutes");
      }
    } catch (err) {
      alert("Error adding minutes");
    }
  };
  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={styles.container} >
      <h2>Admin Panel</h2>
      <button onClick={() => {
        localStorage.removeItem("token");
        navigate("/login");
      }} style={styles.logoutButton}>Logout</button>

      <input
        type="text"
        placeholder="Search by email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={styles.searchInput}
      />

      {message && <p style={styles.message}>{message}</p>}

      <p>Total users: {filtered.length}</p>

      <table style={styles.table}>
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
    </div>
  );
};

const styles = {
  container: {
    maxWidth: "900px",
    margin: "40px auto",
    padding: "20px",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#f2f2f2", // 👈 svetla pozadina samo za admin
    borderRadius: "8px", // opcionalno
  },
  searchInput: {
    padding: "6px",
    marginBottom: "10px",
    width: "100%",
    maxWidth: "300px",
  },
  logoutButton: {
    padding: "8px 12px",
    marginBottom: "10px",
    backgroundColor: "#444",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    borderRadius: "4px",
  },
  message: {
    color: "red",
    marginTop: 10,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  deleteButton: {
    backgroundColor: "red",
    color: "white",
    border: "none",
    padding: "4px 8px",
    cursor: "pointer",
  },
};

export default AdminPanel;