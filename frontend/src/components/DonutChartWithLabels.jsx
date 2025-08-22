import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";

const COLORS = ["#3baedb", "#876efe", "#614bde"];
const DonutChartWithLabels = ({ data }) => {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  const calculateLabelPosition = (index, totalSectors, cx, cy, radius) => {
    const angle = (360 / totalSectors) * index - 90;
    const rad = (Math.PI / 180) * angle;
    const x = cx + radius * Math.cos(rad);
    const y = cy + radius * Math.sin(rad);
    return { x, y };
  };

  return (
    <div style={{ position: "relative", width: 220, height: 220, margin: "0 auto" }}>
      <PieChart width={220} height={220}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          dataKey="value"
          startAngle={90}
          endAngle={-270}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>

      {/* Ručno pozicionirani procenti sa strelicama */}
      {data.map((entry, index) => {
        const { x, y } = calculateLabelPosition(index, data.length, 110, 110, 100);
        const percent = ((entry.value / total) * 100).toFixed(1);

        return (
          <div
            key={index}
            style={{
              position: "absolute",
              top: y - 10,
              left: x - 20,
              color: "#fff",
              fontSize: "12px",
              whiteSpace: "nowrap",
            }}
          >
            {percent}%
          </div>
        );
      })}

      <div className="chart-legend">
        {data.map((entry, index) => (
          <div key={index} className="legend-item">
            <span
              className="legend-color"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            ></span>
            <span className="legend-label">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonutChartWithLabels;