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
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="avatar" />
          <h2>Gelap</h2>
        </div>
        <nav className="nav-links">
          <a className="active">Dashboard</a>
          <a>Tasks</a>
          <a>Messages</a>
          <a>Team</a>
          <a>Help</a>
          <a>Settings</a>
          <a>Log out</a>
        </nav>
        <div className="upgrade-box">
          <p>Want More Tools?</p>
          <button>Upgrade to Pro</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="dashboard-header">
          <input type="text" placeholder="Search..." />
          <div className="header-icons">
            <span>🔔</span>
            <span>👤</span>
          </div>
        </header>

        <section className="dashboard-metrics">
          <div className="revenue-box">
            <h3>Revenue</h3>
            <p className="value">$37,100.18 <span className="positive">+12%</span></p>
            <div className="line-chart-placeholder">Line Chart</div>
          </div>
          <div className="mobile-session-box">
            <h3>Mobile Session</h3>
            <div className="pie-chart-placeholder">Pie Chart</div>
          </div>
        </section>

        <section className="user-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>Email</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Rafidya</td><td>18</td><td>rafidya@example.com</td><td>18, June 2023</td><td>Done</td>
              </tr>
              <tr>
                <td>Imam</td><td>17</td><td>imam@example.com</td><td>18, June 2023</td><td>Failed</td>
              </tr>
              <tr>
                <td>Tengku</td><td>21</td><td>tengku@example.com</td><td>18, June 2023</td><td>Done</td>
              </tr>
              <tr>
                <td>Deru</td><td>10</td><td>deru@example.com</td><td>18, June 2023</td><td>Done</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="activity-boxes">
          <div className="activity-box">
            <h4>Total Customers</h4>
            <p className="value">12,132</p>
            <span className="positive">+12% from last month</span>
          </div>
          <div className="activity-box">
            <h4>Total Customers</h4>
            <p className="value">12,132</p>
            <span className="positive">+12% from last month</span>
          </div>
          <div className="activity-log">
            <h4>Activity Log</h4>
            <ul>
              <li><strong>Cody Fisher</strong> deleted 2 items • Just now</li>
              <li><strong>Eleanor Pena</strong> deleted 2 items • 12 mins ago</li>
              <li><strong>Cameron Williamson</strong> deleted 2 items • 19 mins ago</li>
              <li><strong>Esther Howard</strong> deleted 2 items • 51 mins ago</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
};

export default DesktopDashboard;
