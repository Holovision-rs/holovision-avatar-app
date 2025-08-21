import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginRegister from "./pages/LoginRegister";
import AdminPanel from "./pages/AdminPanel"; // napravi ovaj fajl kasnije
import Home from "./pages/Home"; // tvoja glavna aplikacija (Scenario, ChatInterface itd.)

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginRegister />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Router>
  );
}

export default App;