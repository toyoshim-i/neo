import { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Languages,
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
  targetWpm: number;
  setTargetWpm: (updater: (prev: number) => number) => void;
  activeWpm: number;
  activeChunkIndex: number;
  setActiveChunkIndex: (idx: number) => void;
  isPlaying: boolean;
  fadeOutPassed: boolean;
  sessionResetKey: number;
  onAbort: () => void;
  onTogglePlayPause: () => void;
  onIncrementRegression: () => void;
  onTranslateChunkOrWord: (
    queryText: string,
    chunkIdx: number,
    baseChunkText?: string,
    anchorRect?: { x: number; top: number; bottom: number }
  ) => void;
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

  const sizeClass =
    cleanLength > 24
      ? 'text-lg sm:text-3xl'
      : cleanLength > 17
      ? 'text-xl sm:text-4xl'
      : 'text-2xl sm:text-5xl';

  return (
    <div
      className={`font-terminal ${sizeClass} font-bold tracking-wide select-none w-full grid grid-cols-[1fr_auto_1fr] items-baseline overflow-hidden`}
    >
      <span className="text-[#F2F5F8] text-right whitespace-pre">{before}</span>
      <span className="text-[#FF1E7A] border-b-2 border-[#FF1E7A] pb-0.5 whitespace-pre">
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
        ? 'text-[#FF1E7A] font-extrabold'
        : 'text-[#FF1E7A]/80 font-bold';
    } else if (isFunction) {
      wordClass = isActive
        ? 'text-[#F2F5F8]/45 font-normal text-[0.92em]'
        : 'text-[#6C7A89]/40 font-normal text-[0.92em]';
    } else {
      wordClass = isActive
        ? 'text-[#00F5D4] font-bold'
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
              ? 'text-[#00F5D4] font-extrabold'
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
  targetWpm,
  setTargetWpm,
  activeWpm,
  activeChunkIndex,
  setActiveChunkIndex,
  isPlaying,
  fadeOutPassed,
  sessionResetKey,
  onAbort,
  onTogglePlayPause,
  onIncrementRegression,
  onTranslateChunkOrWord,
  onStartQuizPhase,
  onCompleteTachistoscope,
}: ReadingScreenProps) {
  const activeSaccadeRowRef = useRef<HTMLDivElement | null>(null);
  const activeSaccadeRowIdx = Math.floor(activeChunkIndex / 3);

  useEffect(() => {
    if (selectedMode === 'saccade_rail' && activeSaccadeRowRef.current) {
      activeSaccadeRowRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedMode, activeSaccadeRowIdx]);

  // Group chunks into 3-column rows for Saccade Rail mode
  const saccadeRows: Array<Array<{ chunk: string; idx: number }>> = [];
  if (selectedMode === 'saccade_rail') {
    for (let i = 0; i < selectedPassage.chunks.length; i += 3) {
      const row: Array<{ chunk: string; idx: number }> = [];
      for (let c = 0; c < 3 && i + c < selectedPassage.chunks.length; c++) {
        row.push({ chunk: selectedPassage.chunks[i + c], idx: i + c });
      }
      saccadeRows.push(row);
    }
  }

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col justify-between gap-5 relative z-20">
      {/* Top Reading Control Bar & Ghost Racing Bar */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#180B29] border border-[#00F5D4]/40 px-4 py-2.5 font-terminal text-xs">
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

        {/* Ghost Laser Racing Bar (YOU vs AVG 238 vs SELF BEST) */}
        {selectedMode !== 'tachistoscope' && (
          <GhostRacingBar
            userProgress={
              ((activeChunkIndex + 1) / selectedPassage.chunks.length) * 100
            }
            totalWords={selectedPassage.wordCount}
            bestEffectiveWpm={profile.bestEffectiveWpm}
            isPlaying={isPlaying}
            resetKey={sessionResetKey}
          />
        )}
      </div>

      {/* Center Reading Viewport */}
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
            <div className="py-16 flex flex-col items-center justify-center space-y-6">
              <div className="w-48 h-px bg-[#FF1E7A]/40 relative">
                <div className="w-0.5 h-3 bg-[#FF1E7A] absolute left-1/2 -top-1.5" />
              </div>
              {renderRsvpChunk(selectedPassage.chunks[activeChunkIndex] || '')}
              <div className="w-48 h-px bg-[#FF1E7A]/40 relative">
                <div className="w-0.5 h-3 bg-[#FF1E7A] absolute left-1/2 -bottom-1.5" />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  onTranslateChunkOrWord(
                    selectedPassage.chunks[activeChunkIndex] || '',
                    activeChunkIndex,
                    selectedPassage.chunks[activeChunkIndex] || '',
                    {
                      x: rect.left + rect.width / 2,
                      top: rect.top,
                      bottom: rect.bottom,
                    }
                  );
                }}
                className="cyber-btn px-3 py-1 bg-[#0D0618] border border-[#00F5D4]/50 text-[#00F5D4] font-terminal text-xs flex items-center gap-1.5 hover:bg-[#00F5D4]/15"
              >
                <Languages className="w-3.5 h-3.5" />
                <span>TRANSLATE CHUNK</span>
              </button>
            </div>
          ) : selectedMode === 'saccade_rail' ? (
            <div className="space-y-4">
              {/* 3-Column Fixation Rail Header */}
              <div className="grid grid-cols-3 gap-2 font-terminal text-[10px] text-[#6C7A89] border-b border-[#00F5D4]/20 pb-2 text-center">
                {[
                  'RAIL L // FIXATION 01',
                  'RAIL C // FIXATION 02',
                  'RAIL R // FIXATION 03',
                ].map((label, colIdx) => {
                  const isCurrentCol = activeChunkIndex % 3 === colIdx;
                  return (
                    <div
                      key={label}
                      className={`flex flex-col items-center gap-1 transition-colors ${
                        isCurrentCol
                          ? 'text-[#00F5D4] font-bold'
                          : 'text-[#6C7A89]'
                      }`}
                    >
                      <span>{label}</span>
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          isCurrentCol
                            ? 'bg-[#00F5D4] shadow-[0_0_8px_#00F5D4]'
                            : 'bg-[#6C7A89]/40'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* 3-Column Saccade Matrix */}
              <div className="max-h-[54vh] overflow-y-auto pr-1 space-y-2.5 select-none">
                {saccadeRows.map((row, rIdx) => {
                  const isActiveRow = rIdx === activeSaccadeRowIdx;
                  const isPassedRow = rIdx < activeSaccadeRowIdx;
                  return (
                    <div
                      key={rIdx}
                      ref={isActiveRow ? activeSaccadeRowRef : undefined}
                      style={{
                        opacity: isPassedRow && fadeOutPassed ? 0.16 : 1,
                      }}
                      className={`grid grid-cols-3 gap-2 sm:gap-4 items-center py-2 px-2 border transition-colors ${
                        isActiveRow
                          ? 'bg-[#180B29]/90 border-[#00F5D4]/40'
                          : 'bg-[#0D0618]/40 border-transparent'
                      }`}
                    >
                      {[0, 1, 2].map((colIdx) => {
                        const cell = row[colIdx];
                        if (!cell) {
                          return <div key={colIdx} />;
                        }
                        const isActive = cell.idx === activeChunkIndex;
                        const isMarker =
                          selectedPassage.discourseMarkerIndices.includes(
                            cell.idx
                          );
                        return (
                          <div
                            key={cell.idx}
                            className="flex flex-col items-center text-center relative"
                          >
                            <div
                              className={`w-1 h-1 mb-1 rounded-full ${
                                isActive
                                  ? isMarker
                                    ? 'bg-[#FF1E7A]'
                                    : 'bg-[#00F5D4]'
                                  : 'bg-[#6C7A89]/30'
                              }`}
                            />
                            <span
                              data-chunk-interactive="true"
                              onClick={(e) => {
                                const rect =
                                  e.currentTarget.getBoundingClientRect();
                                if (cell.idx < activeChunkIndex) {
                                  onIncrementRegression();
                                }
                                setActiveChunkIndex(cell.idx);
                                onTranslateChunkOrWord(
                                  cell.chunk,
                                  cell.idx,
                                  cell.chunk,
                                  {
                                    x: rect.left + rect.width / 2,
                                    top: rect.top,
                                    bottom: rect.bottom,
                                  }
                                );
                              }}
                              title="Tap to pause & translate"
                              className={`inline-block whitespace-nowrap px-2 py-0.5 border-b-2 text-sm sm:text-lg font-medium cursor-pointer transition-colors duration-75 ${
                                isActive
                                  ? isMarker
                                    ? 'bg-[#FF1E7A]/20 border-[#FF1E7A] text-[#F2F5F8] font-bold'
                                    : 'bg-[#00F5D4]/20 border-[#00F5D4] text-[#F2F5F8] font-bold'
                                  : isActiveRow
                                  ? 'border-transparent text-[#F2F5F8]/75'
                                  : 'border-transparent text-[#6C7A89]'
                              }`}
                            >
                              {cell.chunk}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedMode === 'syntax_skimmer' && (
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#00F5D4]/20 font-terminal text-[10px] text-[#6C7A89]">
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
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#00F5D4]/20 font-terminal text-[10px] text-[#6C7A89]">
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

              <div className="pretty-text leading-[2.2] text-lg sm:text-xl font-medium select-none">
                {selectedPassage.chunks.map((chunk, idx) => {
                  const isActive = idx === activeChunkIndex;
                  const isPassed = idx < activeChunkIndex;
                  const isMarker =
                    selectedPassage.discourseMarkerIndices.includes(idx);

                  return (
                    <span key={idx}>
                      <span
                        data-chunk-interactive="true"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          if (idx < activeChunkIndex) {
                            onIncrementRegression();
                          }
                          setActiveChunkIndex(idx);
                          onTranslateChunkOrWord(chunk, idx, chunk, {
                            x: rect.left + rect.width / 2,
                            top: rect.top,
                            bottom: rect.bottom,
                          });
                        }}
                        title="Tap to pause & translate"
                        style={{
                          opacity: isPassed && fadeOutPassed ? 0.15 : 1,
                        }}
                        className={`inline whitespace-nowrap py-0.5 border-b-2 cursor-pointer transition-colors duration-75 ${
                          isActive
                            ? isMarker
                              ? 'bg-[#FF1E7A]/15 border-[#FF1E7A] text-[#F2F5F8]'
                              : 'bg-[#00F5D4]/15 border-[#00F5D4] text-[#F2F5F8]'
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
        </ChamferedPanel>
      )}

      {/* Minimal Footer Hint & Skip to Quiz */}
      {selectedMode !== 'tachistoscope' && (
        <div className="flex items-center justify-between font-terminal text-xs text-[#6C7A89]">
          <span>
            [TAP CHUNK] TRANSLATE &nbsp;·&nbsp; [SPACE] PAUSE/PLAY &nbsp;·&nbsp;
            [←/→] STEP
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
