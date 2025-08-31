// src/components/MobileAccountView.jsx
import React from 'react';

const MobileAccountView = ({ user }) => {
  return (
    <div style={{ padding: '1rem' }}>
      <h2>👤 Welcome, {user.name || user.email}</h2>
      <p>📱 This is your mobile account view.</p>
      {/* Dodaj više mobilnih sekcija ovde po potrebi */}
    </div>
  );
};

export default MobileAccountView;