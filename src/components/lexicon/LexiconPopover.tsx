import { Loader2, X } from 'lucide-react';
import { TranslationLangCode } from '../../lib/llmClient';
import { ScreenState } from '../../lib/pacing';
import { soundEngine } from '../../lib/soundEngine';
import { LexiconPopupState } from '../../lib/wordLookup';

interface LexiconPopoverProps {
  popup: LexiconPopupState;
  screen: ScreenState;
  translationLang: TranslationLangCode;
  onTranslateQuery: (
    queryText: string,
    chunkIdx: number,
    baseChunkText?: string,
    anchorRect?: { x: number; top: number; bottom: number },
    overrideContextSentence?: string
  ) => void;
  onClose: () => void;
  onResumeReading: () => void;
  onOpenSettings: () => void;
}

export function LexiconPopover({
  popup,
  screen,
  translationLang,
  onTranslateQuery,
  onClose,
  onResumeReading,
  onOpenSettings,
}: LexiconPopoverProps) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 750;
  const popWidth = Math.min(340, vw - 24);
  const halfW = popWidth / 2;
  const clampedLeft = Math.max(
    12 + halfW,
    Math.min(vw - 12 - halfW, popup.anchorX)
  );
  const placeAbove = popup.anchorBottom + 170 > vh;
  const topStyle = placeAbove
    ? Math.max(12, popup.anchorTop - 12)
    : popup.anchorBottom + 8;

  return (
    <div
      data-lexicon-popup="true"
      style={{
        position: 'fixed',
        left: `${clampedLeft}px`,
        top: `${topStyle}px`,
        width: `${popWidth}px`,
        transform: placeAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
      }}
      className="z-[85] p-3 bg-[#0D0618]/95 backdrop-blur-md border-2 border-[#00F5D4] shadow-[0_8px_32px_rgba(0,0,0,0.85),0_0_18px_rgba(0,245,212,0.3)] font-terminal text-xs space-y-2"
    >
      {/* Popover Header: Phrase + Word Pills + Close */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() =>
              onTranslateQuery(
                popup.chunkText,
                popup.chunkIdx,
                popup.chunkText,
                undefined,
                popup.contextSentence
              )
            }
            className={`px-1.5 py-0.5 border text-[11px] cursor-pointer ${
              popup.activeQuery === popup.chunkText
                ? 'border-[#00F5D4] bg-[#00F5D4]/20 text-[#00F5D4] font-bold'
                : 'border-[#6C7A89]/40 bg-[#180B29] text-[#6C7A89] hover:text-[#F2F5F8]'
            }`}
          >
            PHRASE
          </button>
          {popup.words.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() =>
                onTranslateQuery(
                  w,
                  popup.chunkIdx,
                  popup.chunkText,
                  undefined,
                  popup.contextSentence
                )
              }
              className={`px-1.5 py-0.5 border text-[11px] cursor-pointer ${
                popup.activeQuery === w
                  ? 'border-[#FFE600] bg-[#FFE600]/20 text-[#FFE600] font-bold'
                  : 'border-[#6C7A89]/40 bg-[#180B29] text-[#F2F5F8] hover:border-[#FFE600]/60'
              }`}
            >
              {w}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-[#6C7A89] hover:text-[#F2F5F8] cursor-pointer shrink-0 p-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Translation Result & Action Button */}
      <div className="p-2 bg-[#180B29] border border-[#00F5D4]/30 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-[#6C7A89] truncate">
            {popup.activeQuery} ({translationLang.toUpperCase()}
            {popup.source
              ? ` · ${
                  popup.source === 'webllm'
                    ? 'HACHIUE'
                    : popup.source.toUpperCase()
                }`
              : ''}
            )
          </div>
          {popup.loading ? (
            <div className="text-[#00F5D4] text-xs flex items-center gap-1.5 mt-0.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Translating...</span>
            </div>
          ) : popup.error ? (
            <div className="space-y-1.5 mt-1">
              <div className="text-[#FF1E7A] text-[11px] leading-snug">
                {popup.error}
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onOpenSettings();
                }}
                className="cyber-btn px-2 py-1 bg-[#FFE600]/15 border border-[#FFE600] text-[#FFE600] text-[10px] font-bold"
              >
                OPEN CONFIG TO ENABLE
              </button>
            </div>
          ) : (
            <div className="font-bold text-sm text-[#00F5D4] mt-0.5 break-words">
              {popup.translation}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            if (screen === 'reading') {
              onResumeReading();
            } else {
              onClose();
            }
          }}
          className="cyber-btn px-2.5 py-1.5 bg-[#00F5D4] text-[#0D0618] font-bold text-[11px] shrink-0"
        >
          {screen === 'reading' ? 'RESUME' : 'GOT IT'}
        </button>
      </div>
    </div>
  );
}
