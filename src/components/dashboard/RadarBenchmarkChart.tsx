import React from 'react';
import {
  FiveAxisMetrics,
  normalizeAxis,
  normalizeInverseAxis,
  buildRadarPolygonPoints,
} from '../../lib/metrics';

interface RadarBenchmarkChartProps {
  metrics: FiveAxisMetrics;
}

const AXIS_LABELS = [
  { key: 'eWPM', label: 'eWPM', avgLabel: '238' },
  { key: 'FIX_MS', label: 'FIX_MS', avgLabel: '225ms' },
  { key: 'SPAN_W', label: 'SPAN_W', avgLabel: '2.5w' },
  { key: 'FWD_RATE', label: 'FLOW', avgLabel: '88%' },
  { key: 'SYNC', label: 'SYNC', avgLabel: '80%' },
];

export const RadarBenchmarkChart: React.FC<RadarBenchmarkChartProps> = ({
  metrics,
}) => {
  const size = 210;
  const center = size / 2;
  const radius = 72;

  const userScores: [number, number, number, number, number] = [
    normalizeAxis(metrics.effectiveWpm, 135, 238, 450),
    normalizeInverseAxis(metrics.fixationMs, 320, 225, 140),
    normalizeAxis(metrics.perceptualSpan, 1.2, 2.5, 4.5),
    normalizeAxis(metrics.forwardFlowRate * 100, 75, 88, 98),
    normalizeAxis(metrics.syncRate * 100, 65, 80, 95),
  ];

  // Human Native Avg is normalized to 60 on all 5 axes
  const humanAvgScores: [number, number, number, number, number] = [
    60, 60, 60, 60, 60,
  ];

  const userPolygon = buildRadarPolygonPoints(userScores, radius, center);
  const avgPolygon = buildRadarPolygonPoints(humanAvgScores, radius, center);
  const outerPolygon = buildRadarPolygonPoints(
    [100, 100, 100, 100, 100],
    radius,
    center
  );

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        {/* Outer grid pentagon */}
        <polygon
          points={outerPolygon}
          fill="rgba(13, 6, 24, 0.8)"
          stroke="rgba(108, 122, 137, 0.3)"
          strokeWidth="1"
        />

        {/* Axis spokes & labels */}
        {AXIS_LABELS.map((item, idx) => {
          const angle = (Math.PI * 2 * idx) / 5 - Math.PI / 2;
          const x2 = center + radius * Math.cos(angle);
          const y2 = center + radius * Math.sin(angle);
          const lx = center + (radius + 22) * Math.cos(angle);
          const ly = center + (radius + 18) * Math.sin(angle);

          return (
            <g key={item.key}>
              <line
                x1={center}
                y1={center}
                x2={x2}
                y2={y2}
                stroke="rgba(108, 122, 137, 0.25)"
                strokeWidth="1"
              />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-[#6C7A89] font-terminal text-[10px]"
              >
                {item.label}
              </text>
            </g>
          );
        })}

        {/* Human Native Avg Polygon (60%) */}
        <polygon
          points={avgPolygon}
          fill="rgba(242, 245, 248, 0.05)"
          stroke="rgba(242, 245, 248, 0.45)"
          strokeWidth="1.2"
          strokeDasharray="3 2"
        />

        {/* User Polygon */}
        <polygon
          points={userPolygon}
          fill="rgba(0, 245, 212, 0.22)"
          stroke="#00F5D4"
          strokeWidth="2"
        />
      </svg>

      <div className="flex items-center gap-4 font-terminal text-[10px] text-[#6C7A89] mt-1">
        <span className="flex items-center gap-1.5 text-[#00F5D4]">
          <span className="w-2.5 h-2.5 bg-[#00F5D4] inline-block" />
          YOU
        </span>
        <span className="flex items-center gap-1.5 text-[#F2F5F8]/70">
          <span className="w-2.5 h-0.5 bg-[#F2F5F8]/70 inline-block" />
          HUMAN AVG (238 WPM)
        </span>
      </div>
    </div>
  );
};
