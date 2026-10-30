import { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  MousePointerClick,
  Pause,
  Play,
} from 'lucide-react';
import { LOW_COST_FUNCTION_WORDS, MODE_INFO } from '../../lib/pacing';
import { soundEngine } from '../../lib/soundEngine';
import {
  TrainingMode,
  TrainingPassage,
  UserProfile,
} from '../../types/schema';
import { ChamferedPanel } from '../layout/ChamferedPanel';
import { GhostRacingBar } from '../reader/GhostRacingBar';
import { TachistoscopeView } from '../reader/TachistoscopeView';

const SYNTAX_FUNCTION_WORDS = new Set([
  ...LOW_COST_FUNCTION_WORDS,
  'during',
  'between',
  'through',
  'under',
  'without',
  'within',
  'among',
  'against',
  'toward',
  'towards',
  'about',
  'above',
  'below',
  'over',
  'after',
  'before',
  'since',
  'until',
  'while',
  'where',
  'when',
  'which',
  'who',
  'whom',
  'whose',
  'what',
  'whether',
  'have',
  'has',
  'had',
  'having',
  'being',
  'will',
  'would',
  'shall',
  'should',
  'could',
  'might',
  'must',
  'their',
  'there',
  'they',
  'them',
  'then',
  'than',
  'your',
  'our',
  'his',
  'her',
  'him',
  'she',
  'he',
  'we',
  'you',
  'some',
  'any',
  'each',
  'every',
  'either',
  'neither',
  'both',
  'such',
  'very',
  'more',
  'most',
  'other',
  'another',
  'also',
  'just',
  'only',
  'even',
]);

const DISCOURSE_PIVOT_WORDS = new Set([
  'however',
  'therefore',
  'consequently',
  'nevertheless',
  'furthermore',
  'moreover',
  'conversely',
  'ultimately',
  'instead',
  'nonetheless',
  'meanwhile',
  'thus',
  'hence',
  'contrast',
  'although',
  'whereas',
  'despite',
]);

interface ReadingScreenProps {
  selectedMode: TrainingMode;
  selectedPassage: TrainingPassage;
  profile: UserProfile;
  hasGhost: boolean;
  hasStartedPacing: boolean;
  targetWpm: number;
  setTargetWpm: (updater: (prev: number) => number) => void;
  activeWpm: number;
  activeChunkIndex: number;
  ghostChunkIndex: number;
  onAdvanceChunk: () => void;
  isPlaying: boolean;
  fadeOutPassed: boolean;
  sessionResetKey: number;
  onAbort: () => void;
  onTogglePlayPause: () => void;
  onStartQuizPhase: () => void;
  onCompleteTachistoscope: (
    correctRounds: number,
    totalRounds: number,
    flashMs: number
  ) => void;
}

function renderRsvpChunk(chunk: string) {
  const trimmed = chunk.trim();
  const cleanLength = trimmed.length;
  if (cleanLength === 0) return null;

  // Place pivot near ~44% of chunk length so left & right halves stay balanced
  // inside the centered reticle, and ensure pivot never lands on a whitespace char.
  let pivotIdx = Math.max(0, Math.min(cleanLength - 1, Math.floor(cleanLength * 0.44)));
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
      <span className="text-[#F2F5F8] text-right whitespace-pre">{before}</span>
      <span className="text-[#FF1E7A] font-bold border-b-2 border-[#FF1E7A] pb-0.5 whitespace-pre">
        {pivot}
      </span>
      <span className="text-[#F2F5F8] text-left whitespace-pre">{after}</span>
    </div>
  );
}

/**
 * SYNTAX SKIMMER: Dims low-cost grammar function words and highlights content words
 * (nouns/verbs/adjectives) and discourse markers so the S-V-O skeleton pops out.
 */
function renderSyntaxSkimmerChunk(
  chunk: string,
  isActive: boolean,
  isChunkMarker: boolean
) {
  const words = chunk.split(' ');
  return words.map((word, wIdx) => {
    const clean = word.replace(/[^A-Za-z]/g, '').toLowerCase();
    const isPivot =
      DISCOURSE_PIVOT_WORDS.has(clean) ||
      (isChunkMarker && clean === 'contrast');
    const isFunction = !isPivot && SYNTAX_FUNCTION_WORDS.has(clean);

    let wordClass = '';
    if (isPivot) {
      wordClass = isActive
        ? 'text-[#FF1E7A] font-bold'
        : 'text-[#FF1E7A]/80 font-bold';
    } else if (isFunction) {
      wordClass = isActive
        ? 'text-[#F2F5F8]/45 font-normal'
        : 'text-[#6C7A89]/40 font-normal';
    } else {
      wordClass = isActive
        ? 'text-[#00F5D4] font-semibold'
        : 'text-[#F2F5F8]/80 font-semibold';
    }

    return (
      <span key={wIdx} className={wordClass}>
        {word}
        {wIdx < words.length - 1 ? ' ' : ''}
      </span>
    );
  });
}

/**
 * LEXICAL ANCHOR: Emphasizes the leading ~42% root characters of content words
 * so ESL readers predict whole words from their initial anchor instead of spelling suffixes.
 */
function renderLexicalAnchorChunk(chunk: string, isActive: boolean) {
  const words = chunk.split(' ');
  return words.map((word, wIdx) => {
    const clean = word.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    const isShortFunction =
      clean.length <= 3 || LOW_COST_FUNCTION_WORDS.has(clean);

    if (isShortFunction) {
      return (
        <span
          key={wIdx}
          className={
            isActive
              ? 'text-[#F2F5F8]/55 font-normal'
              : 'text-[#6C7A89]/55 font-normal'
          }
        >
          {word}
          {wIdx < words.length - 1 ? ' ' : ''}
        </span>
      );
    }

    // Find split index after leading ~42% of alphanumeric characters
    const targetAlphaCount = Math.max(2, Math.ceil(clean.length * 0.42));
    let alphaSeen = 0;
    let splitIdx = 0;
    for (let i = 0; i < word.length; i++) {
      if (/[A-Za-z0-9]/.test(word[i])) {
        alphaSeen++;
      }
      splitIdx = i + 1;
      if (alphaSeen >= targetAlphaCount) break;
    }

    const head = word.slice(0, splitIdx);
    const tail = word.slice(splitIdx);

    return (
      <span key={wIdx}>
        <span
          className={
            isActive
              ? 'text-[#00F5D4] font-bold'
              : 'text-[#F2F5F8]/90 font-bold'
          }
        >
          {head}
        </span>
        <span
          className={
            isActive
              ? 'text-[#F2F5F8]/50 font-normal'
              : 'text-[#6C7A89]/50 font-normal'
          }
        >
          {tail}
        </span>
        {wIdx < words.length - 1 ? ' ' : ''}
      </span>
    );
  });
}

export function ReadingScreen({
  selectedMode,
  selectedPassage,
  profile,
  hasGhost,
  hasStartedPacing,
  targetWpm,
  setTargetWpm,
  activeWpm,
  activeChunkIndex,
  ghostChunkIndex,
  onAdvanceChunk,
  isPlaying,
  fadeOutPassed,
  sessionResetKey,
  onAbort,
  onTogglePlayPause,
  onStartQuizPhase,
  onCompleteTachistoscope,
}: ReadingScreenProps) {
  const activeChunkRef = useRef<HTMLElement | null>(null);
  const stickyHudRef = useRef<HTMLDivElement | null>(null);
  const chunkDelta = activeChunkIndex - ghostChunkIndex;
  const hasCustomGhostWeights = Boolean(
    profile.passageRecords?.[selectedPassage.id]?.bestChunkWeights?.length
  );

  // Keep the active chunk comfortably visible below the sticky HUD as the user advances
  useEffect(() => {
    if (
      selectedMode === 'tachistoscope' ||
      selectedMode === 'rsvp' ||
      !activeChunkRef.current
    ) {
      return;
    }
    const el = activeChunkRef.current;
    const rect = el.getBoundingClientRect();
    const hudBottom =
      stickyHudRef.current?.getBoundingClientRect().bottom ?? 220;
    const topThreshold = hudBottom + 28;
    const bottomThreshold = window.innerHeight - 120;

    if (rect.top < topThreshold || rect.bottom > bottomThreshold) {
      const targetScrollY =
        window.scrollY +
        rect.top -
        Math.max(topThreshold + 24, (window.innerHeight + hudBottom) * 0.42);
      window.scrollTo({
        top: Math.max(0, targetScrollY),
        behavior: 'smooth',
      });
    }
  }, [selectedMode, activeChunkIndex]);

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 pb-8 flex flex-col justify-between gap-4 relative z-20">
      {/* Sticky Upper HUD: Control Bar + Ghost Racing Bar + Mode Status & Legend */}
      <div
        ref={stickyHudRef}
        className="sticky top-14 z-30 bg-[#0D0618]/95 backdrop-blur-md pt-3 pb-2.5 border-b border-[#00F5D4]/25 space-y-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#180B29] border border-[#00F5D4]/40 px-4 py-2 font-terminal text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onAbort();
              }}
              className="flex items-center gap-1.5 text-[#6C7A89] hover:text-[#F2F5F8] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ABORT</span>
            </button>

            <span className="hidden sm:inline-block px-2 py-0.5 bg-[#0D0618] border border-[#00F5D4]/40 text-[#00F5D4] text-[10px] font-bold">
              {MODE_INFO[selectedMode].label} //{' '}
              {MODE_INFO[selectedMode].shortTag}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {hasGhost || selectedMode === 'tachistoscope' ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTargetWpm((w) => Math.max(60, w - 10))}
                  className="px-1.5 py-0.5 bg-[#0D0618] border border-[#00F5D4]/40 text-[#00F5D4] cursor-pointer hover:bg-[#00F5D4]/15"
                >
                  -10
                </button>
                <button
                  type="button"
                  onClick={() => setTargetWpm((w) => Math.max(60, w - 1))}
                  className="px-1.5 py-0.5 bg-[#0D0618] border border-[#6C7A89]/40 text-[#F2F5F8] cursor-pointer hover:border-[#00F5D4]"
                >
                  -1
                </button>
                <span className="text-[#00F5D4] font-bold min-w-[72px] text-center">
                  {activeWpm} WPM
                </span>
                <button
                  type="button"
                  onClick={() => setTargetWpm((w) => Math.min(900, w + 1))}
                  className="px-1.5 py-0.5 bg-[#0D0618] border border-[#6C7A89]/40 text-[#F2F5F8] cursor-pointer hover:border-[#00F5D4]"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => setTargetWpm((w) => Math.min(900, w + 10))}
                  className="px-1.5 py-0.5 bg-[#0D0618] border border-[#00F5D4]/40 text-[#00F5D4] cursor-pointer hover:bg-[#00F5D4]/15"
                >
                  +10
                </button>
              </div>
            ) : (
              <span className="px-2 py-0.5 bg-[#0D0618] border border-[#FFE600]/50 text-[#FFE600] text-[10px] font-bold">
                1ST RUN // RECORDING GHOST
              </span>
            )}

            {selectedMode !== 'tachistoscope' && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onTogglePlayPause();
                }}
                className="cyber-btn px-3 py-1 bg-[#00F5D4] text-[#0D0618] font-bold flex items-center gap-1"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>PAUSE</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>RESUME</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Ghost Laser Racing Bar (YOU vs GHOST vs SELF BEST) */}
        {selectedMode !== 'tachistoscope' && (
          <GhostRacingBar
            userProgress={
              ((activeChunkIndex + 1) / selectedPassage.chunks.length) * 100
            }
            ghostProgress={
              ((ghostChunkIndex + 1) / selectedPassage.chunks.length) * 100
            }
            hasGhost={hasGhost}
            targetWpm={activeWpm}
            totalWords={selectedPassage.wordCount}
            bestEffectiveWpm={profile.bestEffectiveWpm}
            isPlaying={isPlaying && hasStartedPacing}
            resetKey={sessionResetKey}
          />
        )}

        {/* Sticky Double-Cursor Status & Mode-Specific Header */}
        {selectedMode !== 'tachistoscope' && (
          <div className="px-3 py-2 bg-[#180B29]/90 border border-[#00F5D4]/30 font-terminal text-[10px] space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-[#00F5D4] font-bold">
                  ■ YOU ({activeChunkIndex + 1}/{selectedPassage.chunks.length})
                </span>
                {hasGhost ? (
                  <span className="text-[#FFE600] font-bold">
                    ▫ {hasCustomGhostWeights ? 'PB GHOST' : 'GHOST'} (
                    {hasStartedPacing
                      ? `${ghostChunkIndex + 1}/${selectedPassage.chunks.length} @ ${activeWpm} WPM`
                      : `STANDBY @ ${activeWpm} WPM`}
                    )
                  </span>
                ) : (
                  <span className="text-[#FFE600] font-bold">
                    ◌ NO GHOST YET (READ AT YOUR OWN PACE TO GENERATE GHOST)
                  </span>
                )}
              </div>
              {!hasStartedPacing ? (
                <span className="px-2 py-0.5 border border-[#FFE600] bg-[#FFE600]/20 text-[#FFE600] font-bold flex items-center gap-1 animate-pulse">
                  <MousePointerClick className="w-3 h-3" />
                  <span>TAP / SPACE TO START</span>
                </span>
              ) : hasGhost ? (
                <span
                  className={`px-2 py-0.5 border font-bold ${
                    chunkDelta > 0
                      ? 'border-[#00F5D4]/60 bg-[#00F5D4]/15 text-[#00F5D4]'
                      : chunkDelta === 0
                      ? 'border-[#FFE600]/60 bg-[#FFE600]/15 text-[#FFE600]'
                      : 'border-[#FF1E7A]/60 bg-[#FF1E7A]/15 text-[#FF1E7A]'
                  }`}
                >
                  {chunkDelta > 0
                    ? `▲ +${chunkDelta} AHEAD OF GHOST`
                    : chunkDelta === 0
                    ? '● NECK & NECK WITH GHOST'
                    : `▼ ${chunkDelta} BEHIND GHOST`}
                </span>
              ) : (
                <span className="px-2 py-0.5 border border-[#00F5D4]/50 bg-[#00F5D4]/10 text-[#00F5D4] font-bold">
                  ● RECORDING GHOST PACE
                </span>
              )}
            </div>

            {selectedMode === 'saccade_rail' && (
              <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-[#00F5D4]/20 text-[#6C7A89]">
                {[
                  { label: 'RAIL L // STEP 01', align: 'items-start text-left' },
                  {
                    label: 'RAIL C // STEP 02',
                    align: 'items-center text-center',
                  },
                  { label: 'RAIL R // STEP 03', align: 'items-end text-right' },
                ].map((rail, colIdx) => {
                  const isCurrentCol = activeChunkIndex % 3 === colIdx;
                  return (
                    <div
                      key={rail.label}
                      className={`flex items-center gap-1.5 ${
                        colIdx === 1
                          ? 'justify-center'
                          : colIdx === 2
                          ? 'justify-end'
                          : 'justify-start'
                      } transition-colors ${
                        isCurrentCol
                          ? 'text-[#00F5D4] font-bold'
                          : 'text-[#6C7A89]'
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isCurrentCol
                            ? 'bg-[#00F5D4] shadow-[0_0_8px_#00F5D4]'
                            : 'bg-[#6C7A89]/40'
                        }`}
                      />
                      <span>{rail.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedMode === 'syntax_skimmer' && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#00F5D4]/20 text-[#6C7A89]">
                <span>
                  SYNTAX SKIMMER // FOCUS ON CONTENT WORDS &amp; LOGIC PIVOTS
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[#00F5D4] font-bold">
                    ■ CONTENT (S-V-O)
                  </span>
                  <span className="text-[#FF1E7A] font-bold">
                    ■ LOGIC PIVOT
                  </span>
                  <span className="text-[#6C7A89]/60">□ FUNCTION (SKIP)</span>
                </div>
              </div>
            )}

            {selectedMode === 'lexical_anchor' && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#00F5D4]/20 text-[#6C7A89]">
                <span>
                  LEXICAL ANCHOR // FIXATE ON BOLD ROOT PREFIXES &amp; PREDICT
                  SUFFIXES
                </span>
                <span className="text-[#00F5D4] font-bold">
                  <strong className="text-[#00F5D4]">ANCH</strong>
                  <span className="opacity-45">OR PREDICTION</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scrollable Reading Body & Bottom Controls */}
      {selectedMode === 'tachistoscope' ? (
        <TachistoscopeView
          passage={selectedPassage}
          targetWpm={targetWpm}
          onComplete={onCompleteTachistoscope}
        />
      ) : (
        <ChamferedPanel
          variant="cyan"
          cutSize={16}
          className="flex-1 flex flex-col justify-center"
          innerClassName="justify-center p-6 sm:p-10"
        >
          {selectedMode === 'rsvp' ? (
            <div
              onClick={onAdvanceChunk}
              title="Click or press SPACE to advance chunk"
              className="py-10 flex flex-col items-center justify-center space-y-5 cursor-pointer"
            >
              <div className="w-64 sm:w-80 py-6 bg-[#0D0618]/80 border-y border-[#FF1E7A]/40 relative flex items-center justify-center">
                {!hasStartedPacing && (
                  <span className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1 px-2 py-0.5 bg-[#FFE600] text-[#0D0618] font-terminal text-[10px] leading-none font-extrabold whitespace-nowrap animate-pulse shadow-[0_0_12px_rgba(255,230,0,0.5)]">
                    <MousePointerClick className="w-3 h-3" />
                    <span>TAP / SPACE TO START</span>
                  </span>
                )}
                <div className="w-0.5 h-2.5 bg-[#FF1E7A] absolute left-1/2 top-0 -translate-x-1/2" />
                {renderRsvpChunk(
                  selectedPassage.chunks[activeChunkIndex] || ''
                )}
                <div className="w-0.5 h-2.5 bg-[#FF1E7A] absolute left-1/2 bottom-0 -translate-x-1/2" />
              </div>
            </div>
          ) : selectedMode === 'saccade_rail' ? (
            <div
              onClick={onAdvanceChunk}
              className="space-y-1.5 cursor-pointer px-2 sm:px-4 select-none relative"
            >
              {/* Stepped Spiral Staircase Lines (Left -> Next Line Center -> Next Line Right) */}
              {selectedPassage.chunks.map((chunk, idx) => {
                const colIdx = idx % 3;
                const isActive = idx === activeChunkIndex;
                const isGhost =
                  hasGhost && hasStartedPacing && idx === ghostChunkIndex;
                const isPassed = idx < activeChunkIndex;
                const isCurrentCycle =
                  Math.floor(idx / 3) === Math.floor(activeChunkIndex / 3);
                const isMarker =
                  selectedPassage.discourseMarkerIndices.includes(idx);

                const justifyClass =
                  colIdx === 0
                    ? 'justify-start text-left'
                    : colIdx === 1
                    ? 'justify-center text-center'
                    : 'justify-end text-right';

                return (
                  <div
                    key={idx}
                    ref={isActive ? (el) => { activeChunkRef.current = el; } : undefined}
                    style={{
                      opacity:
                        isPassed && !isGhost && fadeOutPassed ? 0.16 : 1,
                    }}
                    className={`flex ${justifyClass} py-1 transition-colors ${
                      colIdx === 2 && idx < selectedPassage.chunks.length - 1
                        ? 'border-b border-[#00F5D4]/10 pb-2.5 mb-1'
                        : ''
                    }`}
                  >
                    <span
                      title="Click anywhere or press SPACE to advance chunk"
                      className={`relative inline-block whitespace-nowrap px-2.5 py-0.5 border-b-2 text-base sm:text-xl font-medium cursor-pointer transition-colors duration-75 ${
                        isActive && isGhost
                          ? 'bg-[#00F5D4]/20 border-[#00F5D4] border-t-2 border-t-[#FFE600] text-[#F2F5F8]'
                          : isActive
                          ? isMarker
                            ? 'bg-[#FF1E7A]/20 border-[#FF1E7A] text-[#F2F5F8]'
                            : 'bg-[#00F5D4]/20 border-[#00F5D4] text-[#F2F5F8]'
                          : isGhost
                          ? 'bg-[#FFE600]/15 border-dashed border-[#FFE600] text-[#FFE600]'
                          : isCurrentCycle
                          ? 'bg-[#180B29]/50 border-transparent text-[#F2F5F8]/80'
                          : 'border-transparent text-[#6C7A89]'
                      }`}
                    >
                      {chunk}
                      {idx === 0 && !hasStartedPacing && (
                        <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-20 inline-flex items-center gap-1 px-2 py-0.5 bg-[#FFE600] text-[#0D0618] font-terminal text-[10px] leading-none font-extrabold whitespace-nowrap animate-pulse shadow-[0_0_12px_rgba(255,230,0,0.5)]">
                          <MousePointerClick className="w-3 h-3" />
                          <span>TAP / SPACE</span>
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              onClick={onAdvanceChunk}
              className="space-y-4 cursor-pointer"
            >
              <div className="pretty-text leading-[2.2] text-lg sm:text-xl font-medium select-none">
                {selectedPassage.chunks.map((chunk, idx) => {
                  const isActive = idx === activeChunkIndex;
                  const isGhost =
                    hasGhost && hasStartedPacing && idx === ghostChunkIndex;
                  const isPassed = idx < activeChunkIndex;
                  const isMarker =
                    selectedPassage.discourseMarkerIndices.includes(idx);

                  return (
                    <span
                      key={idx}
                      ref={isActive ? (el) => { activeChunkRef.current = el; } : undefined}
                      className="relative inline"
                    >
                      {idx === 0 && !hasStartedPacing && (
                        <span className="pointer-events-none absolute -top-5 left-0 z-20 inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#FFE600] text-[#0D0618] font-terminal text-[9px] leading-none font-extrabold whitespace-nowrap animate-pulse shadow-[0_0_12px_rgba(255,230,0,0.5)]">
                          <MousePointerClick className="w-2.5 h-2.5" />
                          <span>TAP / SPACE</span>
                        </span>
                      )}
                      <span
                        title="Click or press SPACE to advance chunk"
                        style={{
                          opacity:
                            isPassed && !isGhost && fadeOutPassed ? 0.15 : 1,
                        }}
                        className={`inline whitespace-nowrap py-0.5 border-b-2 cursor-pointer transition-colors duration-75 ${
                          isActive && isGhost
                            ? 'bg-[#00F5D4]/20 border-[#00F5D4] border-t-2 border-t-[#FFE600] text-[#F2F5F8]'
                            : isActive
                            ? isMarker
                              ? 'bg-[#FF1E7A]/15 border-[#FF1E7A] text-[#F2F5F8]'
                              : 'bg-[#00F5D4]/15 border-[#00F5D4] text-[#F2F5F8]'
                            : isGhost
                            ? 'bg-[#FFE600]/15 border-dashed border-[#FFE600] text-[#FFE600]'
                            : 'bg-transparent border-transparent text-[#6C7A89]'
                        }`}
                      >
                        {selectedMode === 'syntax_skimmer'
                          ? renderSyntaxSkimmerChunk(chunk, isActive, isMarker)
                          : selectedMode === 'lexical_anchor'
                          ? renderLexicalAnchorChunk(chunk, isActive)
                          : chunk}
                      </span>{' '}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Prominent Chunk Advance Action Bar */}
          <div className="mt-5 pt-4 border-t border-[#00F5D4]/20 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onAdvanceChunk}
              className="cyber-btn flex-1 py-3 px-4 bg-[#00F5D4] text-[#0D0618] font-bold text-sm tracking-wider flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(0,245,212,0.25)]"
            >
              {!hasStartedPacing && (
                <MousePointerClick className="w-4 h-4 animate-bounce" />
              )}
              <span>
                {!hasStartedPacing
                  ? `TAP / SPACE TO START & NEXT CHUNK (1/${selectedPassage.chunks.length})`
                  : activeChunkIndex < selectedPassage.chunks.length - 1
                  ? `NEXT CHUNK (${activeChunkIndex + 1}/${selectedPassage.chunks.length}) [CLICK / SPACE / →]`
                  : 'FINISH PASSAGE → VERIFY [CLICK / SPACE]'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </ChamferedPanel>
      )}

      {/* Minimal Footer Hint & Skip to Quiz */}
      {selectedMode !== 'tachistoscope' && (
        <div className="flex items-center justify-between font-terminal text-xs text-[#6C7A89]">
          <span>
            [CLICK / SPACE / →] ADVANCE CHUNK &nbsp;·&nbsp; [P] PAUSE
            &nbsp;·&nbsp; [←] STEP BACK
          </span>
          <button
            type="button"
            onClick={onStartQuizPhase}
            className="cyber-btn px-3 py-1.5 bg-[#180B29] border border-[#FFE600]/60 text-[#FFE600] hover:bg-[#FFE600]/15 flex items-center gap-1"
          >
            <span>FINISH → QUIZ</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </main>
  );
}
