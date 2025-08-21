import React, { useEffect, useState } from "react";

const AdminPanel = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        alert("Access denied");
      }
    };

    fetchUsers();
  }, []);

  return (
    <div>
      <h2>Admin Panel</h2>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Subscription</th>
            <th>Minutes Used</th>
            <th>Month</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id}>
              <td>{u.email}</td>
              <td>{u.subscription}</td>
              <td>{u.monthlyUsageMinutes}</td>
              <td>{u.usageMonth}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminPanel;