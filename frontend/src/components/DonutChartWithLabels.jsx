import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";

const COLORS = ["#3baedb", "#876efe", "#614bde"];
const RADIAN = Math.PI / 180;

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  index
}) => {
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const labelX = cx + (outerRadius + 40) * Math.cos(-midAngle * RADIAN);
  const labelY = cy + (outerRadius + 40) * Math.sin(-midAngle * RADIAN);
  const lineEndX = cx + (outerRadius + 30) * Math.cos(-midAngle * RADIAN);
  const lineEndY = cy + (outerRadius + 30) * Math.sin(-midAngle * RADIAN);

  return (
    <g>
      <line
        x1={x}
        y1={y}
        x2={lineEndX}
        y2={lineEndY}
        stroke={COLORS[index % COLORS.length]}
      />
      <line
        x1={lineEndX}
        y1={lineEndY}
        x2={labelX}
        y2={labelY}
        stroke={COLORS[index % COLORS.length]}
      />
      <circle cx={labelX} cy={labelY} r={2} fill={COLORS[index % COLORS.length]} />
      <text
        x={labelX + (labelX > cx ? 6 : -6)}
        y={labelY}
        textAnchor={labelX > cx ? "start" : "end"}
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