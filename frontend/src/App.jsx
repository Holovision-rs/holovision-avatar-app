// App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import LoginRegister from "./pages/LoginRegister";
import { useMediaQuery } from "react-responsive";
import MobileDashboard from "./components/MobileDashboard";
import DesktopDashboard from "./components/DesktopDashboard";
import ProtectedRoute from "./components/ProtectedRoute"; // ⬅️ dodato
import { AuthProvider } from "./context/AuthContext";

const App = () => {
  const isMobile = useMediaQuery({ maxWidth: 767 });

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginRegister />} />
          <Route
            path="/admin"
            element={<ProtectedRoute adminOnly>{isMobile ? <MobileDashboard /> : <DesktopDashboard />}</ProtectedRoute>}
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;