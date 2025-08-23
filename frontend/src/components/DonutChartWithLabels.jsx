const DonutChartWithLabels = ({ data, labelRenderer }) => {
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
          label={labelRenderer} // ✔ koristi prop ovde
          labelLine={false}
          isAnimationActive={false}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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