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

const FALLBACK_WORDS = [
  'system',
  'signal',
  'visual',
  'memory',
  'neural',
  'active',
  'stream',
  'window',
  'target',
  'cortex',
  'motion',
  'rapid',
  'steady',
  'direct',
  'modern',
  'global',
  'native',
  'pattern',
  'network',
  'process',
  'context',
  'pathway',
  'control',
  'balance',
  'thought',
  'reading',
  'horizon',
  'impulse',
];

function splitTokenPunctuation(token: string): {
  lead: string;
  core: string;
  trail: string;
} {
  const match = token.match(/^([^A-Za-z0-9]*)([A-Za-z0-9'-]+)([^A-Za-z0-9]*)$/);
  if (!match) {
    return { lead: '', core: token, trail: '' };
  }
  return {
    lead: match[1] || '',
    core: match[2] || token,
    trail: match[3] || '',
  };
}

function matchCasingAndPunctuation(
  originalToken: string,
  replacementCore: string
): string {
  const { lead, core, trail } = splitTokenPunctuation(originalToken);
  if (!core) return originalToken;

  let formatted = replacementCore.toLowerCase();
  if (core.length > 1 && core === core.toUpperCase()) {
    formatted = replacementCore.toUpperCase();
  } else if (core[0] === core[0].toUpperCase()) {
    formatted =
      replacementCore.charAt(0).toUpperCase() +
      replacementCore.slice(1).toLowerCase();
  }
  return `${lead}${formatted}${trail}`;
}

/**
 * Builds 4 options where distractors share the same leading/middle/trailing words
 * and only swap 1 word at left, middle, or right peripheral positions.
 * This prevents answering by only reading the first word and forces full-span intake.
 */
function buildPeripheralSpanOptions(
  targetChunk: string,
  allChunks: string[]
): string[] {
  const tokens = targetChunk.trim().split(/\s+/);
  const existingCores = new Set(
    tokens.map((t) => splitTokenPunctuation(t).core.toLowerCase())
  );

  // Extract candidate words from the passage + fallback pool
  const rawPool: string[] = [];
  for (const ch of allChunks) {
    for (const w of ch.split(/\s+/)) {
      const { core } = splitTokenPunctuation(w);
      if (core.length >= 2 && /^[A-Za-z'-]+$/.test(core)) {
        rawPool.push(core.toLowerCase());
      }
    }
  }
  for (const fw of FALLBACK_WORDS) {
    rawPool.push(fw);
  }
  const uniquePool = Array.from(new Set(rawPool));

  const usedReplacements = new Set<string>();

  const pickFoilForToken = (token: string): string => {
    const { core } = splitTokenPunctuation(token);
    const targetLen = core.length;

    // Prefer words within ±2 character length so word silhouette looks natural
    let candidates = uniquePool.filter(
      (w) =>
        !existingCores.has(w) &&
        !usedReplacements.has(w) &&
        Math.abs(w.length - targetLen) <= 2
    );
    if (candidates.length === 0) {
      candidates = uniquePool.filter(
        (w) => !existingCores.has(w) && !usedReplacements.has(w)
      );
    }
    const chosen =
      candidates[Math.floor(Math.random() * candidates.length)] || 'signal';
    usedReplacements.add(chosen);
    return matchCasingAndPunctuation(token, chosen);
  };

  let distractors: string[] = [];

  if (tokens.length === 1) {
    const f1 = pickFoilForToken(tokens[0]);
    const f2 = pickFoilForToken(tokens[0]);
    const f3 = pickFoilForToken(tokens[0]);
    distractors = [f1, f2, f3];
  } else if (tokens.length === 2) {
    // Symmetric 2x2 matrix: [W1 W2, W1 X2, X1 W2, X1 X2]
    // Neither the first word nor the second word alone reveals the answer!
    const [w1, w2] = tokens;
    const x1 = pickFoilForToken(w1);
    const x2 = pickFoilForToken(w2);
    distractors = [
      `${w1} ${x2}`, // Same 1st word, different 2nd word
      `${x1} ${w2}`, // Different 1st word, same 2nd word
      `${x1} ${x2}`, // Paired foil so each word appears twice
    ];
  } else if (tokens.length === 3) {
    // 3-word span: 3 of 4 choices share the 1st word, 3 share the middle, 3 share the last!
    const [w1, w2, w3] = tokens;
    const x1 = pickFoilForToken(w1);
    const x2 = pickFoilForToken(w2);
    const x3 = pickFoilForToken(w3);
    distractors = [
      `${w1} ${w2} ${x3}`, // Right-edge swap (tests right peripheral vision)
      `${w1} ${x2} ${w3}`, // Center swap (tests middle word)
      `${x1} ${w2} ${w3}`, // Left-edge swap (tests left peripheral vision)
    ];
  } else {
    // 4+ words: swap rightmost, inner-right, and leftmost words
    const lastIdx = tokens.length - 1;
    const midIdx = tokens.length - 2;
    const xFirst = pickFoilForToken(tokens[0]);
    const xMid = pickFoilForToken(tokens[midIdx]);
    const xLast = pickFoilForToken(tokens[lastIdx]);

    const dRight = [...tokens];
    dRight[lastIdx] = xLast;

    const dMid = [...tokens];
    dMid[midIdx] = xMid;

    const dLeft = [...tokens];
    dLeft[0] = xFirst;

    distractors = [dRight.join(' '), dMid.join(' '), dLeft.join(' ')];
  }

  const combined = [targetChunk, ...distractors];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined;
}

function renderFlashedOrpChunk(chunk: string) {
  const trimmed = chunk.trim();
  const cleanLength = trimmed.length;
  if (cleanLength === 0) return null;

  let pivotIdx = Math.max(
    0,
    Math.min(cleanLength - 1, Math.floor(cleanLength * 0.44))
  );
  if (trimmed[pivotIdx] === ' ') {
    if (pivotIdx + 1 < cleanLength && trimmed[pivotIdx + 1] !== ' ') {
      pivotIdx += 1;
    } else if (pivotIdx - 1 >= 0 && trimmed[pivotIdx - 1] !== ' ') {
      pivotIdx -= 1;
    }
  }

  const before = trimmed.slice(0, pivotIdx);
  const pivot = trimmed.charAt(pivotIdx);
  const after = trimmed.slice(pivotIdx + 1);

  return (
    <div className="text-lg sm:text-xl font-medium tracking-normal select-none w-full grid grid-cols-[1fr_auto_1fr] items-baseline overflow-hidden">
      <span className="text-[#00F5D4] text-right whitespace-pre">{before}</span>
      <span className="text-[#FF1E7A] font-bold border-b-2 border-[#FF1E7A] pb-0.5 whitespace-pre">
        {pivot}
      </span>
      <span className="text-[#00F5D4] text-left whitespace-pre">{after}</span>
    </div>
  );
}

export const TachistoscopeView: React.FC<TachistoscopeViewProps> = ({
  passage,
  targetWpm,
  onComplete,
}) => {
  const [round, setRound] = useState<number>(0);
  const [phase, setPhase] = useState<'ready' | 'flashing' | 'choosing'>('ready');
  const [targetChunk, setTargetChunk] = useState<string>('');
  const [precedingContext, setPrecedingContext] = useState<string>('');
  const [options, setOptions] = useState<string[]>([]);
  const [correctCount, setCorrectCount] = useState<number>(0);

  // Start at a comfortable ESL-friendly exposure (e.g. ~260-340ms) and adapt round-by-round
  const initialFlashMs = Math.max(
    200,
    Math.min(360, Math.round((2.6 / targetWpm) * 60000) + 45)
  );
  const [flashMs, setFlashMs] = useState<number>(initialFlashMs);
  const [spanLevel, setSpanLevel] = useState<number>(0); // 0 = short (7-14 chars), 1 = medium (11-18 chars), 2 = full (14-22 chars)

  const setupRound = useCallback(
    (roundIdx: number, targetSpanLevel: number) => {
      const maxChars =
        targetSpanLevel === 0 ? 14 : targetSpanLevel === 1 ? 18 : 22;
      const minChars = targetSpanLevel === 0 ? 6 : 8;

      const candidateIndices: number[] = [];
      passage.chunks.forEach((c, idx) => {
        const trimmed = c.trim();
        const wordCount = trimmed.split(/\s+/).length;
        if (
          wordCount >= 2 &&
          trimmed.length >= minChars &&
          trimmed.length <= maxChars
        ) {
          candidateIndices.push(idx);
        }
      });

      if (candidateIndices.length < 3) {
        passage.chunks.forEach((c, idx) => {
          const trimmed = c.trim();
          if (trimmed.length >= 6 && trimmed.length <= 22) {
            candidateIndices.push(idx);
          }
        });
      }

      const poolIndices =
        candidateIndices.length > 0
          ? candidateIndices
          : passage.chunks.map((_, idx) => idx);
      const chosenChunkIdx =
        poolIndices[(roundIdx * 5 + 2) % poolIndices.length];
      const target = passage.chunks[chosenChunkIdx];
      const prev =
        chosenChunkIdx > 0 ? passage.chunks[chosenChunkIdx - 1] : '';

      const combined = buildPeripheralSpanOptions(target, passage.chunks);
      setTargetChunk(target);
      setPrecedingContext(prev);
      setOptions(combined);
      setPhase('ready');
    },
    [passage.chunks]
  );

  useEffect(() => {
    setupRound(0, 0);
  }, [setupRound]);

  // Sequence: ready (500ms) -> flashing (flashMs) -> choosing
  useEffect(() => {
    if (phase === 'ready') {
      const t = window.setTimeout(() => {
        soundEngine.playChunkTick(true);
        setPhase('flashing');
      }, 500);
      return () => window.clearTimeout(t);
    }
    if (phase === 'flashing') {
      const t = window.setTimeout(() => {
        setPhase('choosing');
      }, flashMs);
      return () => window.clearTimeout(t);
    }
  }, [phase, flashMs]);

  const handleReflash = useCallback(() => {
    if (phase !== 'choosing') return;
    soundEngine.playUiClick();
    setFlashMs((ms) => Math.min(450, ms + 25));
    setPhase('ready');
  }, [phase]);

  const handlePick = useCallback(
    (picked: string) => {
      if (phase !== 'choosing') return;
      const isRight = picked === targetChunk;
      const nextCorrect = isRight ? correctCount + 1 : correctCount;

      const nextFlashMs = isRight
        ? Math.max(120, flashMs - 22)
        : Math.min(440, flashMs + 40);
      const nextSpanLevel = isRight
        ? Math.min(2, spanLevel + 1)
        : Math.max(0, spanLevel - 1);

      if (isRight) {
        soundEngine.playQuizCorrect(false);
      } else {
        soundEngine.playQuizWrong();
      }

      setFlashMs(nextFlashMs);
      setSpanLevel(nextSpanLevel);

      if (round + 1 < TOTAL_ROUNDS) {
        setCorrectCount(nextCorrect);
        const nextRound = round + 1;
        setRound(nextRound);
        setupRound(nextRound, nextSpanLevel);
      } else {
        onComplete(nextCorrect, TOTAL_ROUNDS, nextFlashMs);
      }
    },
    [
      phase,
      targetChunk,
      correctCount,
      round,
      setupRound,
      onComplete,
      flashMs,
      spanLevel,
    ]
  );

  // Number keys 1-4 shortcut + Space to Re-flash
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== 'choosing') return;
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
        const idx = Number(e.code.replace('Digit', '')) - 1;
        if (options[idx]) handlePick(options[idx]);
      } else if (e.code === 'Space') {
        e.preventDefault();
        handleReflash();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, options, handlePick, handleReflash]);

  const effectiveFlashWpm = Math.round((2.6 / flashMs) * 60000);

  return (
    <ChamferedPanel
      variant="cyan"
      cutSize={16}
      tag={`ADAPTIVE FLASH ${flashMs}ms (~${effectiveFlashWpm} WPM)`}
      title={`TACHISTOSCOPE DRILL // ROUND ${round + 1} OF ${TOTAL_ROUNDS}`}
      className="flex-1 flex flex-col justify-center"
      innerClassName="p-6 sm:p-10 justify-center"
    >
      <div className="max-w-2xl mx-auto w-full space-y-6 text-center">
        {/* Context Lead-in + Adaptive Span Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#180B29] border border-[#00F5D4]/30 font-terminal text-xs">
          <span className="text-[#6C7A89]">
            CONTEXT LEAD-IN:{' '}
            <strong className="text-[#F2F5F8]/85">
              {precedingContext ? `... ${precedingContext} →` : '(PASSAGE START) →'}
            </strong>
          </span>
          <span className="text-[#FFE600]">
            SPAN TIER: {spanLevel === 0 ? 'COMPACT' : spanLevel === 1 ? 'STANDARD' : 'WIDE'}
          </span>
        </div>

        {/* Flash Reticle Window */}
        <div className="h-32 bg-[#0D0618] border border-[#00F5D4]/50 flex items-center justify-center relative overflow-hidden px-3">
          <div className="absolute top-2 left-3 font-terminal text-[10px] text-[#6C7A89]">
            EXPOSURE: {flashMs} MS // LOCK GAZE ON MAGENTA PIVOT
          </div>
          {/* Subtle top/bottom center reticle ticks */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-2.5 bg-[#FF1E7A]/70" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-2.5 bg-[#FF1E7A]/70" />

          {phase === 'ready' && (
            <span className="font-terminal text-xs text-[#6C7A89] animate-pulse">
              [ KEEP EYES ON CENTER RETICLE ]
            </span>
          )}
          {phase === 'flashing' && renderFlashedOrpChunk(targetChunk)}
          {phase === 'choosing' && (
            <div className="flex items-center gap-3 font-terminal text-xs">
              <span className="text-[#FFE600]">
                SELECT MATCHING PHRASE (KEYS 1–4)
              </span>
              <button
                type="button"
                onClick={handleReflash}
                className="px-2.5 py-1 bg-[#180B29] border border-[#00F5D4]/60 text-[#00F5D4] hover:bg-[#00F5D4]/15 cursor-pointer"
              >
                RE-FLASH [SPACE]
              </button>
            </div>
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
