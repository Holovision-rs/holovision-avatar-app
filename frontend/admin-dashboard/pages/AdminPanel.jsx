import { useEffect, useState } from "react";
import UserTable from "../components/UserTable";

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [token, setToken] = useState(""); // admin JWT token

  useEffect(() => {
    const fetchUsers = async () => {
      const res = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      setUsers(data);
    };

    if (token) fetchUsers();
  }, [token]);

  return (
    <div>
      <input
        type="text"
        className="border p-2 mb-4 w-full"
        placeholder="Enter admin token"
        onChange={(e) => setToken(e.target.value)}
      />
      <UserTable users={users} />
    </div>
  );
};

export default AdminPanel;