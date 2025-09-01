// src/components/MobileAccountView.jsx
import React from 'react';
import { useAuth } from "../../context/AuthContext";
import DonutChart from "../../components/DonutChartWithLabels";
import { Globe } from "lucide-react";

const MobileAccountView = () => {
	const { user } = useAuth();
	const paid = Number(user?.monthlyPaidMinutes) || 0;
    const used = Number(user?.monthlyUsageMinutes) || 0;
    const remaining = Math.max(paid - used, 0);

  return (
    <div
      className="min-h-screen bg-no-repeat bg-cover bg-center px-4 py-6"
      style={{ backgroundImage: "url('/moile_background.png')" }}
    >
      {/* Avatar i ime */}
      <div className="flex flex-col items-center space-y-2 mb-6">
        <img
          src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user?.name || user?.email}`}
          alt="Avatar"
          className="w-16 h-16 rounded-full"
        />
        <h2 className="text-white font-semibold text-lg">{user?.name || user?.email}</h2>
      </div>

      {/* Donut */}
      <div className="flex justify-center mb-6">
        <DonutChart paid={paid} used={used} remaining={remaining} />
      </div>

      {/* Sub info */}
      <div className="flex items-center justify-center gap-2 text-white mb-6">
       
        <p className="text-sm">
          {user?.subscription === "gold" && <span>👑</span>}
		  {user?.subscription === "silver" && <span>🥈</span>}
		  {user?.subscription === "free" && <span>🆓</span>}
		  Subscription: {user?.subscription?.charAt(0).toUpperCase() + user?.subscription?.slice(1) || "None"}
		</p>
      </div>

      {/* Dalje sekcije - možeš koristiti Tailwind grid ili flex */}
      <div className="bg-white bg-opacity-10 p-4 rounded-xl space-y-4">
        <div className="text-white">📊 Section 1: Feature info</div>
        <div className="text-white">⚙️ Section 2: Settings</div>
        <div className="text-white">📩 Section 3: Support</div>
      </div>
    </div>
  );
};

export default MobileAccountView;