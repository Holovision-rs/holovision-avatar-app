import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";

const COLORS = ["#3baedb", "#876efe", "#614bde"];


const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  index
}) => {
  const radius = outerRadius + 12;
  const extendedLine = outerRadius + 30;
  const textOffset = 12;
  const angle = -midAngle * RADIAN;

  const startX = cx + radius * Math.cos(angle);
  const startY = cy + radius * Math.sin(angle);
  const midX = cx + extendedLine * Math.cos(angle);
  const midY = cy + extendedLine * Math.sin(angle);
  const endX = midX + (midX > cx ? 20 : -20);
  const endY = midY;

  return (
    <g>
      <line
        x1={startX}
        y1={startY}
        x2={midX}
        y2={midY}
        stroke={COLORS[index % COLORS.length]}
        strokeWidth={1}
      />
      <line
        x1={midX}
        y1={midY}
        x2={endX}
        y2={endY}
        stroke={COLORS[index % COLORS.length]}
        strokeWidth={1}
      />
      <circle cx={endX} cy={endY} r={2} fill={COLORS[index % COLORS.length]} />
      <text
        x={endX + (endX > cx ? textOffset : -textOffset)}
        y={endY}
        textAnchor={endX > cx ? "start" : "end"}
        dominantBaseline="central"
        fill="#ffffff"
        fontSize={13}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    </g>
  );
};

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