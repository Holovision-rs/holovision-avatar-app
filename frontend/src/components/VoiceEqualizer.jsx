import React, { useEffect, useRef, useState } from "react";

export const VoiceEqualizer = ({ analyserNode }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDimensions({ width, height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!analyserNode || !canvasRef.current || !dimensions.width) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      analyserNode.getByteFrequencyData(dataArray);

      const { width, height } = dimensions;
      const centerX = width / 2;
      const barWidth = 4;
      const spacing = 2;
      const totalBars = Math.floor(width / (barWidth + spacing));
      const halfBars = Math.floor(totalBars / 2);

      ctx.clearRect(0, 0, width, height);
      ctx.save();

      // Glow efekt
      ctx.shadowBlur = 5;
      ctx.shadowColor = "#82ff9ed4";
      ctx.fillStyle = "#017a1c";

      for (let i = 0; i < halfBars; i++) {
        const volumeIndex = Math.floor((i / halfBars) * bufferLength);
        const volume = dataArray[volumeIndex];
        const barHeight = (volume / 255) * height;

        const leftX = centerX - (i + 1) * (barWidth + spacing);
        const rightX = centerX + i * (barWidth + spacing);

        ctx.fillRect(leftX, height - barHeight, barWidth, barHeight);
        ctx.fillRect(rightX, height - barHeight, barWidth, barHeight);
      }

      ctx.restore();
      requestAnimationFrame(draw);
    };

    draw();
  }, [analyserNode, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-10 mt-2">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      />
    </div>
  );
};

export default VoiceEqualizer;