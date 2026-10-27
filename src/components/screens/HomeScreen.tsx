import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Eye,
  Loader2,
  X,
  Zap,
} from 'lucide-react';
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
  calibrationCompletedBanner: number | null;
  setCalibrationCompletedBanner: (val: number | null) => void;
  onBackToProtocols: () => void;
  onToggleAppMode: () => void;
  onOpenPreview: () => void;
  onOpenPassageModal: () => void;
  onStartReadingSession: () => void;
}

export function HomeScreen({
  appMode,
  profile,
  selectedMode,
  setSelectedMode,
  targetWpm,
  setTargetWpm,
  selectedPassage,
  estimatedSeconds,
  bgQuizStatus,
  calibrationCompletedBanner,
  setCalibrationCompletedBanner,
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

      {calibrationCompletedBanner !== null && (
        <div className="p-3.5 bg-[#00F5D4]/15 border-2 border-[#00F5D4] font-terminal text-xs flex items-center justify-between gap-3">
          <div>
            <div className="text-[#00F5D4] font-bold">
              ★ BASELINE CALIBRATION COMPLETE: {calibrationCompletedBanner} WPM
            </div>
            <div className="text-[#F2F5F8] text-[11px] mt-0.5">
              Your initial training velocity has been locked in. Select any
              passage or start Stage 1 below!
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCalibrationCompletedBanner(null)}
            className="text-[#00F5D4] hover:text-[#F2F5F8] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Speed & Mode Configuration */}
      <ChamferedPanel
        variant="cyan"
        cutSize={12}
        tag={appMode === 'guided' ? 'COACH PRESCRIPTION' : 'STEP 01'}
        title={
          appMode === 'guided'
            ? 'RECOMMENDED STAGE & SPEED (ADJUSTABLE)'
            : 'TRAINING MODE & SPEED'
        }
      >
        <div className="p-5 space-y-5">
          {appMode === 'guided' &&
            (() => {
              const rec = profile.passageRecords?.[selectedPassage.id];
              const stageNum = rec ? Math.min(3, rec.stageCompleted + 1) : 1;
              const isMastered = (rec?.stageCompleted || 0) >= 3;
              return (
                <div className="p-3 bg-[#0D0618] border border-[#00F5D4]/40 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 font-terminal text-xs">
                    <span className="text-[#00F5D4] font-bold">
                      {isMastered
                        ? '★ PASSAGE MASTERED (OVERCLOCK TIER)'
                        : `GUIDED STAGE ${stageNum} OF 3 // ${
                            stageNum === 1
                              ? 'SEMANTIC CHUNK INTAKE'
                              : stageNum === 2
                              ? 'PERIPHERAL PACER (NO REGRESSION)'
                              : '4/3/2 TIME COMPRESSION OVERCLOCK'
                          }`}
                    </span>
                    <span className="text-[11px] text-[#FFE600]">
                      {rec && rec.attempts > 0
                        ? `PASSAGE BEST: ${rec.bestEffectiveWpm} eWPM`
                        : 'NEW PASSAGE (85% TRANSFER PACE)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 font-terminal text-[10px]">
                    <div
                      className={`p-1.5 border text-center ${
                        stageNum === 1 && !isMastered
                          ? 'border-[#00F5D4] bg-[#00F5D4]/15 text-[#00F5D4] font-bold'
                          : (rec?.stageCompleted || 0) >= 1
                          ? 'border-[#00F5D4]/40 bg-[#180B29] text-[#00F5D4]'
                          : 'border-[#6C7A89]/30 bg-[#0D0618] text-[#6C7A89]'
                      }`}
                    >
                      {(rec?.stageCompleted || 0) >= 1 ? '✓ ' : ''}STAGE 1:
                      CHUNK
                    </div>
                    <div
                      className={`p-1.5 border text-center ${
                        stageNum === 2 && !isMastered
                          ? 'border-[#FFE600] bg-[#FFE600]/15 text-[#FFE600] font-bold'
                          : (rec?.stageCompleted || 0) >= 2
                          ? 'border-[#00F5D4]/40 bg-[#180B29] text-[#00F5D4]'
                          : 'border-[#6C7A89]/30 bg-[#0D0618] text-[#6C7A89]'
                      }`}
                    >
                      {(rec?.stageCompleted || 0) >= 2 ? '✓ ' : ''}STAGE 2:
                      PACER
                    </div>
                    <div
                      className={`p-1.5 border text-center ${
                        stageNum === 3 || isMastered
                          ? 'border-[#FF1E7A] bg-[#FF1E7A]/15 text-[#FF1E7A] font-bold'
                          : 'border-[#6C7A89]/30 bg-[#0D0618] text-[#6C7A89]'
                      }`}
                    >
                      {isMastered ? '★ MASTERED' : 'STAGE 3: 4/3/2'}
                    </div>
                  </div>
                </div>
              );
            })()}

          {/* 4 Core Mode Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(MODE_INFO) as TrainingMode[]).map((modeKey) => {
              const active = selectedMode === modeKey;
              return (
                <button
                  key={modeKey}
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setSelectedMode(modeKey);
                  }}
                  className={`cyber-btn py-2.5 px-2 border text-[11px] font-bold text-center transition-all ${
                    active
                      ? 'bg-[#00F5D4] text-[#0D0618] border-[#00F5D4]'
                      : 'bg-[#0D0618] text-[#6C7A89] border-[#6C7A89]/40 hover:border-[#00F5D4]/60 hover:text-[#F2F5F8]'
                  }`}
                >
                  {MODE_INFO[modeKey].label}
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

      {/* 2. Selected Passage Card (Single focused card, switchable via modal) */}
      <ChamferedPanel
        variant="alt"
        cutSize={12}
        tag="STEP 02"
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

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenPreview}
              className="cyber-btn px-3 py-2 bg-[#0D0618] border border-[#FFE600]/60 text-xs text-[#FFE600] hover:bg-[#FFE600]/15 flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>PREVIEW</span>
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

      {/* 3. Primary Call To Action + Pre-Flight Vocabulary Preview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onOpenPreview}
          className="cyber-btn py-4 px-4 bg-[#180B29] border-2 border-[#FFE600] text-[#FFE600] font-bold text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 hover:bg-[#FFE600]/15"
        >
          <Eye className="w-4 h-4 shrink-0" />
          <span>PREVIEW TEXT &amp; VOCAB</span>
        </button>

        <button
          type="button"
          onClick={onStartReadingSession}
          className="cyber-btn sm:col-span-2 py-4 px-6 bg-[#00F5D4] text-[#0D0618] font-bold text-base sm:text-lg tracking-wider flex items-center justify-center gap-3 shadow-[0_0_25px_rgba(0,245,212,0.35)] hover:brightness-110"
        >
          <Zap className="w-5 h-5 fill-current" />
          <span>START READING SESSION</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </main>
  );
}
