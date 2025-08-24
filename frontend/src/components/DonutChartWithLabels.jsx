import React, { useState } from "react";
import { PieChart, Pie, Cell, Sector } from "recharts";


const COLORS = ["#ef00ff", "#876efe", "#00fffd"];
const RADIAN = Math.PI / 180;
const renderActiveShape = (props) => {
  const {
    cx, cy, innerRadius, outerRadius,
    startAngle, endAngle, fill, percent,
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <text
        x={cx}
        y={cy}
        dy={8}
        textAnchor="middle"
        fill="#fff"
        style={{ fontSize: "14px" }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    </g>
  );
};
const renderDonutLabel = ({ cx, cy, outerRadius, midAngle, percent, index }) => {
  const angle = -midAngle * RADIAN;
  const radius = outerRadius + 12;
  const extended = outerRadius + 30;
  const offset = 12;

  const startX = cx + radius * Math.cos(angle);
  const startY = cy + radius * Math.sin(angle);
  const midX = cx + extended * Math.cos(angle);
  const midY = cy + extended * Math.sin(angle);
  const endX = midX + (midX > cx ? 20 : -20);
  const endY = midY;

  return (
    <g>
      <line x1={startX} y1={startY} x2={midX} y2={midY} stroke={COLORS[index]} strokeWidth={1} />
      <line x1={midX} y1={midY} x2={endX} y2={endY} stroke={COLORS[index]} strokeWidth={1} />
      <circle cx={endX} cy={endY} r={2} fill={COLORS[index]} />
      <text
        x={endX + (endX > cx ? offset : -offset)}
        y={endY}
        fill="#fff"
        textAnchor={endX > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={16}
        fontWeight="bold"
      >
        {(percent * 100).toFixed(1)}%
      </text>
    </g>
  );
};

  const renderQuotaLabel = ({ cx, cy, outerRadius, index, payload }) => {
    const angle = index === 0 ? 0 : 180;
    const angleRad = angle * RADIAN;
    const radius = outerRadius + 12;
    const extended = outerRadius + 30;
    const offset = 12;

    const startX = cx + radius * Math.cos(angleRad);
    const startY = cy + radius * Math.sin(angleRad);
    const midX = cx + extended * Math.cos(angleRad);
    const midY = cy + extended * Math.sin(angleRad);
    const endX = midX + (midX > cx ? 20 : -20);
    const endY = midY;

    return (
      <g>
        <line x1={startX} y1={startY} x2={midX} y2={midY} stroke={COLORS[index]} strokeWidth={1} />
        <line x1={midX} y1={midY} x2={endX} y2={endY} stroke={COLORS[index]} strokeWidth={1} />
        <circle cx={endX} cy={endY} r={2} fill={COLORS[index]} />
        <text
          x={endX + (endX > cx ? offset : -offset)}
          y={endY}
          fill="#fff"
          textAnchor={endX > cx ? "start" : "end"}
          dominantBaseline="central"
          fontSize={16}
          fontWeight="bold"
        >
          {payload.value} min
        </text>
      </g>
    );
  };

const DonutChartWithLabels = ({ data, labelRenderer, customLegend }) => {
  const [activeIndex, setActiveIndex] = useState(null);

  return (
    <div style={{ textAlign: "center" }}>
      <PieChart width={400} height={220}>
        <defs>
          {COLORS.map((color, index) => (
            <React.Fragment key={index}>
              <linearGradient id={`grad-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="1" />
                <stop offset="100%" stopColor={color} stopOpacity="1" />
              </linearGradient>
              <filter id={`glow-${index}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="1 0 0 0 0
                          0 1 0 0 0
                          0 0 1 0 0
                          0 0 0 20 -10"
                />
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </React.Fragment>
          ))}
        </defs>

        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={58}
          outerRadius={70}
          activeIndex={activeIndex}
          activeShape={renderActiveShape}
          dataKey="value"
          label={labelRenderer}
          labelLine={false}
          isAnimationActive={true}
          animationBegin={0}
          animationDuration={1000}
          onMouseEnter={(_, index) => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(null)}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={`url(#grad-${index})`}
              filter={`url(#glow-${index})`}
              stroke="none"
              cursor="pointer"
            />
          ))}
        </Pie>
      </PieChart>

      <div className="chart-legend">
        {(customLegend || data).map((entry, index) => {
          const color = customLegend ? entry.color : COLORS[index % COLORS.length];
          const name = customLegend ? entry.name : entry.name;

          return (
            <div
              key={index}
              className="legend-item"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                justifyContent: "center",
                marginTop: "4px",
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  background: `linear-gradient(45deg, ${color}88, ${color})`,
                  display: "inline-block",
                  borderRadius: 2,
                }}
              ></span>
              <span style={{ color: "#ccc", fontSize: 12 }}>{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export {
  DonutChartWithLabels as default,
  renderDonutLabel,
  renderQuotaLabel
};