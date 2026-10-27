import { ChevronRight, Compass, Sliders, Sparkles } from 'lucide-react';
import { soundEngine } from '../../lib/soundEngine';
import { UserProfile } from '../../types/schema';
import { ChamferedPanel } from '../layout/ChamferedPanel';

interface TitleScreenProps {
  profile: UserProfile;
  onEnterGuided: () => void;
  onRecalibrate: () => void;
  onEnterFreeplay: () => void;
}

export function TitleScreen({
  profile,
  onEnterGuided,
  onRecalibrate,
  onEnterFreeplay,
}: TitleScreenProps) {
  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col justify-center space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#180B29] border border-[#00F5D4]/50 font-terminal text-xs text-[#00F5D4]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>SCIENCE-BACKED L2 VISUAL OVERCLOCKING</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-wider text-[#F2F5F8]">
          SELECT TRAINING PROTOCOL
        </h1>
        <p className="text-xs sm:text-sm text-[#6C7A89] max-w-lg mx-auto">
          Choose the automated cognitive coaching curriculum or unlock all
          training modes and parameters manually.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Option 1: NEURAL COACH (Guided Curriculum) */}
        <ChamferedPanel
          variant="cyan"
          cutSize={12}
          tag="RECOMMENDED"
          title="01 // NEURAL COACH (GUIDED CURRICULUM)"
          rightSlot={
            profile.baselineWpm ? (
              <span className="text-[#00F5D4] font-bold">
                BASELINE: {profile.baselineWpm} WPM
              </span>
            ) : (
              <span className="text-[#FFE600] font-bold">
                STARTS WITH CALIBRATION
              </span>
            )
          }
        >
          <div className="p-5 space-y-4">
            <p className="text-xs sm:text-sm text-[#F2F5F8] leading-relaxed">
              Automatically paces your speed and reading mode based on
              second-language fluency science:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-terminal text-[11px]">
              <div className="p-2.5 bg-[#0D0618] border border-[#00F5D4]/30">
                <div className="text-[#00F5D4] font-bold">STAGE 1: CHUNK</div>
                <div className="text-[#6C7A89] mt-0.5">
                  Absorb meaning &amp; vocabulary at comfortable speed.
                </div>
              </div>
              <div className="p-2.5 bg-[#0D0618] border border-[#00F5D4]/30">
                <div className="text-[#FFE600] font-bold">STAGE 2: PACER</div>
                <div className="text-[#6C7A89] mt-0.5">
                  Fade passed chunks to eliminate backward regressions.
                </div>
              </div>
              <div className="p-2.5 bg-[#0D0618] border border-[#00F5D4]/30">
                <div className="text-[#FF1E7A] font-bold">
                  STAGE 3: OVERCLOCK
                </div>
                <div className="text-[#6C7A89] mt-0.5">
                  4/3/2 time compression to break inner speech limits.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onEnterGuided();
                }}
                className="cyber-btn flex-1 py-3.5 px-5 bg-[#00F5D4] text-[#0D0618] font-bold text-sm tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,245,212,0.3)] hover:brightness-110"
              >
                <Compass className="w-4 h-4" />
                <span>
                  {profile.baselineWpm
                    ? 'ENTER NEURAL COACH'
                    : 'START BASELINE CALIBRATION'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>

              {profile.baselineWpm && (
                <button
                  type="button"
                  onClick={onRecalibrate}
                  className="cyber-btn py-3.5 px-3.5 bg-[#0D0618] border border-[#6C7A89]/50 text-[#6C7A89] hover:border-[#00F5D4] hover:text-[#00F5D4] font-terminal text-xs"
                >
                  RECALIBRATE
                </button>
              )}
            </div>
          </div>
        </ChamferedPanel>

        {/* Option 2: FREEPLAY LAB (Custom / Sandbox Mode) */}
        <ChamferedPanel
          variant="alt"
          cutSize={12}
          tag="SANDBOX / CUSTOM"
          title="02 // FREEPLAY LAB (MANUAL OVERRIDE)"
          rightSlot={
            profile.bestEffectiveWpm > 0 ? (
              <span className="text-[#FF1E7A] font-bold">
                BEST: {profile.bestEffectiveWpm} eWPM
              </span>
            ) : undefined
          }
        >
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-xs text-[#6C7A89] leading-relaxed">
              Unrestricted access to all 4 training engines (Chunk Pacer, RSVP
              Stream, 4/3/2 Overclock, Tachistoscope), manual WPM sliders, and
              live article feeds.
            </p>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onEnterFreeplay();
              }}
              className="cyber-btn py-3 px-5 bg-[#180B29] border border-[#00F5D4] text-[#00F5D4] font-bold text-xs tracking-wider shrink-0 flex items-center justify-center gap-2 hover:bg-[#00F5D4]/15"
            >
              <Sliders className="w-4 h-4" />
              <span>OPEN FREEPLAY LAB</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </ChamferedPanel>
      </div>
    </main>
  );
}
