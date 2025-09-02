// src/components/DesktopAccountView.jsx
import React from 'react';
import { useAuth } from "../../context/AuthContext";

const DesktopAccountView = () => {
	const { user } = useAuth();
	console.log('user', user);
	const paid = Number(user?.monthlyPaidMinutes) || 0;
    const used = Number(user?.monthlyUsageMinutes) || 0;
    const remaining = Math.max(paid - used, 0);
  return (
    <div style={{ padding: '2rem' }}>
      <h1>👤 Welcome, {user.name || user.email}</h1>
      <p>🖥️ This is your desktop account view.</p>
      {/* Dodaj detaljnije informacije ili grafike za desktop */}
    </div>
  );
};

export default DesktopAccountView;