// App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import LoginRegister from "./pages/LoginRegister";
import { useMediaQuery } from "react-responsive";
import MobileDashboard from "./components/MobileDashboard";
import DesktopDashboard from "./components/DesktopDashboard";
import ProtectedRoute from "./components/ProtectedRoute"; // ⬅️ dodato

const App = () => {
  const isMobile = useMediaQuery({ maxWidth: 767 });

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginRegister />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              {isMobile ? <MobileDashboard /> : <DesktopDashboard />}
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;