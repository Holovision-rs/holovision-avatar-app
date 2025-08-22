import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";

const COLORS = ["#3baedb", "#876efe", "#614bde"];
const CustomLabel = ({ cx, cy, midAngle, outerRadius, percent, index }) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 30;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const textAnchor = x > cx ? "start" : "end";

  return (
    <>
      <line
        x1={cx + (outerRadius + 10) * Math.cos(-midAngle * RADIAN)}
        y1={cy + (outerRadius + 10) * Math.sin(-midAngle * RADIAN)}
        x2={x}
        y2={y}
        stroke={COLORS[index % COLORS.length]}
        strokeWidth={1}
      />
      <circle cx={x} cy={y} r={2} fill={COLORS[index % COLORS.length]} />
      <text
        x={x + (x > cx ? 10 : -10)}
        y={y}
        textAnchor={textAnchor}
        fill="#fff"
        dominantBaseline="central"
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    </>
  );
};

const DonutChartWithLabels = ({ data }) => {
  return (
    <div style={{ textAlign: "center" }}>
      <PieChart width={300} height={300}>
        <Pie
          data={data}
          cx={150}
          cy={150}
          innerRadius={60}
          outerRadius={80}
          dataKey="value"
          labelLine={false}
          label={props => (
            <CustomLabel {...props} />
          )}
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