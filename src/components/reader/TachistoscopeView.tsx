import React, { useState, useEffect, useCallback } from 'react';
import { TrainingPassage } from '../../types/schema';
import { ChamferedPanel } from '../layout/ChamferedPanel';
import { soundEngine } from '../../lib/soundEngine';

interface TachistoscopeViewProps {
  passage: TrainingPassage;
  targetWpm: number;
  onComplete: (correctRounds: number, totalRounds: number, flashMs: number) => void;
}

const TOTAL_ROUNDS = 8;

export const TachistoscopeView: React.FC<TachistoscopeViewProps> = ({
  passage,
  targetWpm,
  onComplete,
}) => {
  const [round, setRound] = useState<number>(0);
  const [phase, setPhase] = useState<'ready' | 'flashing' | 'choosing'>('ready');
  const [targetChunk, setTargetChunk] = useState<string>('');
  const [options, setOptions] = useState<string[]>([]);
  const [correctCount, setCorrectCount] = useState<number>(0);

  // Exposure window between 140ms and 240ms depending on targetWpm
  const flashMs = Math.max(140, Math.min(250, Math.round((2.8 / targetWpm) * 60000)));

  const setupRound = useCallback(
    (roundIdx: number) => {
      const pool = passage.chunks.filter((c) => c.length >= 8);
      const sourcePool = pool.length >= 8 ? pool : passage.chunks;
      const chosenIdx = (roundIdx * 7 + 3) % sourcePool.length;
      const target = sourcePool[chosenIdx];

      const distractors = sourcePool
        .filter((c) => c !== target)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      const combined = [target, ...distractors].sort(() => Math.random() - 0.5);
      setTargetChunk(target);
      setOptions(combined);
      setPhase('ready');
    },
    [passage.chunks]
  );

  useEffect(() => {
    setupRound(0);
  }, [setupRound]);

  // Sequence: ready (450ms) -> flashing (flashMs) -> choosing
  useEffect(() => {
    if (phase === 'ready') {
      const t = window.setTimeout(() => {
        soundEngine.playChunkTick(true);
        setPhase('flashing');
      }, 450);
      return () => window.clearTimeout(t);
    }
    if (phase === 'flashing') {
      const t = window.setTimeout(() => {
        setPhase('choosing');
      }, flashMs);
      return () => window.clearTimeout(t);
    }
  }, [phase, flashMs]);

  const handlePick = useCallback(
    (picked: string) => {
      if (phase !== 'choosing') return;
      const isRight = picked === targetChunk;
      const nextCorrect = isRight ? correctCount + 1 : correctCount;

      if (isRight) {
        soundEngine.playQuizCorrect(false);
      } else {
        soundEngine.playQuizWrong();
      }

      if (round + 1 < TOTAL_ROUNDS) {
        setCorrectCount(nextCorrect);
        const nextRound = round + 1;
        setRound(nextRound);
        setupRound(nextRound);
      } else {
        onComplete(nextCorrect, TOTAL_ROUNDS, flashMs);
      }
    },
    [phase, targetChunk, correctCount, round, setupRound, onComplete, flashMs]
  );

  // Number keys 1-4 shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== 'choosing') return;
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
        const idx = Number(e.code.replace('Digit', '')) - 1;
        if (options[idx]) handlePick(options[idx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, options, handlePick]);

  return (
    <ChamferedPanel
      variant="cyan"
      cutSize={16}
      tag={`FLASH ${flashMs}ms`}
      title={`TACHISTOSCOPE DRILL // ROUND ${round + 1} OF ${TOTAL_ROUNDS}`}
      className="flex-1 flex flex-col justify-center"
      innerClassName="p-6 sm:p-10 justify-center"
    >
      <div className="max-w-xl mx-auto w-full space-y-8 text-center">
        {/* Flash Reticle Window */}
        <div className="h-32 bg-[#0D0618] border border-[#00F5D4]/50 flex items-center justify-center relative">
          <div className="absolute top-2 left-3 font-terminal text-[10px] text-[#6C7A89]">
            EXPOSURE: {flashMs} MS
          </div>
          {phase === 'ready' && (
            <span className="font-terminal text-xs text-[#6C7A89] animate-pulse">
              [ LOCK GAZE AT RETICLE + ]
            </span>
          )}
          {phase === 'flashing' && (
            <span className="font-terminal text-2xl sm:text-4xl font-bold text-[#00F5D4] tracking-wide select-none">
              {targetChunk}
            </span>
          )}
          {phase === 'choosing' && (
            <span className="font-terminal text-xs text-[#FFE600]">
              SELECT MATCHING CHUNK (KEYS 1–4)
            </span>
          )}
        </div>

        {/* 4 Choice Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={phase !== 'choosing'}
              onClick={() => handlePick(opt)}
              className={`cyber-btn p-3.5 border text-left font-terminal text-sm flex items-center gap-3 transition-all ${
                phase === 'choosing'
                  ? 'bg-[#0D0618] border-[#00F5D4]/60 text-[#F2F5F8] hover:bg-[#00F5D4]/15 hover:border-[#00F5D4]'
                  : 'bg-[#0D0618]/50 border-[#6C7A89]/20 text-transparent select-none'
              }`}
            >
              <span className="px-1.5 py-0.5 text-xs bg-[#180B29] border border-[#00F5D4]/50 text-[#00F5D4]">
                0{idx + 1}
              </span>
              <span className="truncate">{phase === 'choosing' ? opt : '••••••'}</span>
            </button>
          ))}
        </div>
      </div>
    </ChamferedPanel>
  );
};
