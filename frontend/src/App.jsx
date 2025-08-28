import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import LoginRegisterDesktop from "./pages/desktop/LoginRegisterDesktop";
import LoginRegisterMobile from "./pages/mobile/LoginRegisterMobile";
import { useMediaQuery } from "react-responsive";
import MobileDashboard from "./components/MobileDashboard";
import DesktopDashboard from "./components/DesktopDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import Account from "./pages/Account";

const App = () => {
  const isMobile = useMediaQuery({ maxWidth: 767 });

  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element=
             {isMobile ? <LoginRegisterMobile /> : <LoginRegisterDesktop />}
           />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
                path="/account"
                element={
                  <ProtectedRoute>
                    <Account />
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