import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";

const COLORS = ["#3baedb", "#876efe", "#614bde"];
const renderCustomShape = (props) => {
  const RADIAN = Math.PI / 180;
  const {
    cx, cy, midAngle, innerRadius, outerRadius,
    startAngle, endAngle, fill, percent
  } = props;

  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const mx = cx + (outerRadius + 10) * cos;
  const my = cy + (outerRadius + 10) * sin;

  // Label pozicija (samo levo ili desno)
  const labelX = cx + (outerRadius + 40) * (cos >= 0 ? 1 : -1);
  const labelY = my;
  const textAnchor = cos >= 0 ? "start" : "end";

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
      <path d={`M${cx + cos * outerRadius},${cy + sin * outerRadius}
                L${mx},${my} L${labelX - (cos >= 0 ? -8 : 8)},${labelY}`} 
            stroke={fill} fill="none" />
      <circle cx={labelX} cy={labelY} r={2} fill={fill} stroke="none" />
      <text x={labelX + (cos >= 0 ? 10 : -10)} y={labelY} textAnchor={textAnchor} fill="#fff">
        {(percent * 100).toFixed(1)}%
      </text>
    </g>
  );
};

const DonutChartWithLabels = ({ data }) => {
  return (
    <div style={{ textAlign: "center" }}>
      <PieChart width={220} height={220}>
        <Pie
          activeShape={renderCustomShape}
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          fill="#8884d8"
          dataKey="value"
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