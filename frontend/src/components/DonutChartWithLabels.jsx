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
  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + outerRadius * cos;
  const sy = cy + outerRadius * sin;
  const mx = cx + (outerRadius + 10) * cos;
  const my = cy + (outerRadius + 10) * sin;
  const ex = mx + (cos >= 0 ? 20 : -20); // linija desno/levo
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      {/* linija od centra do tačke */}
      <polyline
        points={`${sx},${sy} ${mx},${my} ${ex},${ey}`}
        stroke={COLORS[index % COLORS.length]}
        fill="none"
        strokeWidth={1}
      />
      {/* tačka na kraju */}
      <circle cx={ex} cy={ey} r={2} fill={COLORS[index % COLORS.length]} />
      {/* tekst */}
      <text
        x={ex + (cos >= 0 ? 6 : -6)}
        y={ey}
        textAnchor={textAnchor}
        dominantBaseline="central"
        fill="#fff"
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    </g>
  );
};

const DonutChartWithLabels = ({ data }) => {
  return (
    <div style={{ textAlign: "center" }}>
      <PieChart width={220} height={220}>
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