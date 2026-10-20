import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../../lib/soundEngine';

interface GhostRacingBarProps {
  userProgress: number;       // 0 to 100
  totalWords: number;
  bestEffectiveWpm: number;   // e.g. 280
  isPlaying: boolean;
  resetKey: string | number;
}

export const GhostRacingBar: React.FC<GhostRacingBarProps> = ({
  userProgress,
  totalWords,
  bestEffectiveWpm,
  isPlaying,
  resetKey,
}) => {
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [overtakeFlash, setOvertakeFlash] = useState<'AVG' | 'BEST' | null>(null);
  const wasAheadOfAvg = useRef<boolean>(false);
  const wasAheadOfBest = useRef<boolean>(false);

  // Reset elapsed timer when session restarts or pass changes
  useEffect(() => {
    setElapsedMs(0);
    wasAheadOfAvg.current = false;
    wasAheadOfBest.current = false;
  }, [resetKey]);

  // Real-time 50ms ticker while reading is playing
  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      setElapsedMs((prev) => prev + 50);
    }, 50);
    return () => window.clearInterval(id);
  }, [isPlaying]);

  const humanAvgTotalMs = Math.max(1000, (totalWords / 238) * 60000);
  const selfBestWpm = Math.max(150, bestEffectiveWpm || 260);
  const selfBestTotalMs = Math.max(1000, (totalWords / selfBestWpm) * 60000);

  const avgProgress = Math.min(100, (elapsedMs / humanAvgTotalMs) * 100);
  const bestProgress = Math.min(100, (elapsedMs / selfBestTotalMs) * 100);

  // Check overtake events after first 8% of passage
  useEffect(() => {
    if (userProgress < 8 || elapsedMs < 1000) return;

    const nowAheadAvg = userProgress > avgProgress;
    if (nowAheadAvg && !wasAheadOfAvg.current && avgProgress > 5) {
      soundEngine.playOvertakeSpark();
      setOvertakeFlash('AVG');
      window.setTimeout(() => setOvertakeFlash(null), 650);
    }
    wasAheadOfAvg.current = nowAheadAvg;

    const nowAheadBest = userProgress > bestProgress;
    if (nowAheadBest && !wasAheadOfBest.current && bestProgress > 5) {
      soundEngine.playOvertakeSpark();
      setOvertakeFlash('BEST');
      window.setTimeout(() => setOvertakeFlash(null), 650);
    }
    wasAheadOfBest.current = nowAheadBest;
  }, [userProgress, avgProgress, bestProgress, elapsedMs]);

  return (
    <div
      className={`px-3 py-2 bg-[#180B29]/90 border transition-colors duration-150 space-y-1.5 font-terminal text-[10px] ${
        overtakeFlash
          ? 'border-[#FFE600] shadow-[0_0_15px_rgba(255,230,0,0.35)]'
          : 'border-[#00F5D4]/30'
      }`}
    >
      {/* Track 1: USER (CYAN) */}
      <div className="flex items-center gap-2">
        <span className="w-20 text-[#00F5D4] font-bold shrink-0">YOU</span>
        <div className="flex-1 h-1.5 bg-[#0D0618] overflow-hidden relative">
          <div
            className={`h-full transition-all duration-100 ${
              overtakeFlash ? 'bg-[#FFE600]' : 'bg-[#00F5D4]'
            }`}
            style={{ width: `${userProgress}%` }}
          />
        </div>
        <span className="w-9 text-right text-[#00F5D4] font-bold">
          {Math.round(userProgress)}%
        </span>
      </div>

      {/* Track 2: HUMAN AVG 238 WPM (GRAY/WHITE) */}
      <div className="flex items-center gap-2">
        <span className="w-20 text-[#6C7A89] shrink-0">AVG (238)</span>
        <div className="flex-1 h-1 bg-[#0D0618] overflow-hidden">
          <div
            className="h-full bg-[#F2F5F8]/50 transition-all duration-75"
            style={{ width: `${avgProgress}%` }}
          />
        </div>
        <span className="w-9 text-right text-[#6C7A89]">
          {Math.round(avgProgress)}%
        </span>
      </div>

      {/* Track 3: SELF BEST (MAGENTA) */}
      <div className="flex items-center gap-2">
        <span className="w-20 text-[#FF1E7A] shrink-0">
          BEST ({selfBestWpm})
        </span>
        <div className="flex-1 h-1 bg-[#0D0618] overflow-hidden">
          <div
            className="h-full bg-[#FF1E7A]/80 transition-all duration-75"
            style={{ width: `${bestProgress}%` }}
          />
        </div>
        <span className="w-9 text-right text-[#FF1E7A]">
          {Math.round(bestProgress)}%
        </span>
      </div>
    </div>
  );
};
