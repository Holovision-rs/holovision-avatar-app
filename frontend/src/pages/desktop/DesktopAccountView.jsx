// src/components/DesktopAccountView.jsx
import React from 'react';

const DesktopAccountView = ({ user }) => {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>👤 Welcome, {user.name || user.email}</h1>
      <p>🖥️ This is your desktop account view.</p>
      {/* Dodaj detaljnije informacije ili grafike za desktop */}
    </div>
  );
};

export default DesktopAccountView;