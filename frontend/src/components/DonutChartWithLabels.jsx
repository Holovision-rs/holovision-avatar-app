import React from "react";
import { PieChart, Pie, Cell } from "recharts";

const COLORS = ["#3baedb", "#876efe", "#614bde"];
const RADIAN = Math.PI / 180;

const renderCustomizedLabel = (props) => {
  const {
    cx, cy, outerRadius, index, percent, payload, midAngle,
  } = props;

  const textOffset = 12;
  const baseAngle = (props.data?.length === 2)
    ? (index === 0 ? 180 : 0) // Levi i desni
    : -midAngle; // Normalno za više segmenata

  const angle = baseAngle * RADIAN;
  const radius = outerRadius + 12;
  const extendedLine = outerRadius + 30;

  const startX = cx + radius * Math.cos(angle);
  const startY = cy + radius * Math.sin(angle);
  const midX = cx + extendedLine * Math.cos(angle);
  const midY = cy + extendedLine * Math.sin(angle);
  const endX = midX + (midX > cx ? 20 : -20);
  const endY = midY;

  const label =
    props.labelType === "value"
      ? `${payload.value} min`
      : `${(percent * 100).toFixed(1)}%`;

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
        {label}
      </text>
    </g>
  );
};

const DonutChartWithLabels = ({ data, labelType = "percent" }) => {
  return (
    <div style={{ textAlign: "center" }}>
      <PieChart width={300} height={220}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          dataKey="value"
          label={(props) => renderCustomizedLabel({ ...props, labelType })}
          labelLine={false}
          isAnimationActive={false}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
      </PieChart>

      <div className="chart-legend">
        {data.map((entry, index) => (
          <div
            key={index}
            className="legend-item"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              justifyContent: "center",
              marginTop: "4px"
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                backgroundColor: COLORS[index % COLORS.length],
                display: "inline-block",
                borderRadius: 2
              }}
            ></span>
            <span style={{ color: "#ccc", fontSize: 12 }}>{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonutChartWithLabels;