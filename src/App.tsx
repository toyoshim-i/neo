import { useState, useEffect, useCallback, useRef } from 'react';
import { CyberHeader } from './components/layout/CyberHeader';
import { CRTScanlineOverlay } from './components/layout/CRTScanlineOverlay';
import { PeripheralSpeedCanvas } from './components/reader/PeripheralSpeedCanvas';
import { OperatorState } from './components/quiz/OperatorMonitor';
import { LexiconPopover } from './components/lexicon/LexiconPopover';
import { PassageSelectorModal } from './components/modals/PassageSelectorModal';
import { SessionHistoryModal } from './components/modals/SessionHistoryModal';
import { SystemSettingsModal } from './components/modals/SystemSettingsModal';
import { AchievementsModal } from './components/modals/AchievementsModal';
import { TitleScreen } from './components/screens/TitleScreen';
import { CalibrationScreen } from './components/screens/CalibrationScreen';
import { HomeScreen } from './components/screens/HomeScreen';
import { PreviewScreen } from './components/screens/PreviewScreen';
import { ReadingScreen } from './components/screens/ReadingScreen';
import { QuizScreen } from './components/screens/QuizScreen';
import { ResultScreen } from './components/screens/ResultScreen';
import { soundEngine } from './lib/soundEngine';
import { PRESET_PASSAGES, CALIBRATION_PASSAGE } from './data/presetPassages';
import {
  TrainingMode,
  TrainingPassage,
  QuizQuestion,
  SessionLog,
  UserProfile,
  AchievementId,
} from './types/schema';
import {
  FiveAxisMetrics,
  computeNextTargetWpm,
  computeGuidedCoachPrescription,
  summarizeSessionMetrics,
} from './lib/metrics';
import {
  db,
  DEFAULT_PROFILE,
  INITIAL_DEFAULT_WPM,
  QUIZ_PASS_THRESHOLD,
  ACHIEVEMENT_CATALOG,
  getSavedTargetWpm,
  saveTargetWpmPreference,
  getOrInitProfile,
  saveCalibrationBaseline,
  recordSessionAndUpdateProfile,
  exportDatabaseJson,
} from './lib/db';
import {
  fetchWikipediaPassage,
  fetchWikipediaArtPassage,
  fetchDevToPassage,
  processPassageWithOptionalLlm,
  LlmProviderType,
  WebLlmModelId,
  WEBLLM_MODEL_OPTIONS,
  DEFAULT_WEBLLM_MODEL,
  isWebGpuSupported,
  isWebLlmReady,
  isWebLlmLoading,
  subscribeWebLlmProgress,
  checkCachedWebLlmModels,
  saveWebLlmModelSelection,
  TranslationLangCode,
  getSavedLlmProvider,
  getSavedTranslationLang,
  getSavedCloudTranslationEnabled,
  translateSelection,
} from './lib/llmClient';
import { buildNormalizedPassage } from './lib/chunker';
import {
  ScreenState,
  AppExperienceMode,
  PassageModalTab,
  MODE_INFO,
  shuffleQuizQuestions,
  computeChunkDurationMs,
} from './lib/pacing';
import {
  LexiconPopupState,
  extractWordAtClientPoint,
} from './lib/wordLookup';

export function App() {
  // Navigation & Hierarchy State
  const [screen, setScreen] = useState<ScreenState>('title');
  const [appMode, setAppMode] = useState<AppExperienceMode>('guided');
  const [isCalibratingSession, setIsCalibratingSession] =
    useState<boolean>(false);
  const [calibrationStartMs, setCalibrationStartMs] = useState<number | null>(
    null
  );
  const [measuredCalibrationRawWpm, setMeasuredCalibrationRawWpm] =
    useState<number>(150);
  const [showAchievementsModal, setShowAchievementsModal] =
    useState<boolean>(false);
  const [showPassageModal, setShowPassageModal] = useState<boolean>(false);
  const [passageModalTab, setPassageModalTab] =
    useState<PassageModalTab>('presets');
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [cachedModels, setCachedModels] = useState<
    Record<WebLlmModelId, boolean>
  >({
    'gemma-2-2b-it-q4f32_1-MLC-1k': false,
    'gemma-4-E2B-it-q4f32_1-MLC': false,
  });

  // Persistent Data & Profile State
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [customPassages, setCustomPassages] = useState<TrainingPassage[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionLog[]>([]);

  // User Preferences & Training Parameters
  const [muted, setMuted] = useState<boolean>(soundEngine.isMuted());
  const [chunkTickOn, setChunkTickOn] = useState<boolean>(
    soundEngine.isChunkTickEnabled()
  );
  const [scanlineEnabled, setScanlineEnabled] = useState<boolean>(true);
  const [fadeOutPassed, setFadeOutPassed] = useState<boolean>(true);
  const [translationLang, setTranslationLang] = useState<TranslationLangCode>(
    getSavedTranslationLang()
  );
  const [allowCloudTranslation, setAllowCloudTranslation] = useState<boolean>(
    getSavedCloudTranslationEnabled()
  );
  const [llmProvider, setLlmProvider] = useState<LlmProviderType>(
    () => getSavedLlmProvider() ?? (isWebGpuSupported() ? 'webllm' : 'rule_based')
  );
  const [selectedWebLlmModel, setSelectedWebLlmModel] =
    useState<WebLlmModelId>(DEFAULT_WEBLLM_MODEL);
  const [webLlmStatus, setWebLlmStatus] = useState<string>(
    isWebLlmReady(DEFAULT_WEBLLM_MODEL) ? 'READY IN VRAM' : 'NOT LOADED'
  );
  const [isPreloadingWebLlm, setIsPreloadingWebLlm] = useState<boolean>(
    isWebLlmLoading()
  );
  const [webLlmProgressPct, setWebLlmProgressPct] = useState<number | null>(
    null
  );

  const [targetWpm, setTargetWpm] = useState<number>(getSavedTargetWpm());
  const [selectedMode, setSelectedMode] = useState<TrainingMode>('chunk_pacer');
  const [selectedPassageId, setSelectedPassageId] = useState<string>(
    PRESET_PASSAGES[0].id
  );

  // Live Feed / Custom Input State (inside Passage Modal)
  const [isFetchingFeed, setIsFetchingFeed] = useState<boolean>(false);
  const [feedStatusMsg, setFeedStatusMsg] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customRawText, setCustomRawText] = useState<string>('');
  const [bgQuizStatus, setBgQuizStatus] = useState<{
    passageId: string;
    state: 'running' | 'ready' | 'fallback';
    detail?: string;
  } | null>(null);

  // Active Reading Session State
  const [activeChunkIndex, setActiveChunkIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [overclockPass, setOverclockPass] = useState<1 | 2 | 3>(1);
  const [regressionCount, setRegressionCount] = useState<number>(0);
  const [totalSteps, setTotalSteps] = useState<number>(0);
  const [sessionResetKey, setSessionResetKey] = useState<number>(0);
  const [previewCheckedIndices, setPreviewCheckedIndices] = useState<number[]>(
    []
  );
  const [lexiconPopup, setLexiconPopup] = useState<LexiconPopupState | null>(
    null
  );

  // Active Quiz State (1 question at a time, options shuffled each session)
  const [activeQuizQuestions, setActiveQuizQuestions] = useState<
    QuizQuestion[]
  >(() => shuffleQuizQuestions(PRESET_PASSAGES[0].questions));
  const [quizIndex, setQuizIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [juiceShake, setJuiceShake] = useState<boolean>(false);
  const [operatorState, setOperatorState] =
    useState<OperatorState>('observing');
  const [lastResponseSec, setLastResponseSec] = useState<number | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());

  // Final Session Metrics for Result Screen
  const [lastSessionMetrics, setLastSessionMetrics] =
    useState<FiveAxisMetrics | null>(null);
  const [isNewPersonalBest, setIsNewPersonalBest] = useState<boolean>(false);
  const [isNewPassageBest, setIsNewPassageBest] = useState<boolean>(false);
  const [previousPassageBest, setPreviousPassageBest] = useState<number>(0);
  const [newlyUnlockedAchievements, setNewlyUnlockedAchievements] = useState<
    AchievementId[]
  >([]);
  const [calibrationCompletedBanner, setCalibrationCompletedBanner] =
    useState<number | null>(null);

  // Persist user-selected target WPM as the default for subsequent sessions
  useEffect(() => {
    saveTargetWpmPreference(targetWpm);
  }, [targetWpm]);

  // Load IndexedDB on mount
  const reloadFromDb = useCallback(async () => {
    try {
      const [prof, savedPassages, logs] = await Promise.all([
        getOrInitProfile(),
        db.customPassages.orderBy('createdAt').reverse().toArray(),
        db.sessions.orderBy('timestamp').reverse().limit(30).toArray(),
      ]);
      setProfile(prof);
      setTargetWpm(prof.currentTargetWpm || INITIAL_DEFAULT_WPM);
      setCustomPassages(savedPassages);
      setSessionHistory(logs);
    } catch {
      // IndexedDB unavailable in restricted environments; fallback to in-memory
    }
  }, []);

  // Initial boot: load IndexedDB and auto-select a cached WebLLM model once on mount
  useEffect(() => {
    reloadFromDb();
    checkCachedWebLlmModels().then((cacheMap) => {
      setCachedModels(cacheMap);
      setSelectedWebLlmModel((initialModel) => {
        if (!cacheMap[initialModel]) {
          const cachedEntry = WEBLLM_MODEL_OPTIONS.find((m) => cacheMap[m.id]);
          if (cachedEntry) {
            saveWebLlmModelSelection(cachedEntry.id);
            setWebLlmStatus(
              isWebLlmReady(cachedEntry.id)
                ? 'READY IN VRAM'
                : 'CACHED ON DISK (READY TO LOAD)'
            );
            return cachedEntry.id;
          }
        }
        setWebLlmStatus(
          isWebLlmReady(initialModel)
            ? 'READY IN VRAM'
            : cacheMap[initialModel]
            ? 'CACHED ON DISK (READY TO LOAD)'
            : 'NOT DOWNLOADED'
        );
        return initialModel;
      });
    });
  }, [reloadFromDb]);

  // Subscribe to WebLLM download progress globally (persists even when Settings modal is closed)
  useEffect(() => {
    const unsub = subscribeWebLlmProgress((text, progressRatio) => {
      const pct = Math.min(100, Math.round(progressRatio * 100));
      setWebLlmProgressPct(pct);
      setIsPreloadingWebLlm(pct < 100);
      setWebLlmStatus(`${pct}% // ${text}`);
    });
    return () => unsub();
  }, []);

  const allPassages: TrainingPassage[] = [
    ...customPassages,
    ...PRESET_PASSAGES,
  ];
  const selectedPassage = isCalibratingSession
    ? CALIBRATION_PASSAGE
    : allPassages.find((p) => p.id === selectedPassageId) || PRESET_PASSAGES[0];

  // Compute Weakness-Driven 3-Mode Coach Prescription (`chunk_pacer` / `rsvp` / `tachistoscope`)
  const latestMetricsForCoach =
    lastSessionMetrics ||
    (sessionHistory[0] ? summarizeSessionMetrics(sessionHistory[0]) : null);
  const recentModesForCoach = sessionHistory.slice(0, 4).map((s) => s.mode);
  const coachPrescription = computeGuidedCoachPrescription({
    lastMetrics: latestMetricsForCoach,
    recentModes: recentModesForCoach,
  });

  // Apply Guided Curriculum Mode Rotation & Speed for a target passage
  const applyGuidedRecommendationForPassage = useCallback(
    (passageId: string, prof: UserProfile, referenceCurrentWpm: number) => {
      const rec = prof.passageRecords?.[passageId];
      const baseline = prof.baselineWpm || INITIAL_DEFAULT_WPM;
      if (rec && rec.attempts > 0) {
        const resumeWpm = Math.max(
          baseline,
          rec.bestRawWpm || rec.lastTargetWpm || rec.bestEffectiveWpm || baseline
        );
        setTargetWpm(resumeWpm);
      } else {
        const hasAnyPriorPassage =
          Object.keys(prof.passageRecords || {}).length > 0;
        const transferWpm = hasAnyPriorPassage
          ? Math.max(80, Math.round(referenceCurrentWpm * 0.85))
          : baseline;
        setTargetWpm(transferWpm);
      }
      setSelectedMode(coachPrescription.nextMode);
      setFadeOutPassed(coachPrescription.fadeOutPassed);
    },
    [coachPrescription.nextMode, coachPrescription.fadeOutPassed]
  );

  const selectPassageWithCoaching = useCallback(
    (passageId: string) => {
      setSelectedPassageId(passageId);
      setPreviewCheckedIndices([]);
      setLexiconPopup(null);
      if (appMode === 'guided') {
        applyGuidedRecommendationForPassage(passageId, profile, targetWpm);
      }
    },
    [appMode, applyGuidedRecommendationForPassage, profile, targetWpm]
  );

  // Open Untimed Passage Preview & Vocabulary Check Mode
  const openPreviewMode = () => {
    soundEngine.playUiClick();
    setLexiconPopup(null);
    setScreen('preview');
  };

  // Start Self-Paced Baseline Calibration
  const startCalibrationProbe = () => {
    soundEngine.playUiClick();
    setIsCalibratingSession(true);
    setCalibrationCompletedBanner(null);
    setActiveChunkIndex(0);
    setCalibrationStartMs(null);
    setLexiconPopup(null);
    setScreen('calibration');
  };

  const handleAdvanceCalibrationChunk = useCallback(() => {
    const now = Date.now();
    const startMs = calibrationStartMs ?? now;
    if (calibrationStartMs === null) {
      setCalibrationStartMs(now);
    }

    if (activeChunkIndex < CALIBRATION_PASSAGE.chunks.length - 1) {
      const nextIdx = activeChunkIndex + 1;
      setActiveChunkIndex(nextIdx);
      soundEngine.playChunkTick(
        CALIBRATION_PASSAGE.discourseMarkerIndices.includes(nextIdx)
      );
    } else {
      const elapsedMinutes = Math.max(0.08, (now - startMs) / 60000);
      const rawMeasured = Math.max(
        80,
        Math.min(550, Math.round(CALIBRATION_PASSAGE.wordCount / elapsedMinutes))
      );
      setMeasuredCalibrationRawWpm(rawMeasured);
      setTargetWpm(rawMeasured);
      soundEngine.playPassTransition(3);
      setActiveQuizQuestions(shuffleQuizQuestions(CALIBRATION_PASSAGE.questions));
      setQuizIndex(0);
      setSelectedOption(null);
      setCorrectCount(0);
      setOperatorState('observing');
      setLastResponseSec(null);
      questionStartTimeRef.current = Date.now();
      setScreen('quiz');
    }
  }, [activeChunkIndex, calibrationStartMs]);

  // Effective WPM during reading (accounts for 4/3/2 Overclock pass multiplier)
  const activeWpm =
    selectedMode === 'overclock_432'
      ? overclockPass === 1
        ? targetWpm
        : overclockPass === 2
        ? Math.round(targetWpm / 0.75)
        : Math.round(targetWpm / 0.5)
      : targetWpm;

  const estimatedSeconds = Math.max(
    10,
    Math.round((selectedPassage.wordCount / targetWpm) * 60)
  );

  const handleToggleMute = () => {
    const nextMuted = soundEngine.toggleMute();
    setMuted(nextMuted);
  };

  // Start Reading Session
  const startReadingSession = () => {
    soundEngine.playUiClick();
    setActiveChunkIndex(0);
    setOverclockPass(1);
    setRegressionCount(0);
    setTotalSteps(0);
    setSessionResetKey((k) => k + 1);
    setLexiconPopup(null);
    setIsPlaying(true);
    setScreen('reading');
  };

  // Translate a tapped chunk or individual word into the user's configured target language
  const handleTranslateChunkOrWord = useCallback(
    async (
      queryText: string,
      chunkIdx: number,
      baseChunkText?: string,
      anchorRect?: { x: number; top: number; bottom: number },
      overrideContextSentence?: string
    ) => {
      soundEngine.playUiClick();
      setIsPlaying(false);

      const chunkStr =
        baseChunkText ??
        (chunkIdx >= 0 ? selectedPassage.chunks[chunkIdx] : undefined) ??
        queryText;
      const words = Array.from(
        new Set(
          chunkStr
            .split(/\s+/)
            .map((w) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''))
            .filter((w) => w.length >= 2)
        )
      );

      let contextSentence = overrideContextSentence || '';
      if (!contextSentence) {
        if (chunkIdx >= 0) {
          const start = Math.max(0, chunkIdx - 2);
          const end = Math.min(selectedPassage.chunks.length, chunkIdx + 3);
          contextSentence = selectedPassage.chunks.slice(start, end).join(' ');
        } else {
          contextSentence = chunkStr;
        }
      }

      setLexiconPopup((prev) => ({
        chunkIdx,
        chunkText: chunkStr,
        activeQuery: queryText,
        words,
        contextSentence,
        translation: '',
        loading: true,
        anchorX:
          anchorRect?.x ??
          prev?.anchorX ??
          (typeof window !== 'undefined' ? window.innerWidth / 2 : 200),
        anchorTop:
          anchorRect?.top ??
          prev?.anchorTop ??
          (typeof window !== 'undefined' ? window.innerHeight / 2 - 20 : 200),
        anchorBottom:
          anchorRect?.bottom ??
          prev?.anchorBottom ??
          (typeof window !== 'undefined' ? window.innerHeight / 2 + 20 : 240),
      }));

      try {
        const res = await translateSelection({
          text: queryText,
          contextSentence,
          targetLang: translationLang,
          provider: llmProvider,
          webLlmModel: selectedWebLlmModel,
          llmEndpoint: profile.llmEndpoint,
          llmModel: profile.llmModel,
          allowCloudApi: allowCloudTranslation,
        });
        setLexiconPopup((prev) =>
          prev && prev.activeQuery === queryText
            ? {
                ...prev,
                translation: res.translation,
                source: res.source,
                loading: false,
              }
            : prev
        );
      } catch (err) {
        setLexiconPopup((prev) =>
          prev && prev.activeQuery === queryText
            ? {
                ...prev,
                loading: false,
                error:
                  err instanceof Error ? err.message : 'Translation failed',
              }
            : prev
        );
      }
    },
    [
      selectedPassage.chunks,
      translationLang,
      allowCloudTranslation,
      llmProvider,
      selectedWebLlmModel,
      profile.llmEndpoint,
      profile.llmModel,
    ]
  );

  // Universal Tap-to-Translate handler for any non-button text in Quiz, UI, Result, or Modals
  const handleGlobalContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('[data-lexicon-popup="true"]')) return;

      if (
        target.closest(
          'button:not(:disabled), a, input, select, textarea, label, [data-chunk-interactive="true"]'
        )
      ) {
        return;
      }

      const hit = extractWordAtClientPoint(e.clientX, e.clientY);
      if (hit) {
        void handleTranslateChunkOrWord(
          hit.word,
          -1,
          hit.phrase,
          hit.rect,
          hit.contextSentence
        );
      } else if (lexiconPopup) {
        setLexiconPopup(null);
      }
    },
    [handleTranslateChunkOrWord, lexiconPopup]
  );

  // Transition from Reading to Quiz
  const startQuizPhase = useCallback(() => {
    setIsPlaying(false);
    setLexiconPopup(null);
    setActiveQuizQuestions(shuffleQuizQuestions(selectedPassage.questions));
    setQuizIndex(0);
    setSelectedOption(null);
    setCorrectCount(0);
    setOperatorState('observing');
    setLastResponseSec(null);
    questionStartTimeRef.current = Date.now();
    setScreen('quiz');
  }, [selectedPassage.questions]);

  // Finalize Session & Save to IndexedDB
  const finalizeSession = useCallback(
    async (
      finalCorrect: number,
      totalQuestions: number,
      overrideFixationMs?: number
    ) => {
      const syncRate =
        totalQuestions > 0 ? finalCorrect / totalQuestions : 1;
      const quizPassed = syncRate >= QUIZ_PASS_THRESHOLD;

      if (isCalibratingSession) {
        const calibratedWpm = quizPassed
          ? measuredCalibrationRawWpm
          : Math.max(100, Math.round(measuredCalibrationRawWpm * 0.85));
        try {
          const { profile: updatedProf, newlyUnlocked } =
            await saveCalibrationBaseline(calibratedWpm);
          setProfile(updatedProf);
          setNewlyUnlockedAchievements(newlyUnlocked);
        } catch {
          // Ignore DB error in private browsing
        }
        setIsCalibratingSession(false);
        setTargetWpm(calibratedWpm);
        setSelectedMode('chunk_pacer');
        setFadeOutPassed(false);
        setCalibrationCompletedBanner(calibratedWpm);
        soundEngine.playRecordBreakerFanfare();
        setScreen('home');
        setShowPassageModal(true);
        return;
      }

      const effectiveWpm = Math.round(targetWpm * syncRate);
      const avgWordsPerChunk =
        selectedPassage.chunks.length > 0
          ? Number(
              (
                selectedPassage.wordCount / selectedPassage.chunks.length
              ).toFixed(1)
            )
          : 2.8;
      const fixationMs =
        overrideFixationMs ??
        Math.round((avgWordsPerChunk / targetWpm) * 60000);
      const forwardFlowRate =
        totalSteps > 0
          ? Math.max(0, (totalSteps - regressionCount) / totalSteps)
          : 1;

      const metrics: FiveAxisMetrics = {
        effectiveWpm,
        fixationMs,
        perceptualSpan: avgWordsPerChunk,
        forwardFlowRate,
        syncRate,
      };
      setLastSessionMetrics(metrics);

      const log: SessionLog = {
        id: `sess-${Date.now()}`,
        timestamp: Date.now(),
        passageId: selectedPassage.id,
        mode: selectedMode,
        rawWpm: targetWpm,
        syncRate,
        effectiveWpm,
        fixationMs,
        perceptualSpan: avgWordsPerChunk,
        forwardFlowRate,
        synced: 0,
      };

      let beatOverall = false;
      let beatPassage = false;

      try {
        const result = await recordSessionAndUpdateProfile(
          log,
          selectedPassage.wordCount,
          targetWpm,
          selectedPassage.category
        );
        setProfile(result.profile);
        beatOverall = result.isNewOverallBest;
        beatPassage = result.isNewPassageBest;
        setIsNewPersonalBest(result.isNewOverallBest);
        setIsNewPassageBest(result.isNewPassageBest);
        setPreviousPassageBest(result.previousPassageBest);
        setNewlyUnlockedAchievements(result.newlyUnlocked);
        setSessionHistory((prev) => [log, ...prev.slice(0, 29)]);
      } catch {
        // Ignore DB error in private browsing
      }

      const { nextWpm } = computeNextTargetWpm(
        targetWpm,
        syncRate,
        forwardFlowRate
      );
      setTargetWpm(nextWpm);

      if (appMode === 'guided') {
        const nextRx = computeGuidedCoachPrescription({
          lastMetrics: metrics,
          recentModes: [
            selectedMode,
            ...sessionHistory.slice(0, 3).map((s) => s.mode),
          ],
        });
        setSelectedMode(nextRx.nextMode);
        setFadeOutPassed(nextRx.fadeOutPassed);
      }

      if (beatOverall || beatPassage) {
        soundEngine.playRecordBreakerFanfare();
        window.setTimeout(() => setJuiceShake(true), 40);
        window.setTimeout(() => setJuiceShake(false), 550);
      } else {
        soundEngine.playRankConfirm();
      }
      setScreen('result');
    },
    [
      appMode,
      isCalibratingSession,
      measuredCalibrationRawWpm,
      targetWpm,
      selectedPassage,
      totalSteps,
      regressionCount,
      selectedMode,
      sessionHistory,
    ]
  );

  // Auto-advance timer during Reading Screen (for non-tachistoscope modes)
  useEffect(() => {
    if (
      screen !== 'reading' ||
      !isPlaying ||
      selectedMode === 'tachistoscope'
    ) {
      return;
    }

    const intervalMs = computeChunkDurationMs(
      selectedPassage.chunks,
      activeChunkIndex,
      selectedPassage.wordCount,
      activeWpm,
      selectedMode
    );

    const timer = window.setTimeout(() => {
      if (activeChunkIndex < selectedPassage.chunks.length - 1) {
        const nextIdx = activeChunkIndex + 1;
        setActiveChunkIndex(nextIdx);
        setTotalSteps((s) => s + 1);
        const isMarker =
          selectedPassage.discourseMarkerIndices.includes(nextIdx);
        soundEngine.playChunkTick(isMarker);
      } else if (selectedMode === 'overclock_432' && overclockPass < 3) {
        const nextPass = (overclockPass + 1) as 2 | 3;
        soundEngine.playPassTransition(nextPass);
        setOverclockPass(nextPass);
        setActiveChunkIndex(0);
        setSessionResetKey((k) => k + 1);
      } else {
        soundEngine.playPassTransition(3);
        startQuizPhase();
      }
    }, Math.max(65, intervalMs));

    return () => window.clearTimeout(timer);
  }, [
    screen,
    isPlaying,
    activeChunkIndex,
    activeWpm,
    selectedPassage,
    selectedMode,
    overclockPass,
    startQuizPhase,
  ]);

  // Keyboard shortcuts during Reading Screen
  useEffect(() => {
    if (screen !== 'reading' || selectedMode === 'tachistoscope') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        soundEngine.playUiClick();
        setIsPlaying((p) => {
          if (!p) setLexiconPopup(null);
          return !p;
        });
      } else if (e.code === 'Escape') {
        setLexiconPopup(null);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (activeChunkIndex < selectedPassage.chunks.length - 1) {
          const nextIdx = activeChunkIndex + 1;
          setActiveChunkIndex(nextIdx);
          setTotalSteps((s) => s + 1);
          soundEngine.playChunkTick(
            selectedPassage.discourseMarkerIndices.includes(nextIdx)
          );
        } else {
          startQuizPhase();
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (activeChunkIndex > 0) {
          setActiveChunkIndex((i) => i - 1);
          setRegressionCount((r) => r + 1);
          setTotalSteps((s) => s + 1);
          soundEngine.playChunkTick(false);
        }
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 10;
        setTargetWpm((w) => Math.min(900, w + step));
        soundEngine.playUiClick();
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 10;
        setTargetWpm((w) => Math.max(60, w - step));
        soundEngine.playUiClick();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, selectedMode, activeChunkIndex, selectedPassage, startQuizPhase]);

  // Keyboard shortcuts during Self-Paced Calibration
  useEffect(() => {
    if (screen !== 'calibration') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
        e.preventDefault();
        handleAdvanceCalibrationChunk();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, handleAdvanceCalibrationChunk]);

  // Handle Quiz Option Selection
  const handleSelectQuizOption = useCallback(
    (optIndex: number) => {
      if (selectedOption !== null) return;
      const elapsedSec = (Date.now() - questionStartTimeRef.current) / 1000;
      setLastResponseSec(elapsedSec);
      setSelectedOption(optIndex);

      const currentQuestion =
        activeQuizQuestions[quizIndex] || selectedPassage.questions[quizIndex];
      const isCorrect = optIndex === currentQuestion.correctIndex;
      const isCritical = isCorrect && elapsedSec <= 3.0;

      if (isCorrect) {
        setCorrectCount((c) => c + 1);
        setOperatorState(isCritical ? 'critical_break' : 'confirmed');
        soundEngine.playQuizCorrect(isCritical);
        window.setTimeout(() => setJuiceShake(true), 50);
        window.setTimeout(() => setJuiceShake(false), 450);
      } else {
        setOperatorState('desync');
        soundEngine.playQuizWrong();
      }
    },
    [selectedOption, activeQuizQuestions, selectedPassage.questions, quizIndex]
  );

  // Advance to Next Quiz Question or Final Result
  const handleNextQuizStep = useCallback(() => {
    soundEngine.playUiClick();
    const totalQ = activeQuizQuestions.length || selectedPassage.questions.length;
    if (quizIndex < totalQ - 1) {
      setQuizIndex((i) => i + 1);
      setSelectedOption(null);
      setOperatorState('observing');
      setLastResponseSec(null);
      questionStartTimeRef.current = Date.now();
    } else {
      finalizeSession(correctCount, totalQ);
    }
  }, [
    quizIndex,
    activeQuizQuestions.length,
    selectedPassage.questions.length,
    finalizeSession,
    correctCount,
  ]);

  // Keyboard shortcuts 1-4 and Enter on Quiz Screen
  useEffect(() => {
    if (screen !== 'quiz') return;
    const onKey = (e: KeyboardEvent) => {
      if (
        selectedOption === null &&
        ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)
      ) {
        const idx = Number(e.code.replace('Digit', '')) - 1;
        handleSelectQuizOption(idx);
      } else if (
        selectedOption !== null &&
        (e.code === 'Enter' || e.code === 'Space')
      ) {
        e.preventDefault();
        handleNextQuizStep();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, selectedOption, handleSelectQuizOption, handleNextQuizStep]);

  // Non-blocking background LLM quiz synthesis (runs while user reads rule-chunked passage)
  const upgradePassageQuizInBackground = useCallback(
    (basePassage: TrainingPassage) => {
      if (llmProvider === 'rule_based') return;
      setBgQuizStatus({
        passageId: basePassage.id,
        state: 'running',
        detail: 'SYNTHESIZING AI QUIZ...',
      });

      void processPassageWithOptionalLlm({
        title: basePassage.title,
        rawText: basePassage.rawText,
        category: basePassage.category,
        sourceType: basePassage.sourceType,
        provider: llmProvider,
        webLlmModel: selectedWebLlmModel,
        llmEndpoint: profile.llmEndpoint,
        llmModel: profile.llmModel,
      }).then(async ({ passage: upgraded, usedProvider }) => {
        if (isWebLlmReady(selectedWebLlmModel)) {
          setWebLlmStatus('READY IN VRAM');
        }
        if (usedProvider !== 'rule_based') {
          const merged: TrainingPassage = {
            ...basePassage,
            questions: upgraded.questions,
          };
          await db.customPassages.put(merged);
          setCustomPassages((prev) =>
            prev.map((p) => (p.id === basePassage.id ? merged : p))
          );
          setBgQuizStatus({
            passageId: basePassage.id,
            state: 'ready',
            detail: `AI QUIZ READY (${usedProvider.toUpperCase()})`,
          });
        } else {
          setBgQuizStatus({
            passageId: basePassage.id,
            state: 'fallback',
            detail: 'RULE QUIZ ACTIVE',
          });
        }
      });
    },
    [
      llmProvider,
      selectedWebLlmModel,
      profile.llmEndpoint,
      profile.llmModel,
    ]
  );

  // Live Feed Handler (Wikipedia / Art / Dev.to) — Instant rule chunking + Background LLM Quiz
  const handleFetchLivePassage = async (
    source: 'wikipedia' | 'wikipedia_art' | 'devto'
  ) => {
    setIsFetchingFeed(true);
    setFeedStatusMsg(
      source === 'wikipedia'
        ? 'Fetching random summary from Wikipedia REST API...'
        : source === 'wikipedia_art'
        ? 'Fetching Arts & Aesthetics summary from Wikipedia REST API...'
        : 'Fetching top tech article from Dev.to API...'
    );
    try {
      const raw =
        source === 'wikipedia'
          ? await fetchWikipediaPassage()
          : source === 'wikipedia_art'
          ? await fetchWikipediaArtPassage()
          : await fetchDevToPassage();

      const instantPassage = buildNormalizedPassage({
        title: raw.title,
        rawText: raw.rawText,
        category: raw.category,
        sourceType: source === 'devto' ? 'devto' : 'wikipedia',
      });

      await db.customPassages.put(instantPassage);
      setCustomPassages((prev) => [instantPassage, ...prev]);
      selectPassageWithCoaching(instantPassage.id);
      setFeedStatusMsg('');
      setShowPassageModal(false);
      soundEngine.playQuizCorrect(false);

      upgradePassageQuizInBackground(instantPassage);
    } catch (err) {
      setFeedStatusMsg(
        `Fetch failed: ${err instanceof Error ? err.message : 'Network error'}`
      );
    } finally {
      setIsFetchingFeed(false);
    }
  };

  // Custom Text Handler — Instant rule chunking + Background LLM Quiz
  const handleCreateCustomPassage = async () => {
    if (customRawText.trim().split(/\s+/).length < 25) {
      setFeedStatusMsg('Please paste at least 25 words of English text.');
      return;
    }
    setIsFetchingFeed(true);
    try {
      const instantPassage = buildNormalizedPassage({
        title: customTitle.trim() || 'Custom Neural Transmission',
        rawText: customRawText.trim(),
        category: 'CUSTOM',
        sourceType: 'custom',
      });

      await db.customPassages.put(instantPassage);
      setCustomPassages((prev) => [instantPassage, ...prev]);
      selectPassageWithCoaching(instantPassage.id);
      setCustomTitle('');
      setCustomRawText('');
      setFeedStatusMsg('');
      setShowPassageModal(false);
      soundEngine.playQuizCorrect(false);

      upgradePassageQuizInBackground(instantPassage);
    } finally {
      setIsFetchingFeed(false);
    }
  };

  // Export DB Backup
  const handleExportJson = async () => {
    const json = await exportDatabaseJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wetware-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stepLabel =
    screen === 'title'
      ? 'MODE SELECT'
      : screen === 'calibration'
      ? 'NEURAL CALIBRATION'
      : screen === 'home'
      ? appMode === 'guided'
        ? 'NEURAL COACH'
        : 'FREEPLAY LAB'
      : screen === 'preview'
      ? 'PRE-FLIGHT VOCAB SCAN'
      : screen === 'reading'
      ? `TRAINING // ${MODE_INFO[selectedMode].label}`
      : screen === 'quiz'
      ? `NEURAL VERIFICATION (${quizIndex + 1}/${
          activeQuizQuestions.length || 3
        })`
      : 'SESSION REPORT';

  return (
    <div
      onClick={handleGlobalContainerClick}
      className={`min-h-screen flex flex-col bg-[#0D0618] text-[#F2F5F8] ${
        juiceShake ? 'animate-cyber-shake animate-chromatic-flash' : ''
      }`}
    >
      <CRTScanlineOverlay enabled={scanlineEnabled} maskReadingZone={true} />

      <PeripheralSpeedCanvas
        wpm={activeWpm}
        active={
          screen === 'reading' &&
          isPlaying &&
          selectedMode !== 'tachistoscope'
        }
      />

      <CyberHeader
        currentStepLabel={stepLabel}
        muted={muted}
        sessionCount={sessionHistory.length}
        achievementCount={profile.unlockedAchievements?.length || 0}
        totalAchievements={ACHIEVEMENT_CATALOG.length}
        llmDownloadProgressPct={
          isPreloadingWebLlm ? (webLlmProgressPct ?? 0) : null
        }
        onToggleMute={handleToggleMute}
        onOpenAchievements={() => setShowAchievementsModal(true)}
        onOpenHistory={() => setShowHistoryModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onGoHome={() => {
          setIsPlaying(false);
          setIsCalibratingSession(false);
          setScreen('title');
        }}
      />

      {screen === 'title' && (
        <TitleScreen
          profile={profile}
          onEnterGuided={() => {
            setAppMode('guided');
            if (!profile.baselineWpm) {
              startCalibrationProbe();
            } else {
              applyGuidedRecommendationForPassage(
                selectedPassageId,
                profile,
                targetWpm
              );
              setScreen('home');
            }
          }}
          onRecalibrate={() => {
            setAppMode('guided');
            startCalibrationProbe();
          }}
          onEnterFreeplay={() => {
            setAppMode('freeplay');
            setScreen('home');
          }}
        />
      )}

      {screen === 'calibration' && (
        <CalibrationScreen
          activeChunkIndex={activeChunkIndex}
          onAdvanceChunk={handleAdvanceCalibrationChunk}
          onCancel={() => {
            setIsCalibratingSession(false);
            setScreen('title');
          }}
        />
      )}

      {screen === 'home' && (
        <HomeScreen
          appMode={appMode}
          profile={profile}
          coachPrescription={coachPrescription}
          selectedMode={selectedMode}
          setSelectedMode={setSelectedMode}
          targetWpm={targetWpm}
          setTargetWpm={setTargetWpm}
          selectedPassage={selectedPassage}
          estimatedSeconds={estimatedSeconds}
          bgQuizStatus={bgQuizStatus}
          calibrationCompletedBanner={calibrationCompletedBanner}
          setCalibrationCompletedBanner={setCalibrationCompletedBanner}
          onBackToProtocols={() => setScreen('title')}
          onToggleAppMode={() => {
            const nextMode = appMode === 'guided' ? 'freeplay' : 'guided';
            setAppMode(nextMode);
            if (nextMode === 'guided') {
              applyGuidedRecommendationForPassage(
                selectedPassage.id,
                profile,
                targetWpm
              );
            }
          }}
          onOpenPreview={openPreviewMode}
          onOpenPassageModal={() => setShowPassageModal(true)}
          onStartReadingSession={startReadingSession}
        />
      )}

      {screen === 'preview' && (
        <PreviewScreen
          selectedPassage={selectedPassage}
          targetWpm={targetWpm}
          previewCheckedIndices={previewCheckedIndices}
          setPreviewCheckedIndices={setPreviewCheckedIndices}
          lexiconPopup={lexiconPopup}
          onTranslateChunkOrWord={handleTranslateChunkOrWord}
          onBackToSetup={() => {
            setLexiconPopup(null);
            setScreen('home');
          }}
          onStartReadingSession={startReadingSession}
        />
      )}

      {screen === 'reading' && (
        <ReadingScreen
          selectedMode={selectedMode}
          selectedPassage={selectedPassage}
          profile={profile}
          targetWpm={targetWpm}
          setTargetWpm={setTargetWpm}
          activeWpm={activeWpm}
          activeChunkIndex={activeChunkIndex}
          setActiveChunkIndex={setActiveChunkIndex}
          overclockPass={overclockPass}
          isPlaying={isPlaying}
          fadeOutPassed={fadeOutPassed}
          sessionResetKey={sessionResetKey}
          onAbort={() => {
            setIsPlaying(false);
            setLexiconPopup(null);
            setScreen('home');
          }}
          onTogglePlayPause={() => {
            setIsPlaying((p) => {
              if (!p) setLexiconPopup(null);
              return !p;
            });
          }}
          onIncrementRegression={() => {
            setRegressionCount((r) => r + 1);
            setTotalSteps((s) => s + 1);
          }}
          onTranslateChunkOrWord={handleTranslateChunkOrWord}
          onStartQuizPhase={startQuizPhase}
          onCompleteTachistoscope={(correctRounds, totalRounds, flashMs) => {
            finalizeSession(correctRounds, totalRounds, flashMs);
          }}
        />
      )}

      {screen === 'quiz' && (
        <QuizScreen
          operatorState={operatorState}
          lastResponseSec={lastResponseSec}
          activeQuizQuestions={activeQuizQuestions}
          selectedPassage={selectedPassage}
          quizIndex={quizIndex}
          selectedOption={selectedOption}
          onSelectQuizOption={handleSelectQuizOption}
          onNextQuizStep={handleNextQuizStep}
          onTranslateChunkOrWord={handleTranslateChunkOrWord}
        />
      )}

      {screen === 'result' && lastSessionMetrics && (
        <ResultScreen
          appMode={appMode}
          lastSessionMetrics={lastSessionMetrics}
          coachPrescription={coachPrescription}
          targetWpm={targetWpm}
          setTargetWpm={setTargetWpm}
          profile={profile}
          selectedPassage={selectedPassage}
          isNewPersonalBest={isNewPersonalBest}
          isNewPassageBest={isNewPassageBest}
          previousPassageBest={previousPassageBest}
          newlyUnlockedAchievements={newlyUnlockedAchievements}
          onTrainSamePassage={(nextMode, nextFadeOut) => {
            if (appMode === 'guided') {
              setSelectedMode(nextMode);
              setFadeOutPassed(nextFadeOut);
            }
            startReadingSession();
          }}
          onSwitchPassage={() => {
            setScreen('home');
            setShowPassageModal(true);
          }}
        />
      )}

      {showPassageModal && (
        <PassageSelectorModal
          allPassages={allPassages}
          selectedPassage={selectedPassage}
          profile={profile}
          passageModalTab={passageModalTab}
          setPassageModalTab={setPassageModalTab}
          isFetchingFeed={isFetchingFeed}
          feedStatusMsg={feedStatusMsg}
          customTitle={customTitle}
          setCustomTitle={setCustomTitle}
          customRawText={customRawText}
          setCustomRawText={setCustomRawText}
          onSelectPassage={selectPassageWithCoaching}
          onFetchLivePassage={handleFetchLivePassage}
          onCreateCustomPassage={handleCreateCustomPassage}
          onClose={() => setShowPassageModal(false)}
        />
      )}

      {showHistoryModal && (
        <SessionHistoryModal
          profile={profile}
          sessionHistory={sessionHistory}
          onExportJson={handleExportJson}
          onReloadFromDb={reloadFromDb}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {showAchievementsModal && (
        <AchievementsModal
          profile={profile}
          onClose={() => setShowAchievementsModal(false)}
        />
      )}

      {showSettingsModal && (
        <SystemSettingsModal
          profile={profile}
          setProfile={setProfile}
          chunkTickOn={chunkTickOn}
          setChunkTickOn={setChunkTickOn}
          fadeOutPassed={fadeOutPassed}
          setFadeOutPassed={setFadeOutPassed}
          scanlineEnabled={scanlineEnabled}
          setScanlineEnabled={setScanlineEnabled}
          translationLang={translationLang}
          setTranslationLang={setTranslationLang}
          allowCloudTranslation={allowCloudTranslation}
          setAllowCloudTranslation={setAllowCloudTranslation}
          llmProvider={llmProvider}
          setLlmProvider={setLlmProvider}
          selectedWebLlmModel={selectedWebLlmModel}
          setSelectedWebLlmModel={setSelectedWebLlmModel}
          cachedModels={cachedModels}
          setCachedModels={setCachedModels}
          webLlmStatus={webLlmStatus}
          setWebLlmStatus={setWebLlmStatus}
          isPreloadingWebLlm={isPreloadingWebLlm}
          setIsPreloadingWebLlm={setIsPreloadingWebLlm}
          webLlmProgressPct={webLlmProgressPct}
          setWebLlmProgressPct={setWebLlmProgressPct}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {lexiconPopup && (
        <LexiconPopover
          popup={lexiconPopup}
          screen={screen}
          translationLang={translationLang}
          onTranslateQuery={handleTranslateChunkOrWord}
          onClose={() => setLexiconPopup(null)}
          onResumeReading={() => {
            setLexiconPopup(null);
            setIsPlaying(true);
          }}
          onOpenSettings={() => {
            setLexiconPopup(null);
            setShowSettingsModal(true);
          }}
        />
      )}
    </div>
  );
}

export default App;
