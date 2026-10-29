import { ChevronRight, Sparkles } from 'lucide-react';
import { CALIBRATION_PASSAGE } from '../../data/presetPassages';
import { soundEngine } from '../../lib/soundEngine';
import { ChamferedPanel } from '../layout/ChamferedPanel';

interface CalibrationScreenProps {
  activeChunkIndex: number;
  onAdvanceChunk: () => void;
  onCancel: () => void;
}

export function CalibrationScreen({
  activeChunkIndex,
  onAdvanceChunk,
  onCancel,
}: CalibrationScreenProps) {
  return (
    <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 flex flex-col justify-between gap-5 relative z-20">
      <div className="bg-[#180B29] border border-[#FFE600]/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3 font-terminal text-xs">
        <div className="flex items-center gap-2 text-[#FFE600] font-bold">
          <Sparkles className="w-4 h-4" />
          <span>
            BASELINE CALIBRATION // STEP {activeChunkIndex + 1} OF{' '}
            {CALIBRATION_PASSAGE.chunks.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            onCancel();
          }}
          className="text-[#6C7A89] hover:text-[#F2F5F8] cursor-pointer"
        >
          CANCEL
        </button>
      </div>

      <ChamferedPanel
        variant="yellow"
        cutSize={16}
        tag="SELF-PACED PROBE"
        title="READ AT YOUR NATURAL COMFORTABLE PACE"
        className="flex-1 flex flex-col justify-center"
        innerClassName="justify-center p-6 sm:p-10 space-y-6"
      >
        <p className="text-xs font-terminal text-[#FFE600] bg-[#0D0618] border border-[#FFE600]/30 p-3">
          Tap the button below (or press <strong>SPACE / →</strong>) each time
          you finish reading the highlighted phrase. Understand the meaning
          naturally—a 3-question check follows!
        </p>

        <div
          data-chunk-interactive="true"
          onClick={onAdvanceChunk}
          className="pretty-text leading-[2.2] text-lg sm:text-xl font-medium select-none cursor-pointer p-2"
        >
          {CALIBRATION_PASSAGE.chunks.map((chunk, idx) => {
            const isActive = idx === activeChunkIndex;
            const isPassed = idx < activeChunkIndex;
            return (
              <span key={idx}>
                <span
                  className={`inline py-0.5 border-b-2 transition-colors duration-75 ${
                    isActive
                      ? 'bg-[#FFE600]/20 border-[#FFE600] text-[#F2F5F8]'
                      : isPassed
                      ? 'bg-transparent border-transparent text-[#6C7A89]/50'
                      : 'bg-transparent border-transparent text-[#6C7A89]'
                  }`}
                >
                  {chunk}
                </span>{' '}
              </span>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onAdvanceChunk}
          className="cyber-btn w-full py-4 bg-[#FFE600] text-[#0D0618] font-bold text-base tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,230,0,0.3)]"
        >
          <span>
            {activeChunkIndex === 0
              ? 'TAP TO ADVANCE TO NEXT PHRASE [SPACE]'
              : activeChunkIndex < CALIBRATION_PASSAGE.chunks.length - 1
              ? `NEXT PHRASE (${activeChunkIndex + 1}/${CALIBRATION_PASSAGE.chunks.length}) [SPACE]`
              : 'FINISH READING & VERIFY COMPREHENSION'}
          </span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </ChamferedPanel>
    </main>
  );
}
