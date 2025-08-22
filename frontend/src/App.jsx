import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import LoginRegister from "./pages/LoginRegister";
import { useMediaQuery } from "react-responsive";
import MobileDashboard from "./components/MobileDashboard";
import DesktopDashboard from "./components/DesktopDashboard";

const App = () => {
  const isMobile = useMediaQuery({ maxWidth: 767 });

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginRegister />} />
        <Route path="/admin" element={isMobile ? <MobileDashboard /> : <DesktopDashboard />} />
      </Routes>
    </Router>
  );
};

export default App;