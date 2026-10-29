import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Eye,
  Loader2,
  Zap,
} from 'lucide-react';
import { CoachPrescription } from '../../lib/metrics';
import { AppExperienceMode, MODE_INFO } from '../../lib/pacing';
import { soundEngine } from '../../lib/soundEngine';
import {
  TrainingMode,
  TrainingPassage,
  UserProfile,
} from '../../types/schema';
import { ChamferedPanel } from '../layout/ChamferedPanel';

interface HomeScreenProps {
  appMode: AppExperienceMode;
  profile: UserProfile;
  coachPrescription: CoachPrescription;
  selectedMode: TrainingMode;
  setSelectedMode: (mode: TrainingMode) => void;
  targetWpm: number;
  setTargetWpm: (updater: number | ((prev: number) => number)) => void;
  selectedPassage: TrainingPassage;
  estimatedSeconds: number;
  bgQuizStatus: {
    passageId: string;
    state: 'running' | 'ready' | 'fallback';
    detail?: string;
  } | null;
  onBackToProtocols: () => void;
  onToggleAppMode: () => void;
  onOpenPreview: () => void;
  onOpenPassageModal: () => void;
  onStartReadingSession: () => void;
}

export function HomeScreen({
  appMode,
  profile,
  coachPrescription,
  selectedMode,
  setSelectedMode,
  targetWpm,
  setTargetWpm,
  selectedPassage,
  estimatedSeconds,
  bgQuizStatus,
  onBackToProtocols,
  onToggleAppMode,
  onOpenPreview,
  onOpenPassageModal,
  onStartReadingSession,
}: HomeScreenProps) {
  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 sm:py-10 flex flex-col justify-center space-y-5">
      {/* Top Protocol Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#180B29] border border-[#00F5D4]/30 px-3.5 py-2 font-terminal text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onBackToProtocols();
            }}
            className="text-[#6C7A89] hover:text-[#F2F5F8] flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>PROTOCOLS</span>
          </button>
          <span className="text-[#6C7A89]">/</span>
          <span
            className={`font-bold ${
              appMode === 'guided' ? 'text-[#00F5D4]' : 'text-[#FFE600]'
            }`}
          >
            {appMode === 'guided'
              ? 'NEURAL COACH (GUIDED)'
              : 'FREEPLAY LAB (MANUAL)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {profile.baselineWpm && (
            <span className="text-[11px] text-[#6C7A89]">
              BASELINE:{' '}
              <strong className="text-[#F2F5F8]">
                {profile.baselineWpm} WPM
              </strong>
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onToggleAppMode();
            }}
            className="px-2 py-0.5 bg-[#0D0618] border border-[#6C7A89]/50 text-[10px] text-[#F2F5F8] hover:border-[#00F5D4] hover:text-[#00F5D4] cursor-pointer"
          >
            SWITCH TO {appMode === 'guided' ? 'FREEPLAY' : 'GUIDED COACH'}
          </button>
        </div>
      </div>

      {!profile.baselineWpm && (
        <div className="p-3 bg-[#180B29] border border-[#FFE600]/60 font-terminal text-xs flex items-center justify-between gap-3">
          <div>
            <div className="text-[#FFE600] font-bold">
              ◌ INITIAL RUN // NO GHOST YET
            </div>
            <div className="text-[#F2F5F8]/90 text-[11px] mt-0.5">
              Read your first passage at a natural, comfortable pace. Completing
              it once automatically records your baseline WPM and generates your
              Ghost pacemaker.
            </div>
          </div>
        </div>
      )}

      {/* Selected Passage Card (First: choose passage & preview before running training patterns) */}
      <ChamferedPanel
        variant="alt"
        cutSize={12}
        tag="READING MATERIAL"
        title="TARGET PASSAGE"
      >
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 font-terminal text-xs">
              <span className="px-2 py-0.5 bg-[#00F5D4]/15 border border-[#00F5D4]/50 text-[#00F5D4] font-bold">
                {selectedPassage.category}
              </span>
              <span className="text-[#6C7A89]">
                {selectedPassage.wordCount} words // ~{estimatedSeconds}s
              </span>
              {bgQuizStatus?.passageId === selectedPassage.id && (
                <span
                  className={`px-2 py-0.5 text-[10px] border flex items-center gap-1 ${
                    bgQuizStatus.state === 'running'
                      ? 'border-[#FFE600]/60 text-[#FFE600] bg-[#FFE600]/10'
                      : bgQuizStatus.state === 'ready'
                      ? 'border-[#00F5D4]/60 text-[#00F5D4] bg-[#00F5D4]/10'
                      : 'border-[#6C7A89]/50 text-[#6C7A89]'
                  }`}
                >
                  {bgQuizStatus.state === 'running' && (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  <span>{bgQuizStatus.detail}</span>
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#F2F5F8]">
              {selectedPassage.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenPreview}
              className="cyber-btn px-3.5 py-2 bg-[#180B29] border border-[#FFE600] text-xs text-[#FFE600] font-bold hover:bg-[#FFE600]/15 flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>PREVIEW &amp; VOCAB</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onOpenPassageModal();
              }}
              className="cyber-btn px-3.5 py-2 bg-[#0D0618] border border-[#6C7A89]/50 text-xs text-[#F2F5F8] hover:border-[#00F5D4] hover:text-[#00F5D4] flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>CHANGE PASSAGE</span>
            </button>
          </div>
        </div>
      </ChamferedPanel>

      {/* Speed & Mode Configuration */}
      <ChamferedPanel
        variant="cyan"
        cutSize={12}
        tag={appMode === 'guided' ? 'COACH PRESCRIPTION' : 'TRAINING CONFIG'}
        title={
          appMode === 'guided'
            ? 'ADAPTIVE 6-ENGINE ESL ROTATION & SPEED'
            : 'TRAINING MODE & SPEED'
        }
      >
        <div className="p-5 space-y-4">
          {appMode === 'guided' &&
            (() => {
              const rec = profile.passageRecords?.[selectedPassage.id];
              return (
                <div className="p-3.5 bg-[#0D0618] border border-[#00F5D4]/40 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-terminal text-xs">
                    <span className="text-[#00F5D4] font-bold">
                      TARGET AXIS // {coachPrescription.bottleneckLabel}
                    </span>
                    <span className="text-[11px] text-[#FFE600]">
                      {rec && rec.attempts > 0
                        ? `PASSAGE BEST: ${rec.bestEffectiveWpm} eWPM (${rec.attempts} RUNS)`
                        : 'NEW PASSAGE (85% TRANSFER PACE)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#F2F5F8]/90 leading-relaxed">
                    {coachPrescription.rationale}
                  </p>
                </div>
              );
            })()}

          {/* Unified 6 Complementary ESL Mode Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-terminal">
            {(Object.keys(MODE_INFO) as TrainingMode[]).map((modeKey, idx) => {
              const active = selectedMode === modeKey;
              const isPrescribed =
                appMode === 'guided' && coachPrescription.nextMode === modeKey;
              const numPrefix = String(idx + 1).padStart(2, '0');
              return (
                <button
                  key={modeKey}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setSelectedMode(modeKey);
                  }}
                  className={`p-2.5 border text-left transition-all cursor-pointer relative ${
                    active
                      ? 'bg-[#00F5D4]/15 border-[#00F5D4] text-[#00F5D4]'
                      : isPrescribed
                      ? 'bg-[#180B29] border-[#FFE600]/80 text-[#FFE600]'
                      : 'bg-[#0D0618] border-[#6C7A89]/35 text-[#6C7A89] hover:border-[#00F5D4]/60 hover:text-[#F2F5F8]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                    <span className="truncate">
                      {numPrefix} // {MODE_INFO[modeKey].label}
                    </span>
                    {isPrescribed && (
                      <span className="px-1 py-0.2 bg-[#FFE600] text-[#0D0618] text-[9px] font-extrabold shrink-0">
                        ★ PICK
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] opacity-80 mt-0.5 truncate">
                    {MODE_INFO[modeKey].shortTag}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-[#6C7A89]">
            {MODE_INFO[selectedMode].shortDesc}
          </p>

          {/* Target Speed Control (Dual ±10 / ±1 steppers + direct input + 1-WPM slider) */}
          <div className="pt-3 border-t border-[#00F5D4]/20 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-terminal text-xs text-[#6C7A89]">
                  {appMode === 'guided'
                    ? 'COACH TARGET WPM (MANUAL OVERRIDE ENABLED)'
                    : 'TARGET READING SPEED'}
                </div>
                <div className="text-[11px] text-[#6C7A89] mt-0.5">
                  L2 Start: <span className="text-[#F2F5F8]">150</span> · Native
                  Avg: <span className="text-[#F2F5F8]">238 WPM</span>
                  {profile.bestEffectiveWpm > 0 && (
                    <span className="ml-2 text-[#FF1E7A]">
                      · Best: {profile.bestEffectiveWpm} eWPM
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 font-terminal self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setTargetWpm((w) => Math.max(60, w - 10));
                  }}
                  title="Decrease by 10 WPM"
                  className="cyber-btn px-2.5 h-9 bg-[#0D0618] border border-[#00F5D4]/60 text-xs text-[#00F5D4] font-bold hover:bg-[#00F5D4]/15"
                >
                  -10
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setTargetWpm((w) => Math.max(60, w - 1));
                  }}
                  title="Fine-tune -1 WPM"
                  className="cyber-btn px-2.5 h-9 bg-[#0D0618] border border-[#6C7A89]/60 text-xs text-[#F2F5F8] font-bold hover:border-[#00F5D4] hover:text-[#00F5D4]"
                >
                  -1
                </button>

                <div className="px-3 h-9 bg-[#0D0618] border border-[#00F5D4] flex items-center justify-center min-w-[108px]">
                  <input
                    type="number"
                    min={60}
                    max={900}
                    step={1}
                    value={targetWpm}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (Number.isFinite(val)) {
                        setTargetWpm(
                          Math.max(60, Math.min(900, Math.round(val)))
                        );
                      }
                    }}
                    aria-label="Target WPM"
                    className="w-14 bg-transparent text-right text-lg font-bold text-[#00F5D4] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[11px] text-[#6C7A89] ml-1.5">WPM</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setTargetWpm((w) => Math.min(900, w + 1));
                  }}
                  title="Fine-tune +1 WPM"
                  className="cyber-btn px-2.5 h-9 bg-[#0D0618] border border-[#6C7A89]/60 text-xs text-[#F2F5F8] font-bold hover:border-[#00F5D4] hover:text-[#00F5D4]"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setTargetWpm((w) => Math.min(900, w + 10));
                  }}
                  title="Increase by 10 WPM"
                  className="cyber-btn px-2.5 h-9 bg-[#0D0618] border border-[#00F5D4]/60 text-xs text-[#00F5D4] font-bold hover:bg-[#00F5D4]/15"
                >
                  +10
                </button>
              </div>
            </div>

            {/* Continuous 1-WPM Slider with Quick Anchor Marks */}
            <div className="space-y-1">
              <input
                type="range"
                min={80}
                max={500}
                step={1}
                value={Math.min(500, Math.max(80, targetWpm))}
                onChange={(e) => setTargetWpm(Number(e.target.value))}
                className="w-full h-1.5 bg-[#0D0618] accent-[#00F5D4] cursor-pointer"
              />
              <div className="flex justify-between font-terminal text-[10px] text-[#6C7A89]">
                <span>80</span>
                <button
                  type="button"
                  onClick={() => setTargetWpm(150)}
                  className="hover:text-[#00F5D4] cursor-pointer"
                >
                  150 (L2 START)
                </button>
                <button
                  type="button"
                  onClick={() => setTargetWpm(238)}
                  className="hover:text-[#00F5D4] cursor-pointer"
                >
                  238 (NATIVE AVG)
                </button>
                <button
                  type="button"
                  onClick={() => setTargetWpm(350)}
                  className="hover:text-[#00F5D4] cursor-pointer"
                >
                  350 (PRO)
                </button>
                <span>500+</span>
              </div>
            </div>
          </div>
        </div>
      </ChamferedPanel>

      {/* Primary Call To Action */}
      <button
        type="button"
        onClick={onStartReadingSession}
        className="cyber-btn w-full py-4 px-6 bg-[#00F5D4] text-[#0D0618] font-bold text-base sm:text-lg tracking-wider flex items-center justify-center gap-3 shadow-[0_0_25px_rgba(0,245,212,0.35)] hover:brightness-110"
      >
        <Zap className="w-5 h-5 fill-current" />
        <span>START READING SESSION</span>
        <ChevronRight className="w-5 h-5" />
      </button>
    </main>
  );
}
