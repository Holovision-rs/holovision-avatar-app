import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";

const COLORS = ["#3baedb", "#876efe", "#614bde"];
 const RADIAN = Math.PI / 180;

 const RADIAN = Math.PI / 180;

const DonutChartWithLabels = ({ data }) => {
  return (
    <div style={{ textAlign: "center" }}>
      <PieChart width={300} height={220}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          fill="#8884d8"
          dataKey="value"
          labelLine={false}
          label={renderCustomizedLabel}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>

      {/* Legenda ispod */}
      <div className="chart-legend" style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "10px" }}>
        {data.map((entry, index) => (
          <div key={index} className="legend-item" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              className="legend-color"
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: COLORS[index % COLORS.length]
              }}
            ></span>
            <span className="legend-label" style={{ color: "#fff" }}>{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonutChartWithLabels;