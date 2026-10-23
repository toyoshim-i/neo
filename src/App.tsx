import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  ArrowLeft,
  BookOpen,
  Zap,
  CheckCircle2,
  XCircle,
  X,
  Sliders,
  Volume2,
  Eye,
  Globe,
  FileText,
  Download,
  Upload,
  Loader2,
  Cpu,
  Languages,
  Award,
  Compass,
  Trophy,
  Sparkles,
} from 'lucide-react';
import { CyberHeader } from './components/layout/CyberHeader';
import { ChamferedPanel } from './components/layout/ChamferedPanel';
import { CRTScanlineOverlay } from './components/layout/CRTScanlineOverlay';
import { GhostRacingBar } from './components/reader/GhostRacingBar';
import { PeripheralSpeedCanvas } from './components/reader/PeripheralSpeedCanvas';
import { TachistoscopeView } from './components/reader/TachistoscopeView';
import { RadarBenchmarkChart } from './components/dashboard/RadarBenchmarkChart';
import { OperatorMonitor, OperatorState } from './components/quiz/OperatorMonitor';
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
  calculateHumanBenchmark,
  computeNextTargetWpm,
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
  importDatabaseJson,
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
  initWebLlmEngine,
  isWebGpuSupported,
  isWebLlmReady,
  checkCachedWebLlmModels,
  saveWebLlmModelSelection,
  TranslationLangCode,
  TRANSLATION_LANGUAGES,
  getSavedTranslationLang,
  saveTranslationLangSelection,
  translateSelection,
} from './lib/llmClient';
import { buildNormalizedPassage } from './lib/chunker';

type ScreenState = 'title' | 'calibration' | 'home' | 'reading' | 'quiz' | 'result';
type AppExperienceMode = 'guided' | 'freeplay';
type PassageModalTab = 'presets' | 'live' | 'custom';

const MODE_INFO: Record<TrainingMode, { label: string; shortDesc: string }> = {
  chunk_pacer: {
    label: 'CHUNK PACER',
    shortDesc:
      'Full paragraph view with auto-advancing 2–4 word semantic highlights.',
  },
  rsvp: {
    label: 'RSVP STREAM',
    shortDesc:
      'Lock your gaze at the center ORP reticle as chunks flash sequentially.',
  },
  overclock_432: {
    label: '4/3/2 OVERCLOCK',
    shortDesc:
      'Read the same passage across 3 passes at 100% → 75% → 50% time compression.',
  },
  tachistoscope: {
    label: 'TACHISTOSCOPE',
    shortDesc:
      'Flash 3–4 word phrases for ~170ms to train parallel parafoveal recognition.',
  },
};

function shuffleQuizQuestions(questions: QuizQuestion[]): QuizQuestion[] {
  return questions.map((q) => {
    const pairs = q.options.map((text, idx) => ({
      text,
      isCorrect: idx === q.correctIndex,
    }));
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pairs[i];
      pairs[i] = pairs[j];
      pairs[j] = tmp;
    }
    const newOptions = pairs.map((p) => p.text) as [
      string,
      string,
      string,
      string,
    ];
    const newCorrectIndex = Math.max(
      0,
      pairs.findIndex((p) => p.isCorrect)
    );
    return {
      ...q,
      options: newOptions,
      correctIndex: newCorrectIndex,
    };
  });
}

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
  const [showSynthTestInSettings, setShowSynthTestInSettings] =
    useState<boolean>(false);
  const [showLlmTestInSettings, setShowLlmTestInSettings] =
    useState<boolean>(false);
  const [isRunningLlmDiag, setIsRunningLlmDiag] = useState<boolean>(false);
  const [llmDiagStatus, setLlmDiagStatus] = useState<string>('');
  const [llmDiagResult, setLlmDiagResult] = useState<{
    usedProvider: LlmProviderType;
    elapsedMs: number;
    chunks: string[];
    sampleQuestion: string;
    sampleOptions?: string[];
    sampleAnswer: string;
    fallbackReason?: string;
  } | null>(null);
  const [cachedModels, setCachedModels] = useState<
    Record<WebLlmModelId, boolean>
  >({
    'gemma3-1b-it-q4f16_1-MLC': false,
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
  const [llmProvider, setLlmProvider] = useState<LlmProviderType>(
    isWebGpuSupported() ? 'webllm' : 'rule_based'
  );
  const [selectedWebLlmModel, setSelectedWebLlmModel] =
    useState<WebLlmModelId>(DEFAULT_WEBLLM_MODEL);
  const [webLlmStatus, setWebLlmStatus] = useState<string>(
    isWebLlmReady(DEFAULT_WEBLLM_MODEL) ? 'READY IN VRAM' : 'NOT LOADED'
  );
  const [isPreloadingWebLlm, setIsPreloadingWebLlm] = useState<boolean>(false);

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
  const [lexiconPopup, setLexiconPopup] = useState<{
    chunkIdx: number;
    chunkText: string;
    activeQuery: string;
    words: string[];
    contextSentence: string;
    translation: string;
    source?: 'webllm' | 'ollama' | 'cloud_dict';
    loading: boolean;
    error?: string;
    anchorX: number;
    anchorTop: number;
    anchorBottom: number;
  } | null>(null);

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

  useEffect(() => {
    reloadFromDb();
    checkCachedWebLlmModels().then((cacheMap) => {
      setCachedModels(cacheMap);
      // If current default model is not cached, but another Gemma model IS already cached, select the cached one
      if (!cacheMap[selectedWebLlmModel]) {
        const cachedEntry = WEBLLM_MODEL_OPTIONS.find((m) => cacheMap[m.id]);
        if (cachedEntry) {
          setSelectedWebLlmModel(cachedEntry.id);
          saveWebLlmModelSelection(cachedEntry.id);
          setWebLlmStatus(
            isWebLlmReady(cachedEntry.id)
              ? 'READY IN VRAM'
              : 'CACHED ON DISK (READY TO LOAD)'
          );
          return;
        }
      }
      setWebLlmStatus(
        isWebLlmReady(selectedWebLlmModel)
          ? 'READY IN VRAM'
          : cacheMap[selectedWebLlmModel]
          ? 'CACHED ON DISK (READY TO LOAD)'
          : 'NOT DOWNLOADED'
      );
    });
  }, [reloadFromDb]);

  const allPassages: TrainingPassage[] = [
    ...customPassages,
    ...PRESET_PASSAGES,
  ];
  const selectedPassage = isCalibratingSession
    ? CALIBRATION_PASSAGE
    : allPassages.find((p) => p.id === selectedPassageId) || PRESET_PASSAGES[0];

  // Apply Guided Curriculum Stage & Speed for a target passage
  const applyGuidedRecommendationForPassage = useCallback(
    (passageId: string, prof: UserProfile, referenceCurrentWpm: number) => {
      const rec = prof.passageRecords?.[passageId];
      const baseline = prof.baselineWpm || INITIAL_DEFAULT_WPM;
      if (rec && rec.attempts > 0) {
        // Previously played passage: resume from its recorded best raw/effective speed
        const resumeWpm = Math.max(
          baseline,
          rec.bestRawWpm || rec.lastTargetWpm || rec.bestEffectiveWpm || baseline
        );
        setTargetWpm(resumeWpm);
        if (rec.stageCompleted === 0) {
          setSelectedMode('chunk_pacer');
          setFadeOutPassed(false);
        } else if (rec.stageCompleted === 1) {
          setSelectedMode('chunk_pacer');
          setFadeOutPassed(true);
        } else {
          setSelectedMode('overclock_432');
          setFadeOutPassed(true);
        }
      } else {
        // Unseen passage: transfer at 85% of prior active speed (or baseline if first passage)
        const hasAnyPriorPassage =
          Object.keys(prof.passageRecords || {}).length > 0;
        const transferWpm = hasAnyPriorPassage
          ? Math.max(80, Math.round(referenceCurrentWpm * 0.85))
          : baseline;
        setTargetWpm(transferWpm);
        setSelectedMode('chunk_pacer');
        setFadeOutPassed(false);
      }
    },
    []
  );

  const selectPassageWithCoaching = useCallback(
    (passageId: string) => {
      setSelectedPassageId(passageId);
      if (appMode === 'guided') {
        applyGuidedRecommendationForPassage(passageId, profile, targetWpm);
      }
    },
    [appMode, applyGuidedRecommendationForPassage, profile, targetWpm]
  );

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
      // Completed reading all chunks in self-paced calibration
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
      anchorRect?: { x: number; top: number; bottom: number }
    ) => {
      soundEngine.playUiClick();
      setIsPlaying(false);

      const chunkStr =
        baseChunkText ?? selectedPassage.chunks[chunkIdx] ?? queryText;
      const words = Array.from(
        new Set(
          chunkStr
            .split(/\s+/)
            .map((w) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ''))
            .filter((w) => w.length >= 2)
        )
      );

      // Build surrounding ~12-word context window
      const start = Math.max(0, chunkIdx - 2);
      const end = Math.min(selectedPassage.chunks.length, chunkIdx + 3);
      const contextSentence = selectedPassage.chunks.slice(start, end).join(' ');

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
      llmProvider,
      selectedWebLlmModel,
      profile.llmEndpoint,
      profile.llmModel,
    ]
  );

  // Transition from Reading to Quiz
  const startQuizPhase = useCallback(() => {
    setIsPlaying(false);
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

      // Special Flow: Finishing Self-Paced Baseline Calibration
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

      // Compute suggested next speed immediately so user can also tweak it manually on the Result screen
      const { nextWpm } = computeNextTargetWpm(
        targetWpm,
        syncRate,
        forwardFlowRate
      );
      setTargetWpm(nextWpm);

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
      isCalibratingSession,
      measuredCalibrationRawWpm,
      targetWpm,
      selectedPassage,
      totalSteps,
      regressionCount,
      selectedMode,
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

    const currentChunk = selectedPassage.chunks[activeChunkIndex] || '';
    const wordsInChunk = Math.max(1, currentChunk.split(/\s+/).length);
    let intervalMs = Math.round((wordsInChunk / activeWpm) * 60000);

    // Section 4 Mode 2: Punctuation wait control (, x1.3, . x1.8)
    if (/[.!?]$/.test(currentChunk)) {
      intervalMs = Math.round(
        intervalMs * (selectedMode === 'rsvp' ? 1.8 : 1.45)
      );
    } else if (/[,;:—]$/.test(currentChunk)) {
      intervalMs = Math.round(
        intervalMs * (selectedMode === 'rsvp' ? 1.3 : 1.2)
      );
    }

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
        window.setTimeout(() => setJuiceShake(true), 50); // 50ms hit-stop
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

      // 1. Instant (<2ms) rule-based syntactic chunking so reading can start immediately
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

      // 2. Non-blocking background LLM quiz synthesis while the user prepares or reads
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

  // Render ORP (Optimal Recognition Point) pivot highlight for RSVP mode
  const renderRsvpChunk = (chunk: string) => {
    const cleanLength = chunk.length;
    const pivotIdx = Math.max(0, Math.floor(cleanLength * 0.33));
    const before = chunk.slice(0, pivotIdx);
    const pivot = chunk.charAt(pivotIdx);
    const after = chunk.slice(pivotIdx + 1);

    return (
      <div className="font-terminal text-3xl sm:text-5xl font-bold tracking-wide select-none flex items-center justify-center">
        <span className="text-[#F2F5F8] text-right min-w-[7ch]">{before}</span>
        <span className="text-[#FF1E7A] underline decoration-[#FF1E7A] underline-offset-8 px-0.5">
          {pivot}
        </span>
        <span className="text-[#F2F5F8] text-left min-w-[10ch]">{after}</span>
      </div>
    );
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
      : screen === 'reading'
      ? `TRAINING // ${MODE_INFO[selectedMode].label}`
      : screen === 'quiz'
      ? `NEURAL VERIFICATION (${quizIndex + 1}/${selectedPassage.questions.length})`
      : 'SESSION REPORT';

  return (
    <div
      className={`min-h-screen flex flex-col bg-[#0D0618] text-[#F2F5F8] ${
        juiceShake ? 'animate-cyber-shake animate-chromatic-flash' : ''
      }`}
    >
      <CRTScanlineOverlay enabled={scanlineEnabled} maskReadingZone={true} />

      {/* Peripheral Speed Lines Canvas (Only active during reading at high WPM) */}
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

      {/* =========================================================
          SCREEN 0: TITLE & PROTOCOL LAUNCHER (Guided vs Freeplay)
      ========================================================= */}
      {screen === 'title' && (
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
                    <div className="text-[#00F5D4] font-bold">
                      STAGE 1: CHUNK
                    </div>
                    <div className="text-[#6C7A89] mt-0.5">
                      Absorb meaning &amp; vocabulary at comfortable speed.
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#0D0618] border border-[#00F5D4]/30">
                    <div className="text-[#FFE600] font-bold">
                      STAGE 2: PACER
                    </div>
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
                      onClick={() => {
                        setAppMode('guided');
                        startCalibrationProbe();
                      }}
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
                  Unrestricted access to all 4 training engines (Chunk Pacer,
                  RSVP Stream, 4/3/2 Overclock, Tachistoscope), manual WPM
                  sliders, and live article feeds.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setAppMode('freeplay');
                    setIsCalibratingSession(false);
                    setScreen('home');
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
      )}

      {/* =========================================================
          SCREEN 0.5: SELF-PACED BASELINE CALIBRATION PROBE
      ========================================================= */}
      {screen === 'calibration' && (
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
                setIsCalibratingSession(false);
                setScreen('title');
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
              Tap the button below (or press <strong>SPACE / →</strong>) each
              time you finish reading the highlighted phrase. Understand the
              meaning naturally—a 3-question check follows!
            </p>

            <div
              onClick={handleAdvanceCalibrationChunk}
              className="leading-[2.2] text-lg sm:text-xl font-medium select-none cursor-pointer p-2"
            >
              {CALIBRATION_PASSAGE.chunks.map((chunk, idx) => {
                const isActive = idx === activeChunkIndex;
                const isPassed = idx < activeChunkIndex;
                return (
                  <span key={idx}>
                    <span
                      className={`inline py-0.5 border-y-2 transition-colors duration-75 ${
                        isActive
                          ? 'bg-[#FFE600]/20 border-[#FFE600] text-[#F2F5F8]'
                          : isPassed
                          ? 'bg-transparent border-[#180B29] text-[#6C7A89]/50'
                          : 'bg-transparent border-[#180B29] text-[#6C7A89]'
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
              onClick={handleAdvanceCalibrationChunk}
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
      )}

      {/* =========================================================
          SCREEN 1: HOME CONSOLE (Guided Coach vs Freeplay Lab)
      ========================================================= */}
      {screen === 'home' && (
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 sm:py-10 flex flex-col justify-center space-y-5">
          {/* Top Protocol Switcher Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#180B29] border border-[#00F5D4]/30 px-3.5 py-2 font-terminal text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setScreen('title');
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
                  const next = appMode === 'guided' ? 'freeplay' : 'guided';
                  setAppMode(next);
                  if (next === 'guided') {
                    applyGuidedRecommendationForPassage(
                      selectedPassage.id,
                      profile,
                      targetWpm
                    );
                  }
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
                  ★ BASELINE CALIBRATION COMPLETE: {calibrationCompletedBanner}{' '}
                  WPM
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
                  const stageNum = rec
                    ? Math.min(3, rec.stageCompleted + 1)
                    : 1;
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
                      L2 Start: <span className="text-[#F2F5F8]">150</span> · Native Avg:{' '}
                      <span className="text-[#F2F5F8]">238 WPM</span>
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
                      <span className="text-[11px] text-[#6C7A89] ml-1.5">
                        WPM
                      </span>
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

              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setShowPassageModal(true);
                }}
                className="cyber-btn px-3.5 py-2 bg-[#0D0618] border border-[#6C7A89]/50 text-xs text-[#F2F5F8] hover:border-[#00F5D4] hover:text-[#00F5D4] shrink-0 flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>CHANGE PASSAGE</span>
              </button>
            </div>
          </ChamferedPanel>

          {/* 3. Primary Call To Action */}
          <button
            type="button"
            onClick={startReadingSession}
            className="cyber-btn w-full py-4 px-6 bg-[#00F5D4] text-[#0D0618] font-bold text-base sm:text-lg tracking-wider flex items-center justify-center gap-3 shadow-[0_0_25px_rgba(0,245,212,0.35)] hover:brightness-110"
          >
            <Zap className="w-5 h-5 fill-current" />
            <span>START READING SESSION</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </main>
      )}

      {/* =========================================================
          SCREEN 2: FOCUSED READING VIEWPORT
      ========================================================= */}
      {screen === 'reading' && (
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col justify-between gap-5 relative z-20">
          {/* Top Reading Control Bar & Ghost Racing Bar */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#180B29] border border-[#00F5D4]/40 px-4 py-2.5 font-terminal text-xs">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setIsPlaying(false);
                  setScreen('home');
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
                      setIsPlaying((p) => {
                        if (!p) setLexiconPopup(null);
                        return !p;
                      });
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
              onComplete={(correctRounds, totalRounds, flashMs) => {
                finalizeSession(correctRounds, totalRounds, flashMs);
              }}
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
                  {renderRsvpChunk(
                    selectedPassage.chunks[activeChunkIndex] || ''
                  )}
                  <div className="w-48 h-px bg-[#FF1E7A]/40 relative">
                    <div className="w-0.5 h-3 bg-[#FF1E7A] absolute left-1/2 -bottom-1.5" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      void handleTranslateChunkOrWord(
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
                <div className="leading-[2.2] text-lg sm:text-xl font-medium select-none">
                  {selectedPassage.chunks.map((chunk, idx) => {
                    const isActive = idx === activeChunkIndex;
                    const isPassed = idx < activeChunkIndex;
                    const isMarker =
                      selectedPassage.discourseMarkerIndices.includes(idx);

                    return (
                      <span key={idx}>
                        <span
                          onClick={(e) => {
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            if (idx < activeChunkIndex) {
                              setRegressionCount((r) => r + 1);
                            }
                            setActiveChunkIndex(idx);
                            void handleTranslateChunkOrWord(chunk, idx, chunk, {
                              x: rect.left + rect.width / 2,
                              top: rect.top,
                              bottom: rect.bottom,
                            });
                          }}
                          title="Tap to pause & translate"
                          style={{
                            opacity: isPassed && fadeOutPassed ? 0.15 : 1,
                          }}
                          className={`inline py-0.5 border-y-2 cursor-pointer transition-colors duration-75 ${
                            isActive
                              ? isMarker
                                ? 'bg-[#FF1E7A]/15 border-[#FF1E7A] text-[#F2F5F8]'
                                : 'bg-[#00F5D4]/15 border-[#00F5D4] text-[#F2F5F8]'
                              : 'bg-transparent border-[#180B29] text-[#6C7A89]'
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

          {/* Floating Near-Chunk Lexicon Popover (Tap-to-Translate Overlay) */}
          {selectedMode !== 'tachistoscope' &&
            lexiconPopup &&
            (() => {
              const vw =
                typeof window !== 'undefined' ? window.innerWidth : 400;
              const vh =
                typeof window !== 'undefined' ? window.innerHeight : 750;
              const popWidth = Math.min(340, vw - 24);
              const halfW = popWidth / 2;
              const clampedLeft = Math.max(
                12 + halfW,
                Math.min(vw - 12 - halfW, lexiconPopup.anchorX)
              );
              // Prefer placing right below the tapped chunk unless near the bottom of screen
              const placeAbove = lexiconPopup.anchorBottom + 170 > vh;
              const topStyle = placeAbove
                ? Math.max(12, lexiconPopup.anchorTop - 12)
                : lexiconPopup.anchorBottom + 8;

              return (
                <div
                  style={{
                    position: 'fixed',
                    left: `${clampedLeft}px`,
                    top: `${topStyle}px`,
                    width: `${popWidth}px`,
                    transform: placeAbove
                      ? 'translate(-50%, -100%)'
                      : 'translate(-50%, 0)',
                  }}
                  className="z-50 p-3 bg-[#0D0618]/95 backdrop-blur-md border-2 border-[#00F5D4] shadow-[0_8px_32px_rgba(0,0,0,0.85),0_0_18px_rgba(0,245,212,0.3)] font-terminal text-xs space-y-2"
                >
                  {/* Popover Header: Phrase + Word Pills + Close */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          void handleTranslateChunkOrWord(
                            lexiconPopup.chunkText,
                            lexiconPopup.chunkIdx,
                            lexiconPopup.chunkText
                          )
                        }
                        className={`px-1.5 py-0.5 border text-[11px] cursor-pointer ${
                          lexiconPopup.activeQuery === lexiconPopup.chunkText
                            ? 'border-[#00F5D4] bg-[#00F5D4]/20 text-[#00F5D4] font-bold'
                            : 'border-[#6C7A89]/40 bg-[#180B29] text-[#6C7A89] hover:text-[#F2F5F8]'
                        }`}
                      >
                        PHRASE
                      </button>
                      {lexiconPopup.words.map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() =>
                            void handleTranslateChunkOrWord(
                              w,
                              lexiconPopup.chunkIdx,
                              lexiconPopup.chunkText
                            )
                          }
                          className={`px-1.5 py-0.5 border text-[11px] cursor-pointer ${
                            lexiconPopup.activeQuery === w
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
                      onClick={() => setLexiconPopup(null)}
                      className="text-[#6C7A89] hover:text-[#F2F5F8] cursor-pointer shrink-0 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Translation Result & Instant Resume */}
                  <div className="p-2 bg-[#180B29] border border-[#00F5D4]/30 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] text-[#6C7A89] truncate">
                        {lexiconPopup.activeQuery} ({translationLang.toUpperCase()}
                        {lexiconPopup.source
                          ? ` · ${lexiconPopup.source.toUpperCase()}`
                          : ''}
                        )
                      </div>
                      {lexiconPopup.loading ? (
                        <div className="text-[#00F5D4] text-xs flex items-center gap-1.5 mt-0.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                          <span>Translating...</span>
                        </div>
                      ) : lexiconPopup.error ? (
                        <div className="text-[#FF1E7A] text-xs mt-0.5">
                          {lexiconPopup.error}
                        </div>
                      ) : (
                        <div className="font-bold text-sm text-[#00F5D4] mt-0.5 break-words">
                          {lexiconPopup.translation}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        setLexiconPopup(null);
                        setIsPlaying(true);
                      }}
                      className="cyber-btn px-2.5 py-1.5 bg-[#00F5D4] text-[#0D0618] font-bold text-[11px] shrink-0"
                    >
                      RESUME
                    </button>
                  </div>
                </div>
              );
            })()}

          {/* Minimal Footer Hint & Skip to Quiz */}
          {selectedMode !== 'tachistoscope' && (
            <div className="flex items-center justify-between font-terminal text-xs text-[#6C7A89]">
              <span>
                [TAP CHUNK] TRANSLATE &nbsp;·&nbsp; [SPACE] PAUSE/PLAY
                &nbsp;·&nbsp; [←/→] STEP
              </span>
              <button
                type="button"
                onClick={startQuizPhase}
                className="cyber-btn px-3 py-1.5 bg-[#180B29] border border-[#FFE600]/60 text-[#FFE600] hover:bg-[#FFE600]/15 flex items-center gap-1"
              >
                <span>FINISH → QUIZ</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </main>
      )}

      {/* =========================================================
          SCREEN 3: COMPREHENSION QUIZ (1 Question at a time)
      ========================================================= */}
      {screen === 'quiz' && (
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 flex flex-col justify-center space-y-5">
          <OperatorMonitor
            state={operatorState}
            responseTimeSec={lastResponseSec}
          />

          {(() => {
            const quizList =
              activeQuizQuestions.length > 0
                ? activeQuizQuestions
                : selectedPassage.questions;
            const q = quizList[quizIndex] || selectedPassage.questions[0];
            return (
              <ChamferedPanel
                variant="yellow"
                cutSize={12}
                tag={q.code}
                title={`COMPREHENSION CHECK // QUESTION ${quizIndex + 1} OF ${
                  quizList.length
                }`}
              >
                <div className="p-6 space-y-5">
                  <h2 className="text-base sm:text-lg font-bold text-[#F2F5F8] leading-snug">
                    {q.question}
                  </h2>

                  <div className="space-y-2.5">
                    {q.options.map((opt, idx) => {
                      const isPicked = selectedOption === idx;
                      const isCorrectOption = idx === q.correctIndex;
                      let cardStyle =
                        'bg-[#0D0618] border-[#6C7A89]/40 text-[#F2F5F8] hover:border-[#FFE600]';

                      if (selectedOption !== null) {
                        if (isCorrectOption) {
                          cardStyle =
                            'bg-[#00F5D4]/15 border-[#00F5D4] text-[#00F5D4] font-semibold';
                        } else if (isPicked) {
                          cardStyle =
                            'bg-[#FF1E7A]/15 border-[#FF1E7A] text-[#FF1E7A]';
                        } else {
                          cardStyle =
                            'bg-[#0D0618] border-[#6C7A89]/20 text-[#6C7A89] opacity-50';
                        }
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={selectedOption !== null}
                          onClick={() => handleSelectQuizOption(idx)}
                          className={`cyber-btn w-full p-3.5 border text-left text-sm flex items-start gap-3 transition-all ${cardStyle}`}
                        >
                          <span className="font-terminal text-xs px-1.5 py-0.5 bg-[#180B29] border border-current shrink-0">
                            0{idx + 1}
                          </span>
                          <span className="flex-1">{opt}</span>
                          {selectedOption !== null && isCorrectOption && (
                            <CheckCircle2 className="w-4 h-4 text-[#00F5D4] shrink-0 mt-0.5" />
                          )}
                          {selectedOption !== null &&
                            isPicked &&
                            !isCorrectOption && (
                              <XCircle className="w-4 h-4 text-[#FF1E7A] shrink-0 mt-0.5" />
                            )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedOption !== null && (
                    <div className="pt-4 border-t border-[#FFE600]/20 space-y-4">
                      <p className="text-xs text-[#6C7A89] leading-relaxed">
                        <strong className="text-[#F2F5F8] font-terminal mr-1.5">
                          ANALYSIS:
                        </strong>
                        {q.explanation}
                      </p>

                      <button
                        type="button"
                        onClick={handleNextQuizStep}
                        className="cyber-btn w-full py-3 bg-[#FFE600] text-[#0D0618] font-bold text-sm flex items-center justify-center gap-2"
                      >
                        <span>
                          {quizIndex < selectedPassage.questions.length - 1
                            ? 'NEXT QUESTION [ENTER]'
                            : 'VIEW SESSION RESULT [ENTER]'}
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </ChamferedPanel>
            );
          })()}
        </main>
      )}

      {/* =========================================================
          SCREEN 4: SESSION RESULT & BENCHMARK REPORT
      ========================================================= */}
      {screen === 'result' && lastSessionMetrics && (
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 flex flex-col justify-center space-y-5">
          {(() => {
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
            const flowPercent = Math.round(
              lastSessionMetrics.forwardFlowRate * 100
            );
            const rec = profile.passageRecords?.[selectedPassage.id];
            const stageCompleted = rec?.stageCompleted || 0;
            const nextGuidedStage: 1 | 2 | 3 =
              stageCompleted === 0
                ? 1
                : stageCompleted === 1
                ? 2
                : 3;

            return (
              <>
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
                          isNewPersonalBest
                            ? 'text-[#FFE600]'
                            : 'text-[#00F5D4]'
                        }`}
                      />
                      <div>
                        <div
                          className={`text-sm sm:text-base font-extrabold tracking-wider ${
                            isNewPersonalBest
                              ? 'text-[#FFE600]'
                              : 'text-[#00F5D4]'
                          }`}
                        >
                          {isNewPersonalBest
                            ? '★ OVERALL PERSONAL BEST BROKEN!!'
                            : '★ NEW PASSAGE RECORD SET!'}
                        </div>
                        <div className="text-xs text-[#F2F5F8] mt-0.5">
                          {previousPassageBest > 0
                            ? `Passage record surged from ${previousPassageBest} → ${lastSessionMetrics.effectiveWpm} eWPM (+${
                                lastSessionMetrics.effectiveWpm -
                                previousPassageBest
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
                      const def = ACHIEVEMENT_CATALOG.find(
                        (a) => a.id === achId
                      );
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
                      HUMAN TOP {benchmark.topPercentile}%
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
                          <div className="font-terminal text-xs text-[#FFE600] mt-1.5">
                            TOP {benchmark.topPercentile}% OF HUMAN READERS
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
                            <div className="text-[10px] text-[#6C7A89]">
                              RAW WPM
                            </div>
                            <div className="text-sm font-bold text-[#F2F5F8] mt-0.5">
                              {rawSessionWpm}
                            </div>
                          </div>
                          <div className="p-2.5 bg-[#0D0618] border border-[#6C7A89]/30">
                            <div className="text-[10px] text-[#6C7A89]">
                              SYNC
                            </div>
                            <div className="text-sm font-bold text-[#00F5D4] mt-0.5">
                              {syncPercent}%
                            </div>
                          </div>
                          <div className="p-2.5 bg-[#0D0618] border border-[#6C7A89]/30">
                            <div className="text-[10px] text-[#6C7A89]">
                              FLOW
                            </div>
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
                      if (appMode === 'guided') {
                        if (nextGuidedStage === 1) {
                          setSelectedMode('chunk_pacer');
                          setFadeOutPassed(false);
                        } else if (nextGuidedStage === 2) {
                          setSelectedMode('chunk_pacer');
                          setFadeOutPassed(true);
                        } else {
                          setSelectedMode('overclock_432');
                          setFadeOutPassed(true);
                        }
                      }
                      startReadingSession();
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
                      setScreen('home');
                      setShowPassageModal(true);
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
              </>
            );
          })()}
        </main>
      )}

      {/* =========================================================
          MODAL 1: PASSAGE SELECTOR & LIVE FEED (Secondary Hierarchy)
      ========================================================= */}
      {showPassageModal && (
        <div className="fixed inset-0 z-50 bg-[#0D0618]/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-xl w-full">
            <ChamferedPanel
              variant="cyan"
              cutSize={12}
              tag="CORPUS"
              title="SELECT OR FETCH PASSAGE"
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowPassageModal(false)}
                  className="text-[#6C7A89] hover:text-[#F2F5F8] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              }
            >
              <div className="p-4 space-y-4">
                {/* Modal Tabs */}
                <div className="grid grid-cols-3 gap-2 font-terminal text-xs">
                  <button
                    type="button"
                    onClick={() => setPassageModalTab('presets')}
                    className={`cyber-btn py-2 border font-bold ${
                      passageModalTab === 'presets'
                        ? 'bg-[#00F5D4] text-[#0D0618] border-[#00F5D4]'
                        : 'bg-[#0D0618] text-[#6C7A89] border-[#6C7A89]/40'
                    }`}
                  >
                    LIBRARY ({allPassages.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPassageModalTab('live')}
                    className={`cyber-btn py-2 border font-bold flex items-center justify-center gap-1.5 ${
                      passageModalTab === 'live'
                        ? 'bg-[#00F5D4] text-[#0D0618] border-[#00F5D4]'
                        : 'bg-[#0D0618] text-[#6C7A89] border-[#6C7A89]/40'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>LIVE API</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPassageModalTab('custom')}
                    className={`cyber-btn py-2 border font-bold flex items-center justify-center gap-1.5 ${
                      passageModalTab === 'custom'
                        ? 'bg-[#00F5D4] text-[#0D0618] border-[#00F5D4]'
                        : 'bg-[#0D0618] text-[#6C7A89] border-[#6C7A89]/40'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>PASTE TEXT</span>
                  </button>
                </div>

                {/* Tab 1: Preset & Saved Library with Play History & Speed Badges */}
                {passageModalTab === 'presets' && (
                  <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-1">
                    {allPassages.map((passage, idx) => {
                      const isSelected = passage.id === selectedPassage.id;
                      const rec = profile.passageRecords?.[passage.id];
                      const hasPlayed = Boolean(rec && rec.attempts > 0);
                      const stage = rec?.stageCompleted || 0;
                      const bestEwpm = rec?.bestEffectiveWpm || 0;

                      return (
                        <button
                          key={passage.id}
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            selectPassageWithCoaching(passage.id);
                            setShowPassageModal(false);
                          }}
                          className={`cyber-btn w-full p-3.5 border text-left transition-all ${
                            isSelected
                              ? 'bg-[#00F5D4]/15 border-[#00F5D4] text-[#F2F5F8]'
                              : 'bg-[#0D0618] border-[#6C7A89]/40 text-[#6C7A89] hover:border-[#00F5D4]/60 hover:text-[#F2F5F8]'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 font-terminal text-xs">
                            <span className="text-[#00F5D4] font-bold">
                              {String(idx + 1).padStart(2, '0')} //{' '}
                              {passage.category}
                            </span>

                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                              {stage >= 3 ? (
                                <span className="px-1.5 py-0.5 bg-[#FF1E7A]/20 border border-[#FF1E7A] text-[#FF1E7A] font-bold">
                                  ★ MASTERED (3/3)
                                </span>
                              ) : hasPlayed ? (
                                <span className="px-1.5 py-0.5 bg-[#00F5D4]/15 border border-[#00F5D4]/60 text-[#00F5D4] font-bold">
                                  STAGE {stage}/3 · {rec?.attempts} RUN
                                  {(rec?.attempts || 0) > 1 ? 'S' : ''}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-[#180B29] border border-[#6C7A89]/40 text-[#6C7A89]">
                                  UNREAD (85% PACE)
                                </span>
                              )}

                              {bestEwpm > 0 && (
                                <span className="px-1.5 py-0.5 bg-[#FFE600]/15 border border-[#FFE600] text-[#FFE600] font-bold">
                                  BEST: {bestEwpm} eWPM
                                </span>
                              )}

                              <span className="text-[#6C7A89]">
                                {passage.wordCount}w
                              </span>
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-[#F2F5F8] mt-1">
                            {passage.title}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Tab 2: Live API Fetch (Wikipedia / Dev.to) */}
                {passageModalTab === 'live' && (
                  <div className="space-y-3 py-2">
                    <p className="text-xs text-[#6C7A89]">
                      Fetch a live English article and automatically segment it
                      into semantic chunks with 3 comprehension questions.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        disabled={isFetchingFeed}
                        onClick={() => handleFetchLivePassage('wikipedia')}
                        className="cyber-btn p-4 bg-[#0D0618] border border-[#00F5D4] text-left hover:bg-[#00F5D4]/15"
                      >
                        <div className="font-terminal text-xs font-bold text-[#00F5D4]">
                          WIKIPEDIA RANDOM
                        </div>
                        <div className="text-xs text-[#6C7A89] mt-1">
                          ~150–280 word general encyclopedia summary.
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled={isFetchingFeed}
                        onClick={() => handleFetchLivePassage('wikipedia_art')}
                        className="cyber-btn p-4 bg-[#0D0618] border border-[#FF1E7A] text-left hover:bg-[#FF1E7A]/15"
                      >
                        <div className="font-terminal text-xs font-bold text-[#FF1E7A]">
                          ART & AESTHETICS
                        </div>
                        <div className="text-xs text-[#6C7A89] mt-1">
                          Curated painting, architecture, music & film theory.
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled={isFetchingFeed}
                        onClick={() => handleFetchLivePassage('devto')}
                        className="cyber-btn p-4 bg-[#0D0618] border border-[#FFE600] text-left hover:bg-[#FFE600]/15"
                      >
                        <div className="font-terminal text-xs font-bold text-[#FFE600]">
                          DEV.TO TECH ARTICLE
                        </div>
                        <div className="text-xs text-[#6C7A89] mt-1">
                          ~250 word excerpt from software engineering posts.
                        </div>
                      </button>
                    </div>

                    {feedStatusMsg && (
                      <div className="p-3 bg-[#0D0618] border border-[#00F5D4]/40 font-terminal text-xs text-[#00F5D4] flex items-center gap-2">
                        {isFetchingFeed && (
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        )}
                        <span>{feedStatusMsg}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Paste Custom Text */}
                {passageModalTab === 'custom' && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="Passage Title (optional)"
                      className="w-full px-3 py-2 bg-[#0D0618] border border-[#6C7A89]/50 text-xs font-terminal text-[#F2F5F8] focus:border-[#00F5D4] focus:outline-none"
                    />
                    <textarea
                      rows={5}
                      value={customRawText}
                      onChange={(e) => setCustomRawText(e.target.value)}
                      placeholder="Paste any English article, paper abstract, or documentation here (min 25 words)..."
                      className="w-full p-3 bg-[#0D0618] border border-[#6C7A89]/50 text-xs text-[#F2F5F8] focus:border-[#00F5D4] focus:outline-none"
                    />
                    {feedStatusMsg && (
                      <div className="text-xs font-terminal text-[#FFE600]">
                        {feedStatusMsg}
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={isFetchingFeed}
                      onClick={handleCreateCustomPassage}
                      className="cyber-btn w-full py-2.5 bg-[#00F5D4] text-[#0D0618] font-bold text-xs"
                    >
                      {isFetchingFeed
                        ? 'PROCESSING...'
                        : 'GENERATE CHUNKS & SELECT PASSAGE'}
                    </button>
                  </div>
                )}
              </div>
            </ChamferedPanel>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 2: SESSION HISTORY & BACKUP (Secondary Hierarchy)
      ========================================================= */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-[#0D0618]/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-xl w-full">
            <ChamferedPanel
              variant="cyan"
              cutSize={12}
              tag="TELEMETRY"
              title="SESSION HISTORY & DATA BACKUP"
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  className="text-[#6C7A89] hover:text-[#F2F5F8] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              }
            >
              <div className="p-4 space-y-4 font-terminal text-xs">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-[#0D0618] border border-[#00F5D4]/30">
                    <div className="text-[10px] text-[#6C7A89]">BEST eWPM</div>
                    <div className="text-base font-bold text-[#00F5D4]">
                      {profile.bestEffectiveWpm}
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#0D0618] border border-[#00F5D4]/30">
                    <div className="text-[10px] text-[#6C7A89]">WORDS READ</div>
                    <div className="text-base font-bold text-[#F2F5F8]">
                      {profile.totalWordsRead}
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#0D0618] border border-[#00F5D4]/30">
                    <div className="text-[10px] text-[#6C7A89]">SESSIONS</div>
                    <div className="text-base font-bold text-[#FFE600]">
                      {sessionHistory.length}
                    </div>
                  </div>
                </div>

                <div className="max-h-[45vh] overflow-y-auto space-y-1.5">
                  {sessionHistory.length === 0 ? (
                    <div className="py-8 text-center text-[#6C7A89]">
                      No sessions recorded yet. Complete a reading session to
                      log telemetry.
                    </div>
                  ) : (
                    sessionHistory.map((s) => (
                      <div
                        key={s.id}
                        className="p-2.5 bg-[#0D0618] border border-[#6C7A89]/30 flex items-center justify-between"
                      >
                        <div>
                          <span className="text-[#00F5D4] font-bold">
                            {s.effectiveWpm} eWPM
                          </span>
                          <span className="text-[#6C7A89] ml-2">
                            ({s.rawWpm} WPM · SYNC {Math.round(s.syncRate * 100)}
                            %)
                          </span>
                        </div>
                        <div className="text-[10px] text-[#6C7A89]">
                          {s.mode.toUpperCase()} ·{' '}
                          {new Date(s.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 border-t border-[#6C7A89]/20 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="cyber-btn px-3 py-1.5 bg-[#0D0618] border border-[#00F5D4]/60 text-[#00F5D4] flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>EXPORT JSON</span>
                  </button>

                  <label className="cyber-btn px-3 py-1.5 bg-[#0D0618] border border-[#FFE600]/60 text-[#FFE600] flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>IMPORT JSON</span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const text = await file.text();
                        await importDatabaseJson(text);
                        await reloadFromDb();
                      }}
                    />
                  </label>
                </div>
              </div>
            </ChamferedPanel>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 3: SYSTEM SETTINGS & LOCAL LLM (Secondary Hierarchy)
      ========================================================= */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-[#0D0618]/85 backdrop-blur-xs overflow-y-auto flex items-center justify-center p-4">
          <div className="max-w-md w-full my-auto">
            <ChamferedPanel
              variant="magenta"
              cutSize={12}
              tag="CONFIG"
              title="SYSTEM PREFERENCES"
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="text-[#6C7A89] hover:text-[#F2F5F8] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              }
            >
              <div className="p-5 space-y-4 font-terminal text-xs max-h-[78vh] overflow-y-auto overscroll-contain">
                {/* Toggle: Chunk Move Click */}
                <div className="flex items-center justify-between py-2 border-b border-[#6C7A89]/20">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-[#00F5D4]" />
                    <span>CHUNK PULSE SOUND (800Hz)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !chunkTickOn;
                      setChunkTickOn(next);
                      soundEngine.setChunkTickEnabled(next);
                      if (next) soundEngine.playChunkTick(false);
                    }}
                    className={`cyber-btn px-3 py-1 border font-bold ${
                      chunkTickOn
                        ? 'border-[#00F5D4] bg-[#00F5D4]/15 text-[#00F5D4]'
                        : 'border-[#6C7A89] text-[#6C7A89]'
                    }`}
                  >
                    {chunkTickOn ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Toggle: Fade-out Passed Chunks */}
                <div className="flex items-center justify-between py-2 border-b border-[#6C7A89]/20">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#00F5D4]" />
                    <span>FADE PASSED CHUNKS (ANTI-REGRESSION)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setFadeOutPassed((v) => !v);
                    }}
                    className={`cyber-btn px-3 py-1 border font-bold ${
                      fadeOutPassed
                        ? 'border-[#00F5D4] bg-[#00F5D4]/15 text-[#00F5D4]'
                        : 'border-[#6C7A89] text-[#6C7A89]'
                    }`}
                  >
                    {fadeOutPassed ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Toggle: CRT Scanlines */}
                <div className="flex items-center justify-between py-2 border-b border-[#6C7A89]/20">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#00F5D4]" />
                    <span>CRT SCANLINE OVERLAY</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setScanlineEnabled((v) => !v);
                    }}
                    className={`cyber-btn px-3 py-1 border font-bold ${
                      scanlineEnabled
                        ? 'border-[#00F5D4] bg-[#00F5D4]/15 text-[#00F5D4]'
                        : 'border-[#6C7A89] text-[#6C7A89]'
                    }`}
                  >
                    {scanlineEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Translation Target Language (Tap Chunk/Word to Translate) */}
                <div className="py-2 border-b border-[#6C7A89]/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Languages className="w-4 h-4 text-[#00F5D4]" />
                      <span>TAP-TO-TRANSLATE LANGUAGE</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {TRANSLATION_LANGUAGES.map((lang) => {
                      const active = translationLang === lang.code;
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            setTranslationLang(lang.code);
                            saveTranslationLangSelection(lang.code);
                          }}
                          className={`cyber-btn py-1.5 px-2 border text-[10px] font-bold ${
                            active
                              ? 'border-[#00F5D4] bg-[#00F5D4]/20 text-[#00F5D4]'
                              : 'border-[#6C7A89]/40 bg-[#0D0618] text-[#6C7A89] hover:text-[#F2F5F8]'
                          }`}
                        >
                          {lang.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* On-Device LLM Pipeline (WebGPU WebLLM / Ollama / Rule-based) */}
                <div className="py-2 border-b border-[#6C7A89]/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-[#FFE600]" />
                      <span>ON-DEVICE LLM ENGINE</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'webllm', label: 'WEBGPU (GEMMA)' },
                        { id: 'ollama', label: 'OLLAMA API' },
                        { id: 'rule_based', label: 'RULE-BASED' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          soundEngine.playUiClick();
                          setLlmProvider(opt.id);
                        }}
                        className={`cyber-btn py-1.5 px-2 border text-[10px] font-bold ${
                          llmProvider === opt.id
                            ? 'border-[#FFE600] bg-[#FFE600] text-[#0D0618]'
                            : 'border-[#6C7A89]/50 bg-[#0D0618] text-[#6C7A89]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {llmProvider === 'webllm' && (
                    <div className="p-2.5 bg-[#0D0618] border border-[#FFE600]/40 space-y-2.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#6C7A89]">SELECT GEMMA TIER</span>
                        <span className="text-[#00F5D4] font-bold">
                          {isWebGpuSupported() ? 'WEBGPU OK' : 'NO WEBGPU'}
                        </span>
                      </div>

                      {/* 3-Model Selector (Gemma 2 2B / Gemma 4 E2B / Gemma 3 1B) */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {WEBLLM_MODEL_OPTIONS.map((m) => {
                          const active = selectedWebLlmModel === m.id;
                          const isCached = cachedModels[m.id];
                          return (
                            <button
                              key={m.id}
                              type="button"
                              disabled={isPreloadingWebLlm}
                              onClick={() => {
                                soundEngine.playUiClick();
                                setSelectedWebLlmModel(m.id);
                                saveWebLlmModelSelection(m.id);
                                setWebLlmStatus(
                                  isWebLlmReady(m.id)
                                    ? 'READY IN VRAM'
                                    : isCached
                                    ? 'CACHED ON DISK (READY TO LOAD)'
                                    : 'NOT DOWNLOADED'
                                );
                              }}
                              className={`cyber-btn p-1.5 border text-left transition-all ${
                                active
                                  ? 'border-[#00F5D4] bg-[#00F5D4]/15 text-[#F2F5F8]'
                                  : 'border-[#6C7A89]/40 bg-[#0D0618] text-[#6C7A89] hover:border-[#00F5D4]/50'
                              }`}
                            >
                              <div className="text-[10px] font-bold text-[#00F5D4] flex items-center justify-between">
                                <span>{m.label}</span>
                              </div>
                              <div className="text-[9px] text-[#FFE600]">
                                {isCached ? '✓ CACHED' : `~${m.vram}`}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="text-[10px] text-[#FFE600] truncate">
                        STATUS: {webLlmStatus}
                      </div>
                      <button
                        type="button"
                        disabled={isPreloadingWebLlm}
                        onClick={async () => {
                          setIsPreloadingWebLlm(true);
                          try {
                            await initWebLlmEngine(
                              selectedWebLlmModel,
                              (text, prog) => {
                                setWebLlmStatus(
                                  `${Math.round(prog * 100)}% // ${text}`
                                );
                              }
                            );
                            setWebLlmStatus('READY IN VRAM');
                            const updatedCache = await checkCachedWebLlmModels();
                            setCachedModels(updatedCache);
                            soundEngine.playQuizCorrect(false);
                          } catch (e) {
                            setWebLlmStatus(
                              e instanceof Error ? e.message : 'Load error'
                            );
                          } finally {
                            setIsPreloadingWebLlm(false);
                          }
                        }}
                        className="cyber-btn w-full py-1.5 bg-[#FFE600]/15 border border-[#FFE600] text-[#FFE600] font-bold text-[10px] hover:bg-[#FFE600]/25"
                      >
                        {isPreloadingWebLlm
                          ? 'LOADING INTO VRAM...'
                          : isWebLlmReady(selectedWebLlmModel)
                          ? 'MODEL LOADED IN VRAM (READY)'
                          : cachedModels[selectedWebLlmModel]
                          ? `LOAD CACHED ${
                              WEBLLM_MODEL_OPTIONS.find(
                                (m) => m.id === selectedWebLlmModel
                              )?.label
                            } INTO VRAM`
                          : `DOWNLOAD & LOAD ${
                              WEBLLM_MODEL_OPTIONS.find(
                                (m) => m.id === selectedWebLlmModel
                              )?.label
                            }`}
                      </button>
                    </div>
                  )}

                  {llmProvider === 'ollama' && (
                    <div className="space-y-2 pt-1">
                      <input
                        type="text"
                        value={profile.llmEndpoint}
                        onChange={(e) =>
                          setProfile({ ...profile, llmEndpoint: e.target.value })
                        }
                        placeholder="http://localhost:11434"
                        className="w-full px-2.5 py-1.5 bg-[#0D0618] border border-[#6C7A89]/40 text-[#F2F5F8]"
                      />
                      <input
                        type="text"
                        value={profile.llmModel}
                        onChange={(e) =>
                          setProfile({ ...profile, llmModel: e.target.value })
                        }
                        placeholder="gemma2:2b"
                        className="w-full px-2.5 py-1.5 bg-[#0D0618] border border-[#6C7A89]/40 text-[#F2F5F8]"
                      />
                    </div>
                  )}
                </div>

                {/* Optional Accordion: FM Synth Test */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSynthTestInSettings((v) => !v)}
                    className="text-[#6C7A89] hover:text-[#00F5D4] underline cursor-pointer"
                  >
                    {showSynthTestInSettings
                      ? '▼ HIDE FM SYNTH DIAGNOSTICS'
                      : '▶ OPEN FM SYNTH DIAGNOSTICS'}
                  </button>

                  {showSynthTestInSettings && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => soundEngine.playChunkTick(false)}
                        className="cyber-btn p-2 bg-[#0D0618] border border-[#00F5D4]/50 text-[#00F5D4]"
                      >
                        CHUNK TICK
                      </button>
                      <button
                        type="button"
                        onClick={() => soundEngine.playQuizCorrect(true)}
                        className="cyber-btn p-2 bg-[#0D0618] border border-[#FFE600]/60 text-[#FFE600]"
                      >
                        QUIZ CORRECT
                      </button>
                      <button
                        type="button"
                        onClick={() => soundEngine.playRankConfirm()}
                        className="cyber-btn p-2 bg-[#0D0618] border border-[#FF1E7A]/60 text-[#FF1E7A]"
                      >
                        RANK DROP
                      </button>
                      <button
                        type="button"
                        onClick={() => soundEngine.playOvertakeSpark()}
                        className="cyber-btn p-2 bg-[#0D0618] border border-[#00F5D4]/50 text-[#00F5D4]"
                      >
                        OVERTAKE SPARK
                      </button>
                    </div>
                  )}
                </div>

                {/* Optional Accordion: LLM Engine Diagnostics */}
                <div className="pt-1 border-t border-[#6C7A89]/20">
                  <button
                    type="button"
                    onClick={() => setShowLlmTestInSettings((v) => !v)}
                    className="text-[#6C7A89] hover:text-[#FFE600] underline cursor-pointer"
                  >
                    {showLlmTestInSettings
                      ? '▼ HIDE LLM ENGINE DIAGNOSTICS'
                      : '▶ OPEN LLM ENGINE DIAGNOSTICS'}
                  </button>

                  {showLlmTestInSettings && (
                    <div className="mt-3 p-3 bg-[#0D0618] border border-[#FFE600]/40 space-y-2.5">
                      <button
                        type="button"
                        disabled={isRunningLlmDiag}
                        onClick={async () => {
                          setIsRunningLlmDiag(true);
                          setLlmDiagResult(null);
                          setLlmDiagStatus('Initializing diagnostic pipeline...');
                          const t0 = performance.now();
                          try {
                            const sampleText =
                              'Skilled readers extract vital structural cues from the parafovea. Consequently, grouping words into semantic chunks bypasses slow vocal articulation. Furthermore, rhythmically pacing visual fixation stabilizes working memory integration.';
                            const { passage, usedProvider, fallbackReason } =
                              await processPassageWithOptionalLlm({
                                title: 'LLM Diagnostic Probe',
                                rawText: sampleText,
                                category: 'DIAGNOSTIC',
                                sourceType: 'custom',
                                provider: llmProvider,
                                webLlmModel: selectedWebLlmModel,
                                llmEndpoint: profile.llmEndpoint,
                                llmModel: profile.llmModel,
                                onProgress: (msg) => setLlmDiagStatus(msg),
                              });
                            const elapsedMs = Math.round(
                              performance.now() - t0
                            );
                            if (isWebLlmReady(selectedWebLlmModel)) {
                              setWebLlmStatus('READY IN VRAM');
                            }
                            const q0 = passage.questions[0];
                            setLlmDiagResult({
                              usedProvider,
                              elapsedMs,
                              chunks: passage.chunks,
                              sampleQuestion: q0?.question || 'N/A',
                              sampleOptions: q0?.options,
                              sampleAnswer:
                                q0?.options[q0.correctIndex] || 'N/A',
                              fallbackReason,
                            });
                            setLlmDiagStatus('');
                            soundEngine.playQuizCorrect(false);
                          } catch (e) {
                            setLlmDiagStatus(
                              e instanceof Error ? e.message : 'Diagnostic error'
                            );
                          } finally {
                            setIsRunningLlmDiag(false);
                          }
                        }}
                        className="cyber-btn w-full py-2 bg-[#FFE600] text-[#0D0618] font-bold text-[11px] flex items-center justify-center gap-1.5"
                      >
                        {isRunningLlmDiag && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        )}
                        <span>
                          {isRunningLlmDiag
                            ? 'RUNNING INFERENCE TEST...'
                            : `RUN DIAGNOSTIC TEST (${llmProvider.toUpperCase()})`}
                        </span>
                      </button>

                      {llmDiagStatus && (
                        <div className="text-[10px] text-[#00F5D4] break-words">
                          {llmDiagStatus}
                        </div>
                      )}

                      {llmDiagResult && (
                        <div className="space-y-2 pt-1 border-t border-[#6C7A89]/30 text-[10px]">
                          <div className="flex items-center justify-between">
                            <span className="text-[#00F5D4] font-bold">
                              BACKEND: {llmDiagResult.usedProvider.toUpperCase()}
                            </span>
                            <span className="text-[#FFE600]">
                              LATENCY: {llmDiagResult.elapsedMs} ms
                            </span>
                          </div>

                          {llmDiagResult.fallbackReason && (
                            <div className="p-1.5 bg-[#FF1E7A]/15 border border-[#FF1E7A] text-[#FF1E7A] break-words">
                              FALLBACK REASON: {llmDiagResult.fallbackReason}
                            </div>
                          )}

                          <div>
                            <div className="text-[#6C7A89] mb-1">
                              CHUNKS ({llmDiagResult.chunks.length}):
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {llmDiagResult.chunks.map((c, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 bg-[#180B29] border border-[#00F5D4]/40 text-[#F2F5F8]"
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="text-[#6C7A89]">
                              SAMPLE CLOZE QUIZ Q1 (LLM DISTRACTORS):
                            </div>
                            <div className="text-[#F2F5F8] mt-0.5">
                              {llmDiagResult.sampleQuestion}
                            </div>
                            {llmDiagResult.sampleOptions && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {llmDiagResult.sampleOptions.map((opt, idx) => (
                                  <span
                                    key={idx}
                                    className={`px-1.5 py-0.5 border ${
                                      opt === llmDiagResult.sampleAnswer
                                        ? 'border-[#00F5D4] bg-[#00F5D4]/15 text-[#00F5D4] font-bold'
                                        : 'border-[#6C7A89]/40 bg-[#180B29] text-[#6C7A89]'
                                    }`}
                                  >
                                    {opt}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="text-[#00F5D4] mt-1">
                              ANS: {llmDiagResult.sampleAnswer}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </ChamferedPanel>
          </div>
        </div>
      )}

      {/* =========================================================
          MODAL 4: NEURAL ACHIEVEMENTS & BADGES (Secondary Hierarchy)
      ========================================================= */}
      {showAchievementsModal && (
        <div className="fixed inset-0 z-50 bg-[#0D0618]/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-xl w-full">
            <ChamferedPanel
              variant="yellow"
              cutSize={12}
              tag="MILESTONES"
              title={`NEURAL ACHIEVEMENTS (${
                profile.unlockedAchievements?.length || 0
              }/${ACHIEVEMENT_CATALOG.length})`}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowAchievementsModal(false)}
                  className="text-[#6C7A89] hover:text-[#F2F5F8] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              }
            >
              <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto font-terminal text-xs">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-[#0D0618] border border-[#00F5D4]/30">
                    <div className="text-[10px] text-[#6C7A89]">BASELINE</div>
                    <div className="text-sm font-bold text-[#00F5D4]">
                      {profile.baselineWpm
                        ? `${profile.baselineWpm} WPM`
                        : 'UNSET'}
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#0D0618] border border-[#FFE600]/30">
                    <div className="text-[10px] text-[#6C7A89]">
                      OVERALL BEST
                    </div>
                    <div className="text-sm font-bold text-[#FFE600]">
                      {profile.bestEffectiveWpm} eWPM
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#0D0618] border border-[#FF1E7A]/30">
                    <div className="text-[10px] text-[#6C7A89]">
                      PASSAGES MASTERED
                    </div>
                    <div className="text-sm font-bold text-[#FF1E7A]">
                      {
                        Object.values(profile.passageRecords || {}).filter(
                          (r) => r.stageCompleted >= 3
                        ).length
                      }
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {ACHIEVEMENT_CATALOG.map((ach) => {
                    const isUnlocked = Boolean(
                      profile.unlockedAchievements?.includes(ach.id)
                    );
                    return (
                      <div
                        key={ach.id}
                        className={`p-3 border flex items-start justify-between gap-3 ${
                          isUnlocked
                            ? 'bg-[#FFE600]/10 border-[#FFE600] text-[#F2F5F8]'
                            : 'bg-[#0D0618] border-[#6C7A89]/30 text-[#6C7A89] opacity-65'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 text-[10px] border font-bold ${
                                isUnlocked
                                  ? 'border-[#FFE600] bg-[#FFE600] text-[#0D0618]'
                                  : 'border-[#6C7A89]/40 bg-[#180B29] text-[#6C7A89]'
                              }`}
                            >
                              {ach.badgeCode}
                            </span>
                            <span
                              className={`font-bold ${
                                isUnlocked ? 'text-[#FFE600]' : 'text-[#6C7A89]'
                              }`}
                            >
                              {ach.title}
                            </span>
                            <span className="text-[10px] text-[#00F5D4]">
                              // {ach.subtitle}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            {ach.description}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {isUnlocked ? (
                            <span className="px-2 py-0.5 bg-[#00F5D4]/20 border border-[#00F5D4] text-[#00F5D4] text-[10px] font-bold">
                              UNLOCKED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-[#180B29] border border-[#6C7A89]/40 text-[#6C7A89] text-[10px]">
                              LOCKED
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ChamferedPanel>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
