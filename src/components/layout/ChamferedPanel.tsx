import React from 'react';

export type ChamferVariant = 'cyan' | 'magenta' | 'yellow' | 'muted' | 'alt';

interface ChamferedPanelProps {
  children: React.ReactNode;
  variant?: ChamferVariant;
  cutSize?: 8 | 12 | 16;
  title?: string;
  tag?: string;
  rightSlot?: React.ReactNode;
  className?: string;
  innerClassName?: string;
  onClick?: () => void;
}

const VARIANT_STYLES: Record<
  ChamferVariant,
  { border: string; bg: string; glow: string; headerBg: string; accentText: string }
> = {
  cyan: {
    border: 'var(--neon-cyan)',
    bg: 'var(--bg-panel)',
    glow: 'rgba(0, 245, 212, 0.08)',
    headerBg: 'rgba(0, 245, 212, 0.1)',
    accentText: 'text-[#00F5D4]',
  },
  magenta: {
    border: 'var(--neon-magenta)',
    bg: 'var(--bg-panel)',
    glow: 'rgba(255, 30, 122, 0.12)',
    headerBg: 'rgba(255, 30, 122, 0.14)',
    accentText: 'text-[#FF1E7A]',
  },
  yellow: {
    border: 'var(--neon-yellow)',
    bg: 'var(--bg-panel)',
    glow: 'rgba(255, 230, 0, 0.12)',
    headerBg: 'rgba(255, 230, 0, 0.14)',
    accentText: 'text-[#FFE600]',
  },
  muted: {
    border: 'rgba(108, 122, 137, 0.45)',
    bg: 'var(--bg-panel-alt)',
    glow: 'rgba(108, 122, 137, 0.04)',
    headerBg: 'rgba(108, 122, 137, 0.1)',
    accentText: 'text-[#6C7A89]',
  },
  alt: {
    border: 'rgba(0, 245, 212, 0.4)',
    bg: 'var(--bg-panel-alt)',
    glow: 'rgba(0, 245, 212, 0.05)',
    headerBg: 'rgba(0, 245, 212, 0.07)',
    accentText: 'text-[#00F5D4]',
  },
};

export const ChamferedPanel: React.FC<ChamferedPanelProps> = ({
  children,
  variant = 'cyan',
  cutSize = 12,
  title,
  tag,
  rightSlot,
  className = '',
  innerClassName = '',
  onClick,
}) => {
  const styleConfig = VARIANT_STYLES[variant];

  return (
    <div
      onClick={onClick}
      className={`chamfer-frame ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={
        {
          '--chamfer-size': `${cutSize}px`,
          '--chamfer-border': styleConfig.border,
          '--chamfer-bg': styleConfig.bg,
          '--chamfer-glow': styleConfig.glow,
        } as React.CSSProperties
      }
    >
      <div className={`chamfer-inner flex flex-col ${innerClassName}`}>
        {(title || tag || rightSlot) && (
          <div
            className="flex items-center justify-between px-4 py-2 border-b font-terminal text-xs uppercase tracking-wider"
            style={{
              backgroundColor: styleConfig.headerBg,
              borderColor: styleConfig.border,
            }}
          >
            <div className="flex items-center gap-2.5">
              {tag && (
                <span
                  className="px-1.5 py-0.5 text-[10px] font-bold bg-[#0D0618] border"
                  style={{ borderColor: styleConfig.border, color: styleConfig.border }}
                >
                  {tag}
                </span>
              )}
              {title && (
                <span className={`font-bold ${styleConfig.accentText}`}>
                  {title}
                </span>
              )}
            </div>
            {rightSlot && <div className="flex items-center gap-2">{rightSlot}</div>}
          </div>
        )}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
};
