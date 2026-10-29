import { useState, useEffect } from 'react';
import {
  Cpu,
  Eye,
  Languages,
  Loader2,
  Sliders,
  Volume2,
  X,
} from 'lucide-react';
import {
  checkCachedWebLlmModels,
  checkChromePromptApiAvailability,
  getLoadedWebLlmModelId,
  initWebLlmEngine,
  isWebGpuSupported,
  isWebLlmReady,
  LlmProviderType,
  prefetchWebLlmModelToCache,
  processPassageWithOptionalLlm,
  promptChromeBuiltInAi,
  purgeWebLlmDiskCache,
  saveCloudTranslationEnabled,
  saveLlmProviderSelection,
  saveTranslationLangSelection,
  saveWebLlmModelSelection,
  TRANSLATION_LANGUAGES,
  translateWithChromeBuiltInTranslator,
  TranslationLangCode,
  unloadWebLlmEngine,
  WEBLLM_MODEL_OPTIONS,
  WebLlmModelId,
} from '../../lib/llmClient';
import { soundEngine } from '../../lib/soundEngine';
import { UserProfile } from '../../types/schema';
import { ChamferedPanel } from '../layout/ChamferedPanel';

interface SystemSettingsModalProps {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  chunkTickOn: boolean;
  setChunkTickOn: (val: boolean) => void;
  fadeOutPassed: boolean;
  setFadeOutPassed: (updater: (prev: boolean) => boolean) => void;
  scanlineEnabled: boolean;
  setScanlineEnabled: (updater: (prev: boolean) => boolean) => void;
  translationLang: TranslationLangCode;
  setTranslationLang: (lang: TranslationLangCode) => void;
  allowCloudTranslation: boolean;
  setAllowCloudTranslation: (updater: (prev: boolean) => boolean) => void;
  llmProvider: LlmProviderType;
  setLlmProvider: (provider: LlmProviderType) => void;
  selectedWebLlmModel: WebLlmModelId;
  setSelectedWebLlmModel: (model: WebLlmModelId) => void;
  cachedModels: Record<WebLlmModelId, boolean>;
  setCachedModels: (models: Record<WebLlmModelId, boolean>) => void;
  webLlmStatus: string;
  setWebLlmStatus: (status: string) => void;
  isPreloadingWebLlm: boolean;
  setIsPreloadingWebLlm: (val: boolean) => void;
  webLlmProgressPct: number | null;
  setWebLlmProgressPct: (pct: number | null) => void;
  onClose: () => void;
}

export function SystemSettingsModal({
  profile,
  setProfile,
  chunkTickOn,
  setChunkTickOn,
  fadeOutPassed,
  setFadeOutPassed,
  scanlineEnabled,
  setScanlineEnabled,
  translationLang,
  setTranslationLang,
  allowCloudTranslation,
  setAllowCloudTranslation,
  llmProvider,
  setLlmProvider,
  selectedWebLlmModel,
  setSelectedWebLlmModel,
  cachedModels,
  setCachedModels,
  webLlmStatus,
  setWebLlmStatus,
  isPreloadingWebLlm,
  setIsPreloadingWebLlm,
  webLlmProgressPct,
  setWebLlmProgressPct,
  onClose,
}: SystemSettingsModalProps) {
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
  const [chromeAiStatus, setChromeAiStatus] = useState<string>(
    'CHECKING CHROME BUILT-IN AI...'
  );
  const [isTestingChromeAi, setIsTestingChromeAi] = useState<boolean>(false);

  useEffect(() => {
    checkCachedWebLlmModels().then(setCachedModels);
  }, [setCachedModels]);

  useEffect(() => {
    if (llmProvider === 'chrome_ai') {
      checkChromePromptApiAvailability().then((info) => {
        setChromeAiStatus(info.detail);
      });
    }
  }, [llmProvider]);

  return (
    <div className="fixed inset-0 z-[95] bg-[#0D0618]/85 backdrop-blur-xs overflow-y-auto flex items-center justify-center p-4">
      <div className="max-w-md w-full my-auto">
        <ChamferedPanel
          variant="magenta"
          cutSize={12}
          tag="CONFIG"
          title="SYSTEM PREFERENCES"
          rightSlot={
            <button
              type="button"
              onClick={onClose}
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

              {/* Opt-in External Translation API Toggle (Default OFF) */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] text-[#F2F5F8] font-bold">
                    EXTERNAL TRANSLATION API (CLOUD FALLBACK)
                  </div>
                  <div className="text-[10px] text-[#6C7A89]">
                    Query MyMemory external translation API when local AI
                    (Hachiue / Chrome Built-in AI) is unavailable. Default: OFF.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playUiClick();
                    setAllowCloudTranslation((prev) => {
                      const next = !prev;
                      saveCloudTranslationEnabled(next);
                      return next;
                    });
                  }}
                  className={`cyber-btn px-3 py-1 border font-bold shrink-0 ${
                    allowCloudTranslation
                      ? 'border-[#00F5D4] bg-[#00F5D4]/15 text-[#00F5D4]'
                      : 'border-[#6C7A89] text-[#6C7A89]'
                  }`}
                >
                  {allowCloudTranslation ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* On-Device LLM Pipeline (WebGPU WebLLM / Chrome AI / Ollama / Rule-based) */}
            <div className="py-2 border-b border-[#6C7A89]/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#FFE600]" />
                  <span>ON-DEVICE LLM ENGINE</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(
                  [
                    { id: 'webllm', label: 'HACHIUE (BONSAI 1/2)' },
                    { id: 'chrome_ai', label: 'CHROME AI (NANO)' },
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
                      saveLlmProviderSelection(opt.id);
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

              {llmProvider === 'chrome_ai' && (
                <div className="p-2.5 bg-[#0D0618] border border-[#00F5D4]/40 space-y-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#00F5D4] font-bold">
                      CHROME BUILT-IN AI (GEMINI NANO + TRANSLATOR)
                    </span>
                  </div>
                  <div className="text-[10px] text-[#FFE600] break-words">
                    STATUS: {chromeAiStatus}
                  </div>
                  <div className="text-[10px] text-[#6C7A89] leading-relaxed">
                    Uses Chrome&apos;s built-in <code>LanguageModel</code>{' '}
                    (Gemini Nano) for Cloze quiz synthesis and{' '}
                    <code>Translator</code> API for zero-download on-device
                    translation.
                  </div>
                  <button
                    type="button"
                    disabled={isTestingChromeAi}
                    onClick={async () => {
                      soundEngine.playUiClick();
                      setIsTestingChromeAi(true);
                      setChromeAiStatus('PROBING CHROME BUILT-IN AI...');
                      try {
                        const transOut =
                          await translateWithChromeBuiltInTranslator(
                            'rapid visual intake',
                            translationLang
                          );
                        const promptAvail =
                          await checkChromePromptApiAvailability();
                        if (promptAvail.supported) {
                          const nanoOut = await promptChromeBuiltInAi(
                            'Reply with the single word: READY'
                          );
                          setChromeAiStatus(
                            `GEMINI NANO OK ("${nanoOut
                              .trim()
                              .slice(0, 20)}")${
                              transOut ? ` + TRANSLATOR OK ("${transOut}")` : ''
                            }`
                          );
                          soundEngine.playQuizCorrect(false);
                        } else if (transOut) {
                          setChromeAiStatus(
                            `CHROME TRANSLATOR OK ("${transOut}") // Gemini Nano: ${promptAvail.detail}`
                          );
                          soundEngine.playQuizCorrect(false);
                        } else {
                          setChromeAiStatus(promptAvail.detail);
                        }
                      } catch (e) {
                        setChromeAiStatus(
                          e instanceof Error
                            ? e.message
                            : 'Chrome AI probe failed'
                        );
                      } finally {
                        setIsTestingChromeAi(false);
                      }
                    }}
                    className="cyber-btn w-full py-1.5 bg-[#00F5D4]/15 border border-[#00F5D4] text-[#00F5D4] font-bold text-[10px] hover:bg-[#00F5D4]/25"
                  >
                    {isTestingChromeAi
                      ? 'TESTING CHROME BUILT-IN AI...'
                      : 'CHECK / WARM UP CHROME BUILT-IN AI'}
                  </button>
                </div>
              )}

              {llmProvider === 'webllm' && (
                <div className="p-2.5 bg-[#0D0618] border border-[#FFE600]/40 space-y-2.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#6C7A89]">
                      🪴 HACHIUE // WEBGPU BONSAI 1 &amp; 2 GGUF
                    </span>
                    <span className="text-[#00F5D4] font-bold">
                      {isWebGpuSupported() ? 'WEBGPU OK' : 'NO WEBGPU'}
                    </span>
                  </div>

                  {/* WebGPU Model Selector (3-Tier Bonsai Lineup) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    {WEBLLM_MODEL_OPTIONS.map((m) => {
                      const active = selectedWebLlmModel === m.id;
                      const isCached = cachedModels[m.id];
                      const inVram = isWebLlmReady(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={isPreloadingWebLlm}
                          onClick={() => {
                            soundEngine.playUiClick();
                            setSelectedWebLlmModel(m.id);
                            saveWebLlmModelSelection(m.id);
                            const currentGpuModel = getLoadedWebLlmModelId();
                            const gpuSuffix =
                              currentGpuModel && currentGpuModel !== m.id
                                ? ` // ACTIVE GPU: ${currentGpuModel}`
                                : '';
                            setWebLlmStatus(
                              isWebLlmReady(m.id)
                                ? 'READY IN VRAM'
                                : isCached
                                ? `CACHED ON DISK${gpuSuffix}`
                                : `NOT DOWNLOADED${gpuSuffix}`
                            );
                          }}
                          className={`cyber-btn p-2 border text-left transition-all ${
                            active
                              ? 'border-[#00F5D4] bg-[#00F5D4]/15 text-[#F2F5F8]'
                              : 'border-[#6C7A89]/40 bg-[#0D0618] text-[#6C7A89] hover:border-[#00F5D4]/50'
                          }`}
                        >
                          <div className="text-[10px] font-bold text-[#00F5D4] flex items-center justify-between gap-1">
                            <span>{m.label}</span>
                            <span className="text-[9px] text-[#FFE600] shrink-0">
                              {inVram
                                ? '⚡ GPU READY'
                                : isCached
                                ? '✓ CACHED'
                                : `~${m.vram}`}
                            </span>
                          </div>
                          <div className="text-[9px] text-[#6C7A89] truncate mt-0.5">
                            {m.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="text-[#FFE600] truncate">
                      STATUS: {webLlmStatus}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {isWebLlmReady() && (
                        <button
                          type="button"
                          disabled={isPreloadingWebLlm}
                          onClick={async () => {
                            soundEngine.playUiClick();
                            setWebLlmStatus('RELEASING VRAM...');
                            await unloadWebLlmEngine();
                            setWebLlmStatus('VRAM UNLOADED (0 MB RAM)');
                          }}
                          className="text-[9px] text-[#FFE600] hover:text-[#00F5D4] underline cursor-pointer"
                        >
                          UNLOAD VRAM
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isPreloadingWebLlm}
                        onClick={async () => {
                          soundEngine.playUiClick();
                          await purgeWebLlmDiskCache();
                          const updatedCache = await checkCachedWebLlmModels();
                          setCachedModels(updatedCache);
                          setWebLlmStatus('DISK CACHE PURGED & VRAM UNLOADED');
                        }}
                        className="text-[9px] text-[#6C7A89] hover:text-[#FF1E7A] underline cursor-pointer"
                      >
                        PURGE DISK CACHE
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1.5">
                    <button
                      type="button"
                      disabled={isPreloadingWebLlm}
                      onClick={() => {
                        setIsPreloadingWebLlm(true);
                        setWebLlmProgressPct(0);
                        void initWebLlmEngine(selectedWebLlmModel)
                          .then(async () => {
                            setWebLlmStatus('READY IN VRAM');
                            const updatedCache = await checkCachedWebLlmModels();
                            setCachedModels(updatedCache);
                            soundEngine.playQuizCorrect(false);
                          })
                          .catch((e) => {
                            setWebLlmStatus(
                              e instanceof Error ? e.message : 'Load error'
                            );
                          })
                          .finally(() => {
                            setIsPreloadingWebLlm(false);
                            setWebLlmProgressPct(null);
                          });
                      }}
                      className="cyber-btn flex-1 py-1.5 px-2 bg-[#FFE600]/15 border border-[#FFE600] text-[#FFE600] font-bold text-[10px] hover:bg-[#FFE600]/25"
                    >
                      {isPreloadingWebLlm
                        ? `DOWNLOADING IN BACKGROUND (${
                            webLlmProgressPct ?? 0
                          }%) — SAFE TO CLOSE CONFIG`
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
                    {!cachedModels[selectedWebLlmModel] && !isPreloadingWebLlm && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsPreloadingWebLlm(true);
                          setWebLlmProgressPct(0);
                          void prefetchWebLlmModelToCache(selectedWebLlmModel)
                            .then(async () => {
                              const updatedCache = await checkCachedWebLlmModels();
                              setCachedModels(updatedCache);
                              const activeGpu = getLoadedWebLlmModelId();
                              setWebLlmStatus(
                                activeGpu
                                  ? `CACHED ON DISK // ACTIVE GPU: ${activeGpu}`
                                  : 'CACHED ON DISK (0 MB GPU VRAM)'
                              );
                              soundEngine.playQuizCorrect(false);
                            })
                            .catch((e) => {
                              setWebLlmStatus(
                                e instanceof Error ? e.message : 'Prefetch error'
                              );
                            })
                            .finally(() => {
                              setIsPreloadingWebLlm(false);
                              setWebLlmProgressPct(null);
                            });
                        }}
                        className="cyber-btn py-1.5 px-2.5 bg-[#00F5D4]/10 border border-[#00F5D4]/70 text-[#00F5D4] font-bold text-[10px] hover:bg-[#00F5D4]/20 shrink-0"
                        title="Download GGUF weights to OPFS/IndexedDB cache without touching WebGPU VRAM"
                      >
                        CACHE ONLY (NO GPU)
                      </button>
                    )}
                  </div>
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
                        const elapsedMs = Math.round(performance.now() - t0);
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
                          sampleAnswer: q0?.options[q0.correctIndex] || 'N/A',
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
                        : `RUN DIAGNOSTIC TEST (${
                            llmProvider === 'webllm'
                              ? 'HACHIUE'
                              : llmProvider.toUpperCase()
                          })`}
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
                          BACKEND:{' '}
                          {llmDiagResult.usedProvider === 'webllm'
                            ? 'HACHIUE'
                            : llmDiagResult.usedProvider.toUpperCase()}
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
  );
}
