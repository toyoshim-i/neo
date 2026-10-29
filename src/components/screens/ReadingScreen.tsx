import {
  ArrowLeft,
  ChevronRight,
  Languages,
  Pause,
  Play,
} from 'lucide-react';
import { soundEngine } from '../../lib/soundEngine';
import {
  TrainingMode,
  TrainingPassage,
  UserProfile,
} from '../../types/schema';
import { ChamferedPanel } from '../layout/ChamferedPanel';
import { GhostRacingBar } from '../reader/GhostRacingBar';
import { TachistoscopeView } from '../reader/TachistoscopeView';

interface ReadingScreenProps {
  selectedMode: TrainingMode;
  selectedPassage: TrainingPassage;
  profile: UserProfile;
  targetWpm: number;
  setTargetWpm: (updater: (prev: number) => number) => void;
  activeWpm: number;
  activeChunkIndex: number;
  setActiveChunkIndex: (idx: number) => void;
  overclockPass: 1 | 2 | 3;
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

export function ReadingScreen({
  selectedMode,
  selectedPassage,
  profile,
  targetWpm,
  setTargetWpm,
  activeWpm,
  activeChunkIndex,
  setActiveChunkIndex,
  overclockPass,
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
  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col justify-between gap-5 relative z-20">
      {/* Top Reading Control Bar & Ghost Racing Bar */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#180B29] border border-[#00F5D4]/40 px-4 py-2.5 font-terminal text-xs">
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

          {selectedMode === 'overclock_432' && (
            <div className="px-2.5 py-0.5 bg-[#FF1E7A]/20 border border-[#FF1E7A] text-[#FF1E7A] font-bold">
              PASS {overclockPass} / 3 (
              {overclockPass === 1
                ? '100%'
                : overclockPass === 2
                ? '75%'
                : '50%'}{' '}
              TIME)
            </div>
          )}

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
          ) : (
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
                      {chunk}
                    </span>{' '}
                  </span>
                );
              })}
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
