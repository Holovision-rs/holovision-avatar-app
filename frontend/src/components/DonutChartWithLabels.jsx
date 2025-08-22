import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";

const COLORS = ["#3baedb", "#876efe", "#614bde"];
const renderCustomLabel = (props) => {
  const RADIAN = Math.PI / 180;
  const {
    cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle,
    fill, percent
  } = props;

  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);

  const labelRadius = outerRadius + 40;
  const x = cx + labelRadius * cos;
  const y = cy + labelRadius * sin;
  const textAnchor = cos >= 0 ? "start" : "end";

  const lineX = cx + (outerRadius + 10) * cos;
  const lineY = cy + (outerRadius + 10) * sin;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      {/* Linija od kruga ka tekstu */}
      <path d={`M${lineX},${lineY}L${x},${y}`} stroke={fill} fill="none" />
      <circle cx={x} cy={y} r={2} fill={fill} stroke="none" />
      {/* Procenat levo/desno */}
      <text x={x + (cos >= 0 ? 12 : -12)} y={y} textAnchor={textAnchor} fill="#fff">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    </g>
  );
};

const DonutChartWithLabels = ({ data }) => {
  return (
    <div style={{ textAlign: "center" }}>
      <PieChart width={240} height={220}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          dataKey="value"
          labelLine={false}
          label={renderCustomLabel}
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