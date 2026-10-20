import React from 'react';

export type OperatorState = 'observing' | 'critical_break' | 'confirmed' | 'desync';

interface OperatorMonitorProps {
  state: OperatorState;
  responseTimeSec?: number | null;
}

export const OperatorMonitor: React.FC<OperatorMonitorProps> = ({
  state,
  responseTimeSec,
}) => {
  const config: Record<
    OperatorState,
    { border: string; text: string; label: string; eyeColor: string }
  > = {
    observing: {
      border: 'border-[#00F5D4]/40',
      text: 'text-[#00F5D4]',
      label: 'STATE: OBSERVING // AWAITING EVIDENCE',
      eyeColor: '#00F5D4',
    },
    critical_break: {
      border: 'border-[#FFE600]',
      text: 'text-[#FFE600]',
      label: `CONTRADICTION BROKEN // CRITICAL (${responseTimeSec?.toFixed(1)}s)`,
      eyeColor: '#FFE600',
    },
    confirmed: {
      border: 'border-[#00F5D4]',
      text: 'text-[#00F5D4]',
      label: `SYNAPSE VERIFIED (${responseTimeSec?.toFixed(1)}s)`,
      eyeColor: '#00F5D4',
    },
    desync: {
      border: 'border-[#FF1E7A]',
      text: 'text-[#FF1E7A]',
      label: 'STATE: SEMANTIC DESYNC DETECTED',
      eyeColor: '#FF1E7A',
    },
  };

  const c = config[state];

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 bg-[#0D0618] border ${c.border} font-terminal text-xs`}
    >
      {/* Minimal Pixel/SVG Neural Auditor Visor */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        className="shrink-0 bg-[#180B29] border border-current p-0.5"
        style={{ color: c.eyeColor }}
      >
        <rect x="4" y="4" width="20" height="20" fill="#0D0618" />
        {/* Visor frame */}
        <rect x="5" y="9" width="18" height="6" fill={c.eyeColor} fillOpacity="0.25" />
        {state === 'critical_break' ? (
          <>
            <rect x="7" y="10" width="5" height="4" fill={c.eyeColor} />
            <rect x="16" y="10" width="5" height="4" fill={c.eyeColor} />
            <rect x="9" y="18" width="10" height="3" fill={c.eyeColor} />
          </>
        ) : state === 'desync' ? (
          <>
            <line x1="7" y1="10" x2="11" y2="14" stroke={c.eyeColor} strokeWidth="2" />
            <line x1="11" y1="10" x2="7" y2="14" stroke={c.eyeColor} strokeWidth="2" />
            <line x1="17" y1="10" x2="21" y2="14" stroke={c.eyeColor} strokeWidth="2" />
            <line x1="21" y1="10" x2="17" y2="14" stroke={c.eyeColor} strokeWidth="2" />
            <rect x="10" y="19" width="8" height="2" fill={c.eyeColor} />
          </>
        ) : (
          <>
            <rect x="7" y="11" width="4" height="2" fill={c.eyeColor} />
            <rect x="17" y="11" width="4" height="2" fill={c.eyeColor} />
            <rect x="11" y="19" width="6" height="1.5" fill={c.eyeColor} />
          </>
        )}
      </svg>

      <div className="flex-1 truncate">
        <div className="text-[10px] text-[#6C7A89]">NEURAL INQUISITOR</div>
        <div className={`font-bold truncate ${c.text}`}>{c.label}</div>
      </div>
    </div>
  );
};
