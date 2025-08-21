import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const useAdminGuard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login");

    fetch("/api/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((user) => {
        if (!user.isAdmin) {
          navigate("/");
        }
      })
      .catch(() => navigate("/login"));
  }, [navigate]);
};

export default useAdminGuard;