import { ArrowLeft, ChevronRight, Languages, Zap } from 'lucide-react';
import { soundEngine } from '../../lib/soundEngine';
import {
  extractWordAtClientPoint,
  LexiconPopupState,
} from '../../lib/wordLookup';
import { TrainingPassage } from '../../types/schema';
import { ChamferedPanel } from '../layout/ChamferedPanel';

interface PreviewScreenProps {
  selectedPassage: TrainingPassage;
  targetWpm: number;
  previewCheckedIndices: number[];
  setPreviewCheckedIndices: (
    updater: number[] | ((prev: number[]) => number[])
  ) => void;
  lexiconPopup: LexiconPopupState | null;
  onTranslateChunkOrWord: (
    queryText: string,
    chunkIdx: number,
    baseChunkText?: string,
    anchorRect?: { x: number; top: number; bottom: number }
  ) => void;
  onBackToSetup: () => void;
  onStartReadingSession: () => void;
}

export function PreviewScreen({
  selectedPassage,
  targetWpm,
  previewCheckedIndices,
  setPreviewCheckedIndices,
  lexiconPopup,
  onTranslateChunkOrWord,
  onBackToSetup,
  onStartReadingSession,
}: PreviewScreenProps) {
  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col justify-between gap-5 relative z-20">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#180B29] border border-[#FFE600]/50 px-4 py-2.5 font-terminal text-xs">
        <button
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            onBackToSetup();
          }}
          className="flex items-center gap-1.5 text-[#6C7A89] hover:text-[#F2F5F8] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO SETUP</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[#FFE600] font-bold flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5" />
            <span>
              VOCAB CHECKED: {previewCheckedIndices.length} /{' '}
              {selectedPassage.chunks.length} PHRASES
            </span>
          </span>

          <button
            type="button"
            onClick={onStartReadingSession}
            className="cyber-btn px-3 py-1 bg-[#00F5D4] text-[#0D0618] font-bold flex items-center gap-1"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>START ({targetWpm} WPM)</span>
          </button>
        </div>
      </div>

      <ChamferedPanel
        variant="yellow"
        cutSize={16}
        tag="PRE-FLIGHT LEXICAL SCAN"
        title={selectedPassage.title}
        rightSlot={
          <span className="text-[#FFE600] font-bold">
            {selectedPassage.wordCount} WORDS // UNTIMED
          </span>
        }
        className="flex-1 flex flex-col justify-center"
        innerClassName="p-6 sm:p-10 space-y-5"
      >
        <div className="p-3 bg-[#0D0618] border border-[#FFE600]/30 font-terminal text-xs text-[#FFE600] flex flex-wrap items-center justify-between gap-2">
          <span>
            Read through the passage at your own pace before starting the timer.{' '}
            <strong>Tap any unfamiliar word or phrase</strong> to inspect its
            translation and clear lexical bottlenecks.
          </span>
          {previewCheckedIndices.length > 0 && (
            <button
              type="button"
              onClick={() => setPreviewCheckedIndices([])}
              className="text-[10px] text-[#6C7A89] hover:text-[#F2F5F8] underline cursor-pointer"
            >
              CLEAR MARKS
            </button>
          )}
        </div>

        <div className="leading-[2.2] text-lg sm:text-xl font-medium select-none">
          {selectedPassage.chunks.map((chunk, idx) => {
            const isChecked = previewCheckedIndices.includes(idx);
            const isSelectedInPopup = lexiconPopup?.chunkIdx === idx;
            return (
              <span key={idx}>
                <span
                  data-chunk-interactive="true"
                  onClick={(e) => {
                    const hit = extractWordAtClientPoint(e.clientX, e.clientY);
                    const rect =
                      hit?.rect ??
                      (() => {
                        const r = e.currentTarget.getBoundingClientRect();
                        return {
                          x: r.left + r.width / 2,
                          top: r.top,
                          bottom: r.bottom,
                        };
                      })();
                    const initialQuery = hit?.word || chunk;
                    setPreviewCheckedIndices((prev) =>
                      prev.includes(idx) ? prev : [...prev, idx]
                    );
                    onTranslateChunkOrWord(initialQuery, idx, chunk, rect);
                  }}
                  title="Tap any word or phrase to translate"
                  className={`inline py-0.5 border-b-2 cursor-pointer transition-colors duration-75 ${
                    isSelectedInPopup
                      ? 'bg-[#00F5D4]/20 border-[#00F5D4] text-[#F2F5F8]'
                      : isChecked
                      ? 'bg-[#FFE600]/10 border-[#FFE600]/80 text-[#F2F5F8]'
                      : 'bg-transparent border-transparent text-[#F2F5F8]/90 hover:border-[#00F5D4]/60 hover:bg-[#00F5D4]/10'
                  }`}
                >
                  {chunk}
                </span>{' '}
              </span>
            );
          })}
        </div>
      </ChamferedPanel>

      <button
        type="button"
        onClick={onStartReadingSession}
        className="cyber-btn w-full py-4 px-6 bg-[#00F5D4] text-[#0D0618] font-bold text-base sm:text-lg tracking-wider flex items-center justify-center gap-3 shadow-[0_0_25px_rgba(0,245,212,0.35)] hover:brightness-110"
      >
        <Zap className="w-5 h-5 fill-current" />
        <span>VOCABULARY READY — START TIMED SESSION ({targetWpm} WPM)</span>
        <ChevronRight className="w-5 h-5" />
      </button>
    </main>
  );
}
