import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import LoginRegister from "./pages/LoginRegister";
import { useMediaQuery } from "react-responsive";
import MobileDashboard from "./components/MobileDashboard";
import DesktopDashboard from "./components/DesktopDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import Upgrade from "./pages/Upgrade";

const App = () => {
  const isMobile = useMediaQuery({ maxWidth: 767 });

  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginRegister />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
                path="/upgrade"
                element={
                  <ProtectedRoute>
                    <Upgrade />
                  </ProtectedRoute>
                }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                {isMobile ? <MobileDashboard /> : <DesktopDashboard />}
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;