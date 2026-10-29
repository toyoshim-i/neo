import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../../lib/soundEngine';

interface GhostRacingBarProps {
  userProgress: number;       // 0 to 100 (Player click cursor)
  ghostProgress: number;      // 0 to 100 (Target WPM Ghost cursor)
  targetWpm: number;
  totalWords: number;
  bestEffectiveWpm: number;   // e.g. 280
  isPlaying: boolean;
  resetKey: string | number;
}

export const GhostRacingBar: React.FC<GhostRacingBarProps> = ({
  userProgress,
  ghostProgress,
  targetWpm,
  totalWords,
  bestEffectiveWpm,
  isPlaying,
  resetKey,
}) => {
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [overtakeFlash, setOvertakeFlash] = useState<'GHOST' | 'BEST' | null>(null);
  const wasAheadOfGhost = useRef<boolean>(false);
  const wasAheadOfBest = useRef<boolean>(false);

  // Reset elapsed timer when session restarts or pass changes
  useEffect(() => {
    setElapsedMs(0);
    wasAheadOfGhost.current = false;
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

  const hasPersonalBest = bestEffectiveWpm > 0;
  const refWpm = hasPersonalBest ? bestEffectiveWpm : 238;
  const refTotalMs = Math.max(1000, (totalWords / refWpm) * 60000);
  const bestProgress = Math.min(100, (elapsedMs / refTotalMs) * 100);

  // Check overtake events after first 8% of passage
  useEffect(() => {
    if (userProgress < 8 || elapsedMs < 1000) return;

    const nowAheadGhost = userProgress > ghostProgress;
    if (nowAheadGhost && !wasAheadOfGhost.current && ghostProgress > 5) {
      soundEngine.playOvertakeSpark();
      setOvertakeFlash('GHOST');
      window.setTimeout(() => setOvertakeFlash(null), 650);
    }
    wasAheadOfGhost.current = nowAheadGhost;

    const nowAheadBest = userProgress > bestProgress;
    if (nowAheadBest && !wasAheadOfBest.current && bestProgress > 5) {
      soundEngine.playOvertakeSpark();
      setOvertakeFlash('BEST');
      window.setTimeout(() => setOvertakeFlash(null), 650);
    }
    wasAheadOfBest.current = nowAheadBest;
  }, [userProgress, ghostProgress, bestProgress, elapsedMs]);

  return (
    <div
      className={`px-3 py-2 bg-[#180B29]/90 border transition-colors duration-150 space-y-1.5 font-terminal text-[10px] ${
        overtakeFlash
          ? 'border-[#FFE600] shadow-[0_0_15px_rgba(255,230,0,0.35)]'
          : 'border-[#00F5D4]/30'
      }`}
    >
      {/* Track 1: USER CURSOR (CYAN) */}
      <div className="flex items-center gap-2">
        <span className="w-24 text-[#00F5D4] font-bold shrink-0">
          YOU (CLICK)
        </span>
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

      {/* Track 2: TARGET WPM GHOST PACER (YELLOW) */}
      <div className="flex items-center gap-2">
        <span className="w-24 text-[#FFE600] shrink-0">
          GHOST ({targetWpm})
        </span>
        <div className="flex-1 h-1 bg-[#0D0618] overflow-hidden">
          <div
            className="h-full bg-[#FFE600]/85 transition-all duration-100"
            style={{ width: `${ghostProgress}%` }}
          />
        </div>
        <span className="w-9 text-right text-[#FFE600]">
          {Math.round(ghostProgress)}%
        </span>
      </div>

      {/* Track 3: SELF BEST OR NATIVE AVG (MAGENTA) */}
      <div className="flex items-center gap-2">
        <span className="w-24 text-[#FF1E7A] shrink-0">
          {hasPersonalBest ? `BEST (${bestEffectiveWpm})` : 'AVG (238)'}
        </span>
        <div className="flex-1 h-1 bg-[#0D0618] overflow-hidden">
          <div
            className="h-full bg-[#FF1E7A]/80 transition-all duration-75"
            style={{ width: `${bestProgress}%` }}
          />
        </div>
        <span className="w-9 text-right text-[#FF1E7A]">
          {hasPersonalBest ? `${Math.round(bestProgress)}%` : '--'}
        </span>
      </div>
    </div>
  );
};
