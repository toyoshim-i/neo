import { Award, BookOpen, RotateCcw, Trophy } from 'lucide-react';
import { ACHIEVEMENT_CATALOG } from '../../lib/db';
import {
  calculateHumanBenchmark,
  computeNextTargetWpm,
  FiveAxisMetrics,
} from '../../lib/metrics';
import { AppExperienceMode } from '../../lib/pacing';
import { soundEngine } from '../../lib/soundEngine';
import {
  AchievementId,
  TrainingPassage,
  UserProfile,
} from '../../types/schema';
import { RadarBenchmarkChart } from '../dashboard/RadarBenchmarkChart';
import { ChamferedPanel } from '../layout/ChamferedPanel';

interface ResultScreenProps {
  appMode: AppExperienceMode;
  lastSessionMetrics: FiveAxisMetrics;
  targetWpm: number;
  setTargetWpm: (updater: (prev: number) => number) => void;
  profile: UserProfile;
  selectedPassage: TrainingPassage;
  isNewPersonalBest: boolean;
  isNewPassageBest: boolean;
  previousPassageBest: number;
  newlyUnlockedAchievements: AchievementId[];
  onTrainSamePassage: (nextGuidedStage: 1 | 2 | 3) => void;
  onSwitchPassage: () => void;
}

export function ResultScreen({
  appMode,
  lastSessionMetrics,
  targetWpm,
  setTargetWpm,
  profile,
  selectedPassage,
  isNewPersonalBest,
  isNewPassageBest,
  previousPassageBest,
  newlyUnlockedAchievements,
  onTrainSamePassage,
  onSwitchPassage,
}: ResultScreenProps) {
  const benchmark = calculateHumanBenchmark(lastSessionMetrics);
  const rawSessionWpm = Math.round(
    lastSessionMetrics.syncRate > 0
      ? lastSessionMetrics.effectiveWpm / lastSessionMetrics.syncRate
      : targetWpm
  );
  const { status } = computeNextTargetWpm(
    rawSessionWpm,
    lastSessionMetrics.syncRate,
    lastSessionMetrics.forwardFlowRate
  );
  const syncPercent = Math.round(lastSessionMetrics.syncRate * 100);
  const flowPercent = Math.round(lastSessionMetrics.forwardFlowRate * 100);
  const rec = profile.passageRecords?.[selectedPassage.id];
  const stageCompleted = rec?.stageCompleted || 0;
  const nextGuidedStage: 1 | 2 | 3 =
    stageCompleted === 0 ? 1 : stageCompleted === 1 ? 2 : 3;

  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 flex flex-col justify-center space-y-5">
      {/* Celebratory Record-Breaker Banner */}
      {(isNewPersonalBest || isNewPassageBest) && (
        <div
          className={`p-4 border-2 font-terminal flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isNewPersonalBest
              ? 'bg-[#FFE600]/15 border-[#FFE600] shadow-[0_0_28px_rgba(255,230,0,0.35)]'
              : 'bg-[#00F5D4]/15 border-[#00F5D4] shadow-[0_0_24px_rgba(0,245,212,0.3)]'
          }`}
        >
          <div className="flex items-center gap-3">
            <Trophy
              className={`w-7 h-7 shrink-0 ${
                isNewPersonalBest ? 'text-[#FFE600]' : 'text-[#00F5D4]'
              }`}
            />
            <div>
              <div
                className={`text-sm sm:text-base font-extrabold tracking-wider ${
                  isNewPersonalBest ? 'text-[#FFE600]' : 'text-[#00F5D4]'
                }`}
              >
                {isNewPersonalBest
                  ? '★ OVERALL PERSONAL BEST BROKEN!!'
                  : '★ NEW PASSAGE RECORD SET!'}
              </div>
              <div className="text-xs text-[#F2F5F8] mt-0.5">
                {previousPassageBest > 0
                  ? `Passage record surged from ${previousPassageBest} → ${lastSessionMetrics.effectiveWpm} eWPM (+${
                      lastSessionMetrics.effectiveWpm - previousPassageBest
                    } eWPM)!`
                  : `First verified record on "${selectedPassage.title}": ${lastSessionMetrics.effectiveWpm} eWPM!`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Newly Unlocked Achievements Banner */}
      {newlyUnlockedAchievements.length > 0 && (
        <div className="p-3.5 bg-[#FF1E7A]/15 border-2 border-[#FF1E7A] font-terminal text-xs space-y-1.5">
          <div className="text-[#FF1E7A] font-bold flex items-center gap-1.5">
            <Award className="w-4 h-4" />
            <span>ACHIEVEMENT UNLOCKED!</span>
          </div>
          {newlyUnlockedAchievements.map((achId) => {
            const def = ACHIEVEMENT_CATALOG.find((a) => a.id === achId);
            if (!def) return null;
            return (
              <div
                key={achId}
                className="p-2 bg-[#0D0618] border border-[#FF1E7A]/50 flex items-center justify-between"
              >
                <div>
                  <span className="text-[#FFE600] font-bold">
                    [{def.badgeCode}] {def.title}
                  </span>
                  <span className="text-[#F2F5F8] ml-2">
                    — {def.description}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ChamferedPanel
        variant="cyan"
        cutSize={12}
        tag={benchmark.rankLabel}
        title="NEURAL SYNC REPORT"
        rightSlot={
          <span className="text-[#FFE600] font-bold">
            L2 TOP {benchmark.l2TopPercentile}% · L1 TOP{' '}
            {benchmark.topPercentile}%
          </span>
        }
      >
        <div className="p-6 space-y-6">
          {/* Top Row: Hero eWPM + 5-Axis Radar Benchmark */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            <div className="space-y-4">
              <div className="p-4 bg-[#0D0618] border border-[#00F5D4]/40">
                <div className="font-terminal text-[11px] text-[#6C7A89]">
                  EFFECTIVE THROUGHPUT
                </div>
                <div className="font-terminal text-4xl font-extrabold text-[#00F5D4] mt-1">
                  {lastSessionMetrics.effectiveWpm}{' '}
                  <span className="text-base font-normal">eWPM</span>
                </div>
                <div className="font-terminal text-xs mt-2 space-y-1">
                  <div className="flex items-center justify-between text-[#FFE600]">
                    <span className="text-[#6C7A89]">L2 GLOBAL READERS:</span>
                    <strong>TOP {benchmark.l2TopPercentile}%</strong>
                  </div>
                  <div className="flex items-center justify-between text-[#00F5D4]">
                    <span className="text-[#6C7A89]">L1 NATIVE READERS:</span>
                    <strong>TOP {benchmark.topPercentile}%</strong>
                  </div>
                </div>
                <div className="font-terminal text-[11px] mt-2 pt-2 border-t border-[#6C7A89]/30 space-y-0.5">
                  <div>
                    PASSAGE BEST:{' '}
                    <strong className="text-[#00F5D4]">
                      {rec?.bestEffectiveWpm || 0} eWPM
                    </strong>{' '}
                    · STAGE:{' '}
                    <strong className="text-[#FFE600]">
                      {stageCompleted}/3
                    </strong>
                  </div>
                  <div className="text-[#6C7A89]">
                    OVERALL BEST: {profile.bestEffectiveWpm} eWPM
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 font-terminal text-center">
                <div className="p-2.5 bg-[#0D0618] border border-[#6C7A89]/30">
                  <div className="text-[10px] text-[#6C7A89]">RAW WPM</div>
                  <div className="text-sm font-bold text-[#F2F5F8] mt-0.5">
                    {rawSessionWpm}
                  </div>
                </div>
                <div className="p-2.5 bg-[#0D0618] border border-[#6C7A89]/30">
                  <div className="text-[10px] text-[#6C7A89]">SYNC</div>
                  <div className="text-sm font-bold text-[#00F5D4] mt-0.5">
                    {syncPercent}%
                  </div>
                </div>
                <div className="p-2.5 bg-[#0D0618] border border-[#6C7A89]/30">
                  <div className="text-[10px] text-[#6C7A89]">FLOW</div>
                  <div className="text-sm font-bold text-[#F2F5F8] mt-0.5">
                    {flowPercent}%
                  </div>
                </div>
              </div>
            </div>

            {/* 5-Axis Radar Chart (YOU vs HUMAN AVG) */}
            <div className="flex justify-center">
              <RadarBenchmarkChart metrics={lastSessionMetrics} />
            </div>
          </div>

          {/* Interactive Next-Session Speed Adjuster (Auto-suggested + Manual Stepper) */}
          <div className="p-3.5 bg-[#0D0618] border border-[#00F5D4]/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <div className="font-terminal text-[#00F5D4] font-bold">
                  COACH RECOMMENDATION: {status}
                </div>
                <div className="text-[#6C7A89] text-[11px] mt-0.5">
                  {benchmark.diagnosisText}
                </div>
              </div>

              {/* Manual Speed Adjuster right on the Result Screen */}
              <div className="flex items-center gap-1 font-terminal shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setTargetWpm((w) => Math.max(60, w - 10));
                  }}
                  className="cyber-btn px-2 py-1 bg-[#180B29] border border-[#00F5D4]/60 text-xs text-[#00F5D4] font-bold"
                >
                  -10
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setTargetWpm((w) => Math.max(60, w - 1));
                  }}
                  className="cyber-btn px-2 py-1 bg-[#180B29] border border-[#6C7A89]/60 text-xs text-[#F2F5F8]"
                >
                  -1
                </button>
                <div className="px-2.5 py-1 bg-[#180B29] border border-[#00F5D4] text-sm font-bold text-[#00F5D4] min-w-[86px] text-center">
                  {targetWpm} WPM
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setTargetWpm((w) => Math.min(900, w + 1));
                  }}
                  className="cyber-btn px-2 py-1 bg-[#180B29] border border-[#6C7A89]/60 text-xs text-[#F2F5F8]"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setTargetWpm((w) => Math.min(900, w + 10));
                  }}
                  className="cyber-btn px-2 py-1 bg-[#180B29] border border-[#00F5D4]/60 text-xs text-[#00F5D4] font-bold"
                >
                  +10
                </button>
              </div>
            </div>
          </div>
        </div>
      </ChamferedPanel>

      {/* Primary Actions: Advance Guided Stage on Same Passage OR Switch Passage */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            onTrainSamePassage(nextGuidedStage);
          }}
          className="cyber-btn py-3.5 px-4 bg-[#00F5D4] text-[#0D0618] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 hover:brightness-110 shadow-[0_0_20px_rgba(0,245,212,0.3)]"
        >
          <RotateCcw className="w-4 h-4" />
          <span>
            {appMode === 'guided'
              ? stageCompleted >= 3
                ? `OVERCLOCK AGAIN (${targetWpm} WPM)`
                : `START STAGE ${nextGuidedStage}: ${
                    nextGuidedStage === 1
                      ? 'CHUNK'
                      : nextGuidedStage === 2
                      ? 'PACER'
                      : '4/3/2 OVERCLOCK'
                  } (${targetWpm} WPM)`
              : `TRAIN SAME PASSAGE (${targetWpm} WPM)`}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            onSwitchPassage();
          }}
          className="cyber-btn py-3.5 px-4 bg-[#180B29] border border-[#FFE600] text-[#FFE600] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-[#FFE600]/15"
        >
          <BookOpen className="w-4 h-4" />
          <span>
            {stageCompleted >= 3
              ? 'PASSAGE MASTERED! → PICK NEW PASSAGE (85% WPM)'
              : 'SWITCH PASSAGE (85% ON UNSEEN)'}
          </span>
        </button>
      </div>
    </main>
  );
}
