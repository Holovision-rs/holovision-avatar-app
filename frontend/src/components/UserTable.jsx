const UserTable = ({ users }) => {
  return (
    <table className="min-w-full bg-white shadow-md rounded">
      <thead>
        <tr>
          <th className="px-4 py-2 border">Email</th>
          <th className="px-4 py-2 border">Subscription</th>
          <th className="px-4 py-2 border">Usage (min)</th>
          <th className="px-4 py-2 border">isAdmin</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user._id}>
            <td className="px-4 py-2 border">{user.email}</td>
            <td className="px-4 py-2 border">{user.subscription}</td>
            <td className="px-4 py-2 border">{user.monthlyUsageMinutes}</td>
            <td className="px-4 py-2 border">{user.isAdmin ? "✔️" : "❌"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default UserTable;