import React from 'react';
import {
  Volume2,
  VolumeX,
  Cpu,
  Settings,
  BarChart2,
  Award,
  Loader2,
} from 'lucide-react';
import { soundEngine } from '../../lib/soundEngine';

interface CyberHeaderProps {
  currentStepLabel: string;
  muted: boolean;
  sessionCount: number;
  achievementCount?: number;
  totalAchievements?: number;
  llmDownloadProgressPct?: number | null;
  onToggleMute: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onOpenAchievements?: () => void;
  onGoHome?: () => void;
}

export const CyberHeader: React.FC<CyberHeaderProps> = ({
  currentStepLabel,
  muted,
  sessionCount,
  achievementCount = 0,
  totalAchievements = 6,
  llmDownloadProgressPct = null,
  onToggleMute,
  onOpenHistory,
  onOpenSettings,
  onOpenAchievements,
  onGoHome,
}) => {
  return (
    <header className="border-b border-[#00F5D4]/30 bg-[#180B29]/90 backdrop-blur-xs sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <button
          type="button"
          onClick={() => {
            if (onGoHome) {
              soundEngine.playUiClick();
              onGoHome();
            }
          }}
          className="flex items-center gap-2.5 text-left group cursor-pointer"
        >
          <div className="w-7 h-7 bg-[#0D0618] border border-[#00F5D4] flex items-center justify-center group-hover:bg-[#00F5D4]/15 transition-colors">
            <Cpu className="w-4 h-4 text-[#00F5D4]" />
          </div>
          <div className="font-terminal">
            <span className="text-sm font-bold tracking-wider text-[#F2F5F8] group-hover:text-[#00F5D4] transition-colors">
              NEURAL OVERCLOCK
            </span>
            <span className="hidden sm:inline-block text-[11px] text-[#6C7A89] ml-2">
              // {currentStepLabel}
            </span>
          </div>
        </button>

        {/* Right: Minimal Utility Controls */}
        <div className="flex items-center gap-2 font-terminal text-xs">
          {llmDownloadProgressPct !== null && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onOpenSettings();
              }}
              title="Model downloading in background — click to view status"
              className="cyber-btn px-2 py-1.5 border border-[#00F5D4] bg-[#00F5D4]/15 text-[#00F5D4] flex items-center gap-1.5"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>LLM {llmDownloadProgressPct}%</span>
            </button>
          )}

          {onOpenAchievements && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onOpenAchievements();
              }}
              title="Neural Achievements & Badges"
              className="cyber-btn px-2.5 py-1.5 border border-[#FFE600]/60 bg-[#0D0618] text-[#FFE600] hover:bg-[#FFE600]/15 flex items-center gap-1.5"
            >
              <Award className="w-3.5 h-3.5 text-[#FFE600]" />
              <span className="hidden sm:inline">BADGES</span>
              <span className="text-[10px] px-1 bg-[#FFE600]/20 text-[#FFE600] font-bold">
                {achievementCount}/{totalAchievements}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenHistory();
            }}
            title="Session History"
            className="cyber-btn px-2.5 py-1.5 border border-[#6C7A89]/50 bg-[#0D0618] text-[#F2F5F8] hover:border-[#00F5D4] hover:text-[#00F5D4] flex items-center gap-1.5"
          >
            <BarChart2 className="w-3.5 h-3.5 text-[#00F5D4]" />
            <span className="hidden sm:inline">HISTORY</span>
            {sessionCount > 0 && (
              <span className="text-[10px] px-1 bg-[#00F5D4]/20 text-[#00F5D4]">
                {sessionCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            title={muted ? 'Unmute Audio' : 'Mute Audio'}
            className={`cyber-btn px-2.5 py-1.5 border flex items-center gap-1.5 ${
              !muted
                ? 'border-[#00F5D4]/50 bg-[#0D0618] text-[#00F5D4] hover:border-[#00F5D4]'
                : 'border-[#FF1E7A]/60 bg-[#FF1E7A]/10 text-[#FF1E7A]'
            }`}
          >
            {muted ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{muted ? 'MUTED' : 'AUDIO'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenSettings();
            }}
            title="System Settings"
            className="cyber-btn px-2.5 py-1.5 border border-[#6C7A89]/50 bg-[#0D0618] text-[#F2F5F8] hover:border-[#00F5D4] hover:text-[#00F5D4] flex items-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CONFIG</span>
          </button>
        </div>
      </div>
    </header>
  );
};
