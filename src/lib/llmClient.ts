import {
  HachiueEngine,
  clearModelCache,
  isModelCached,
  prefetchModel,
  type ParsedGgufHeader,
} from 'hachiue';
import { TrainingPassage, QuizQuestion } from '../types/schema';
import { buildNormalizedPassage } from './chunker';

export type LlmProviderType = 'webllm' | 'chrome_ai' | 'ollama' | 'rule_based';

const LLM_PROVIDER_STORAGE_KEY = 'wetware_llm_provider';
const MODEL_STORAGE_KEY = 'wetware_selected_webllm_model';
const VERIFIED_MODEL_STORAGE_KEY = 'wetware_verified_webllm_model';
const LOADING_GUARD_STORAGE_KEY = 'wetware_webllm_loading_in_progress';
const STABILITY_VERIFICATION_MS = 10_000;

let stabilityTimerId: ReturnType<typeof setTimeout> | null = null;

function cancelStabilityVerificationTimer(): void {
  if (stabilityTimerId !== null) {
    clearTimeout(stabilityTimerId);
    stabilityTimerId = null;
  }
}

export function clearVerifiedWebLlmModel(): void {
  cancelStabilityVerificationTimer();
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(VERIFIED_MODEL_STORAGE_KEY);
    window.localStorage.removeItem(LOADING_GUARD_STORAGE_KEY);
  }
}

export function getVerifiedWebLlmModel(): WebLlmModelId | null {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(VERIFIED_MODEL_STORAGE_KEY);
    if (
      saved &&
      WEBLLM_MODEL_OPTIONS.some(
        (m) => m.id.toLowerCase() === saved.toLowerCase()
      )
    ) {
      return saved as WebLlmModelId;
    }
  }
  return null;
}

/**
 * Checks whether a previous page session crashed or was terminated while loading/stabilizing
 * a WebGPU model. If so, clears both the guard and the verified auto-load flag to prevent
 * a crash loop on reload.
 */
export function consumeInterruptedLoadGuard(): boolean {
  if (typeof window === 'undefined') return false;
  const inProgress = window.localStorage.getItem(LOADING_GUARD_STORAGE_KEY);
  if (inProgress) {
    clearVerifiedWebLlmModel();
    return true;
  }
  return false;
}

function scheduleModelStabilityVerification(modelId: WebLlmModelId): void {
  cancelStabilityVerificationTimer();
  stabilityTimerId = setTimeout(() => {
    stabilityTimerId = null;
    if (
      typeof window !== 'undefined' &&
      globalState.engine &&
      globalState.loadedModelId === modelId &&
      (getSavedLlmProvider() ?? 'webllm') === 'webllm' &&
      getSavedWebLlmModel() === modelId
    ) {
      window.localStorage.removeItem(LOADING_GUARD_STORAGE_KEY);
      window.localStorage.setItem(VERIFIED_MODEL_STORAGE_KEY, modelId);
    }
  }, STABILITY_VERIFICATION_MS);
}

export function getSavedLlmProvider(): LlmProviderType | null {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(LLM_PROVIDER_STORAGE_KEY);
    if (
      saved === 'webllm' ||
      saved === 'chrome_ai' ||
      saved === 'ollama' ||
      saved === 'rule_based'
    ) {
      return saved;
    }
  }
  return null;
}

const translationResultCache = new Map<
  string,
  {
    translation: string;
    source: 'webllm' | 'chrome_ai' | 'chrome_translator' | 'ollama' | 'cloud_dict';
  }
>();

export function clearTranslationResultCache(): void {
  translationResultCache.clear();
}

export function saveLlmProviderSelection(provider: LlmProviderType): void {
  translationResultCache.clear();
  if (provider !== 'webllm') {
    clearVerifiedWebLlmModel();
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LLM_PROVIDER_STORAGE_KEY, provider);
  }
}

export type WebLlmModelId =
  | 'bonsai-1.7b-q1'
  | 'bonsai-2-2b-pq2'
  | 'bonsai-2-4b-pq2';

export interface WebGpuModelOption {
  id: WebLlmModelId;
  url: string;
  label: string;
  vram: string;
  desc: string;
}

export const WEBLLM_MODEL_OPTIONS: WebGpuModelOption[] = [
  {
    id: 'bonsai-1.7b-q1',
    url: 'https://huggingface.co/prism-ml/Bonsai-1.7B-gguf/resolve/main/Bonsai-1.7B-Q1_0.gguf',
    label: 'LITE // BONSAI 1.7B',
    vram: '237 MB',
    desc: 'Lightweight & fast',
  },
  {
    id: 'bonsai-2-2b-pq2',
    url: 'https://huggingface.co/prism-ml/Ternary-Bonsai-2-2B-gguf/resolve/main/Ternary-Bonsai-2-2B-PQ2_0.gguf',
    label: 'STANDARD // BONSAI 2 2B',
    vram: '495 MB',
    desc: 'Balanced quality (Recommended)',
  },
  {
    id: 'bonsai-2-4b-pq2',
    url: 'https://huggingface.co/prism-ml/Ternary-Bonsai-2-4B-gguf/resolve/main/Ternary-Bonsai-2-4B-PQ2_0.gguf',
    label: 'HIGH QUALITY // BONSAI 2 4B',
    vram: '1.09 GB',
    desc: 'Best translation accuracy',
  },
];

export function getSavedWebLlmModel(): WebLlmModelId {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(MODEL_STORAGE_KEY);
    if (
      saved &&
      WEBLLM_MODEL_OPTIONS.some(
        (m) => m.id.toLowerCase() === saved.toLowerCase()
      )
    ) {
      return saved as WebLlmModelId;
    }
  }
  return 'bonsai-2-2b-pq2';
}

export function saveWebLlmModelSelection(modelId: WebLlmModelId): void {
  translationResultCache.clear();
  if (getVerifiedWebLlmModel() !== modelId) {
    clearVerifiedWebLlmModel();
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(MODEL_STORAGE_KEY, modelId);
  }
}

export const DEFAULT_WEBLLM_MODEL: WebLlmModelId = getSavedWebLlmModel();

export type TranslationLangCode =
  | 'ja'
  | 'zh-CN'
  | 'zh-TW'
  | 'ko'
  | 'es'
  | 'fr'
  | 'de';

export const TRANSLATION_LANGUAGES: Array<{
  code: TranslationLangCode;
  label: string;
  englishName: string;
}> = [
  { code: 'ja', label: 'JAPANESE (日本語)', englishName: 'Japanese' },
  { code: 'zh-CN', label: 'CHINESE (简体)', englishName: 'Simplified Chinese' },
  { code: 'zh-TW', label: 'CHINESE (繁體)', englishName: 'Traditional Chinese' },
  { code: 'ko', label: 'KOREAN (한국어)', englishName: 'Korean' },
  { code: 'es', label: 'SPANISH (ES)', englishName: 'Spanish' },
  { code: 'fr', label: 'FRENCH (FR)', englishName: 'French' },
  { code: 'de', label: 'GERMAN (DE)', englishName: 'German' },
];

const TRANSLATION_LANG_STORAGE_KEY = 'wetware_translation_lang';

export function getSavedTranslationLang(): TranslationLangCode {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(TRANSLATION_LANG_STORAGE_KEY);
    if (
      saved &&
      TRANSLATION_LANGUAGES.some((l) => l.code === saved)
    ) {
      return saved as TranslationLangCode;
    }
  }
  return 'ja';
}

export function saveTranslationLangSelection(lang: TranslationLangCode): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TRANSLATION_LANG_STORAGE_KEY, lang);
  }
}

const CLOUD_TRANSLATION_STORAGE_KEY = 'wetware_allow_cloud_translation';

export function getSavedCloudTranslationEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(CLOUD_TRANSLATION_STORAGE_KEY) === 'true';
  }
  return false; // Default OFF for strict privacy
}

export function saveCloudTranslationEnabled(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      CLOUD_TRANSLATION_STORAGE_KEY,
      enabled ? 'true' : 'false'
    );
  }
}

// Hybrid Rule + Lightweight LLM Distractor Architecture (Method 2):
// - Semantic chunking & Cloze sentence extraction are handled deterministically in <1ms by `chunker.ts`.
// - Instead of asking a tiny 1B model to synthesize nested JSON quizzes (which exceeds 1B reasoning capacity
//   and causes 2B+ models to OOM on iOS), the LLM is only asked for 3 comma-separated distractor words per blank.
function sanitizeTargetWord(raw: string): string {
  const words = raw.trim().match(/[A-Za-z]{3,}/g);
  return words ? words[words.length - 1].toLowerCase() : 'concept';
}

function buildDistractorPrompt(targetWords: string[]): string {
  const numbered = targetWords
    .slice(0, 3)
    .map((w, idx) => `${idx + 1}. ${sanitizeTargetWord(w)}:`)
    .join('\n');
  return `Write 3 related English words (synonyms or same category, separated by commas) for each numbered word below. Output ONLY the numbered lines.

Example:
velocity -> speed, motion, tempo

Words:
${numbered}`;
}

function buildDistractorChatMessages(
  targetWords: string[]
): Array<{ role: 'system' | 'user'; content: string }> {
  const numbered = targetWords
    .slice(0, 3)
    .map((w, idx) => `${idx + 1}. ${sanitizeTargetWord(w)} ->`)
    .join('\n');
  return [
    {
      role: 'system',
      content:
        'Write 3 related English words (synonyms or same category, separated by commas) for each numbered word. Output ONLY the numbered lines.',
    },
    {
      role: 'user',
      content: `Example:\nvelocity -> speed, motion, tempo\npainting -> sculpture, drawing, fresco\n\n${numbered}`,
    },
  ];
}

const PROMPT_STOPWORDS = new Set([
  'word',
  'words',
  'output',
  'example',
  'choice',
  'option',
  'velocity',
  'speed',
  'motion',
  'tempo',
  'cortical',
  'neural',
  'cerebral',
  'sensory',
  'painting',
  'sculpture',
  'drawing',
  'fresco',
  'related',
  'english',
  'complete',
  'these',
  'lines',
]);

function applyLlmDistractorsToQuestions(
  baseQuestions: QuizQuestion[],
  rawLlmText: string
): { updatedQuestions: QuizQuestion[]; appliedCount: number } {
  const cleanedText = rawLlmText
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .replace(
      /<\|thought\|>[\s\S]*?(?:<\|thought\|>|<\/thought>|<thought\|>|$)/gi,
      ''
    )
    .trim();

  const lines = cleanedText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const targetLowerSet = new Set(
    baseQuestions.map((q) =>
      sanitizeTargetWord(q.options[q.correctIndex]).toLowerCase()
    )
  );

  // Collect all valid English words >= 3 chars across the whole response as a shared pool
  // (Handles both multi-line output and single-line output like "1. Skilled, 2. Diagnostic, 3. Probe.")
  const allCandidateWords = Array.from(
    new Set(
      (cleanedText.match(/\b[A-Za-z]{3,18}\b/g) || [])
        .map((w) => w.toLowerCase())
        .filter((w) => !targetLowerSet.has(w) && !PROMPT_STOPWORDS.has(w))
    )
  );

  let appliedCount = 0;
  let globalCursor = 0;

  const updatedQuestions = baseQuestions.map((q, idx) => {
    const correctWord = q.options[q.correctIndex];
    const lowerCorrect = sanitizeTargetWord(correctWord).toLowerCase();

    // Find matching numbered line (e.g. "1." or "1)") if multi-line
    const numberedLine =
      lines.find(
        (l) =>
          l.startsWith(`${idx + 1}.`) ||
          l.startsWith(`${idx + 1}:`) ||
          l.startsWith(`${idx + 1})`)
      ) ||
      lines[idx] ||
      '';

    // Strip leading "1. targetWord ->" or "1. targetWord:" only if multiple lines exist
    const rhs =
      lines.length >= 2 && numberedLine.includes('->')
        ? numberedLine.split('->').slice(1).join(' ')
        : lines.length >= 2 && numberedLine.includes(':')
        ? numberedLine.split(':').slice(1).join(' ')
        : numberedLine;

    const lineWords = Array.from(
      new Set(
        (rhs.match(/\b[A-Za-z]{3,18}\b/g) || [])
          .map((w) => w.toLowerCase())
          .filter(
            (w) =>
              w !== lowerCorrect &&
              !targetLowerSet.has(w) &&
              !PROMPT_STOPWORDS.has(w)
          )
      )
    );

    const distractors: string[] = [];
    for (const w of lineWords) {
      if (distractors.length >= 3) break;
      if (!distractors.includes(w)) {
        distractors.push(w);
      }
    }

    // Top up from the global LLM candidate pool
    while (distractors.length < 3 && globalCursor < allCandidateWords.length) {
      const candidate = allCandidateWords[globalCursor++];
      if (candidate !== lowerCorrect && !distractors.includes(candidate)) {
        distractors.push(candidate);
      }
    }

    // If the LLM only returned 1 or 2 words total (e.g. "1. WordA, 2. WordB, 3. WordC"),
    // still apply the LLM word(s) we got and keep existing rule-based distractors for the remaining slots!
    if (distractors.length === 0) {
      return q;
    }

    appliedCount++;
    const nextOptions: [string, string, string, string] = [...q.options] as [
      string,
      string,
      string,
      string,
    ];
    let dIdx = 0;
    for (let slot = 0; slot < 4; slot++) {
      if (slot !== q.correctIndex && dIdx < distractors.length) {
        // Match capitalization of the correct option if capitalized
        const rawDist = distractors[dIdx++];
        const formatted =
          /^[A-Z]/.test(correctWord)
            ? rawDist.charAt(0).toUpperCase() + rawDist.slice(1)
            : rawDist;
        nextOptions[slot] = formatted;
      }
    }

    return {
      ...q,
      options: nextOptions,
    };
  });

  return { updatedQuestions, appliedCount };
}

// Persist engine singleton on globalThis so Vite HMR updates never drop VRAM state
const ENGINE_CONFIG_VERSION = 9;

type ProgressListener = (text: string, progress: number) => void;

interface GlobalWebLlmState {
  engine: HachiueEngine | null;
  loadedModelId: string | null;
  loadingModelId: string | null;
  loadingPromise: Promise<HachiueEngine> | null;
  lastProgressText: string;
  lastProgressRatio: number;
  listeners: Set<ProgressListener>;
  configVersion?: number;
}

const globalState: GlobalWebLlmState = (() => {
  const g = globalThis as unknown as {
    __WETWARE_WEBLLM__?: GlobalWebLlmState & {
      engine?: { dispose?: () => void; unload?: () => Promise<void> } | null;
      worker?: Worker | null;
    };
  };
  if (
    !g.__WETWARE_WEBLLM__ ||
    g.__WETWARE_WEBLLM__.configVersion !== ENGINE_CONFIG_VERSION
  ) {
    try {
      g.__WETWARE_WEBLLM__?.engine?.dispose?.();
      void g.__WETWARE_WEBLLM__?.engine?.unload?.();
      g.__WETWARE_WEBLLM__?.worker?.terminate();
    } catch {
      // Ignore prior engine teardown errors
    }
    g.__WETWARE_WEBLLM__ = {
      engine: null,
      loadedModelId: null,
      loadingModelId: null,
      loadingPromise: null,
      lastProgressText: '',
      lastProgressRatio: 0,
      listeners: new Set<ProgressListener>(),
      configVersion: ENGINE_CONFIG_VERSION,
    };
  }
  return g.__WETWARE_WEBLLM__;
})();

export function subscribeWebLlmProgress(
  listener: ProgressListener
): () => void {
  globalState.listeners.add(listener);
  if (globalState.loadingPromise && globalState.lastProgressText) {
    listener(globalState.lastProgressText, globalState.lastProgressRatio);
  }
  return () => {
    globalState.listeners.delete(listener);
  };
}

export function isWebLlmLoading(): boolean {
  return globalState.loadingPromise !== null;
}

export function isWebGpuSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export function isWebLlmReady(modelId?: string): boolean {
  if (!globalState.engine || !globalState.loadedModelId) return false;
  if (!modelId) return true;
  return globalState.loadedModelId.toLowerCase() === modelId.toLowerCase();
}

export function getLoadedWebLlmModelId(): string | null {
  return globalState.loadedModelId;
}

/**
 * Checks which Bonsai 1 / Bonsai 2 GGUF models are cached in OPFS or IndexedDB (`hachiue`).
 * Completes in <2ms with zero network requests.
 */
export async function checkCachedWebLlmModels(): Promise<
  Record<WebLlmModelId, boolean>
> {
  const result = Object.fromEntries(
    WEBLLM_MODEL_OPTIONS.map((opt) => [opt.id, false])
  ) as Record<WebLlmModelId, boolean>;

  await Promise.all(
    WEBLLM_MODEL_OPTIONS.map(async (opt) => {
      try {
        result[opt.id] = await isModelCached(opt.url);
      } catch {
        result[opt.id] = false;
      }
    })
  );
  return result;
}

/**
 * Explicitly disposes the active Hachiue WebGPU engine (`GPUDevice.destroy()`)
 * and yields across macrotasks so the mobile GPU driver finishes reclaiming unified memory.
 */
export async function unloadWebLlmEngine(options?: {
  preserveAutoLoad?: boolean;
}): Promise<void> {
  translationResultCache.clear();
  cancelStabilityVerificationTimer();
  if (!options?.preserveAutoLoad) {
    clearVerifiedWebLlmModel();
  }
  const hadActiveEngine = Boolean(globalState.engine);

  if (globalState.engine) {
    try {
      globalState.engine.dispose();
    } catch {
      // Ignore dispose error
    }
    globalState.engine = null;
  }

  globalState.loadedModelId = null;

  if (hadActiveEngine) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/**
 * Purges downloaded GGUF chunks from OPFS / IndexedDB (`hachiue`) and any legacy CacheStorage buckets.
 */
export async function purgeWebLlmDiskCache(): Promise<void> {
  await unloadWebLlmEngine();
  await clearModelCache().catch(() => {});

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await window.caches.keys();
      await Promise.all(
        keys
          .filter(
            (k) =>
              k.includes('webllm') ||
              k.includes('mlc') ||
              k.includes('tvmjs') ||
              k.includes('transformers-cache')
          )
          .map((k) => window.caches.delete(k))
      );
    } catch {
      // Ignore CacheStorage error
    }
  }
}

/**
 * Downloads a GGUF model to OPFS / IndexedDB cache without allocating WebGPU buffers or unloading the active VRAM model.
 */
export async function prefetchWebLlmModelToCache(
  modelId: string = DEFAULT_WEBLLM_MODEL,
  onProgress?: (text: string, progress: number) => void
): Promise<ParsedGgufHeader> {
  const matchedOption =
    WEBLLM_MODEL_OPTIONS.find(
      (m) => m.id.toLowerCase() === modelId.toLowerCase()
    ) || WEBLLM_MODEL_OPTIONS[1];

  const notifyProgress = (report: { text: string; progress: number }) => {
    globalState.lastProgressText = report.text;
    globalState.lastProgressRatio = report.progress;
    onProgress?.(report.text, report.progress);
    globalState.listeners.forEach((fn) => {
      try {
        fn(report.text, report.progress);
      } catch {
        // Ignore listener error
      }
    });
  };

  const header = await prefetchModel(matchedOption.url, {
    onProgress: (p) => {
      if (p.phase === 'weights' && p.totalBytes) {
        const ratio =
          p.loadedBytes !== undefined ? p.loadedBytes / p.totalBytes : 0;
        const mb = ((p.loadedBytes ?? 0) / 1048576).toFixed(0);
        const totMb = (p.totalBytes / 1048576).toFixed(0);
        notifyProgress({
          text: `${
            p.cached ? 'Verifying cache' : 'Downloading to cache (GPU kept active)'
          }: ${mb} / ${totMb} MiB`,
          progress: ratio,
        });
      } else if (p.message) {
        notifyProgress({
          text: p.message,
          progress: globalState.lastProgressRatio,
        });
      }
    },
  });

  notifyProgress({
    text: `Cached ${matchedOption.label} on disk`,
    progress: 1,
  });
  return header;
}

/**
 * Initializes (or reuses) the in-browser `hachiue` WebGPU engine for Bonsai 1 (1-bit Q1_0)
 * and Bonsai 2 (Ternary 1.58-bit PTQ1_0 / PQ2_0 + FWHT + Qwen3.5 Gated DeltaNet) GGUF models.
 *
 * When switching from an active model in VRAM to a model that is not yet downloaded:
 * - Phase 1 streams the new model to OPFS / IndexedDB cache FIRST while keeping the previous
 *   model active in VRAM so translations continue uninterrupted during the download.
 * - Phase 2 unloads the previous model from VRAM and loads the new model from local cache.
 */
export async function initWebLlmEngine(
  modelId: string = DEFAULT_WEBLLM_MODEL,
  onProgress?: (text: string, progress: number) => void
): Promise<HachiueEngine> {
  if (!isWebGpuSupported()) {
    throw new Error(
      'WebGPU is not available in this browser context (requires Secure Context: localhost or HTTPS).'
    );
  }

  const matchedOption =
    WEBLLM_MODEL_OPTIONS.find(
      (m) => m.id.toLowerCase() === modelId.toLowerCase()
    ) || WEBLLM_MODEL_OPTIONS[1];
  const resolvedModelId = matchedOption.id;

  if (
    globalState.engine &&
    globalState.loadedModelId?.toLowerCase() === resolvedModelId.toLowerCase()
  ) {
    return globalState.engine;
  }

  if (
    globalState.loadingPromise &&
    globalState.loadingModelId?.toLowerCase() === resolvedModelId.toLowerCase()
  ) {
    if (onProgress) {
      const unsub = subscribeWebLlmProgress(onProgress);
      return globalState.loadingPromise.finally(() => unsub());
    }
    return globalState.loadingPromise;
  }

  const priorLoadPromise = globalState.loadingPromise;

  const notifyProgress = (report: { text: string; progress: number }) => {
    globalState.lastProgressText = report.text;
    globalState.lastProgressRatio = report.progress;
    onProgress?.(report.text, report.progress);
    globalState.listeners.forEach((fn) => {
      try {
        fn(report.text, report.progress);
      } catch {
        // Ignore listener error
      }
    });
  };

  globalState.loadingModelId = resolvedModelId;
  const loadTask = (async (): Promise<HachiueEngine> => {
    try {
      if (priorLoadPromise) {
        try {
          await priorLoadPromise;
        } catch {
          // Ignore prior aborted load error
        }
      }

      // Phase 1: If the target model is not cached yet, download it to OPFS / IndexedDB FIRST
      // while keeping the previous model active in VRAM (`globalState.engine`) so the user
      // can continue translating with the previous model until the download finishes!
      const alreadyCached = await isModelCached(matchedOption.url).catch(
        () => false
      );
      if (!alreadyCached) {
        await prefetchModel(matchedOption.url, {
          onProgress: (p) => {
            if (p.phase === 'weights' && p.totalBytes) {
              const ratio =
                p.loadedBytes !== undefined
                  ? (p.loadedBytes / p.totalBytes) * 0.85
                  : 0;
              const mb = ((p.loadedBytes ?? 0) / 1048576).toFixed(0);
              const totMb = (p.totalBytes / 1048576).toFixed(0);
              const activeNote = globalState.loadedModelId
                ? ` (${globalState.loadedModelId} active)`
                : '';
              notifyProgress({
                text: `Downloading to cache${activeNote}: ${mb} / ${totMb} MiB`,
                progress: ratio,
              });
            } else if (p.message) {
              notifyProgress({
                text: p.message,
                progress: globalState.lastProgressRatio,
              });
            }
          },
        });
      }

      // Phase 2: Wait for any in-flight inference on the previous model, then swap VRAM
      await runSerializedInference(async () => {});

      if (globalState.engine) {
        notifyProgress({
          text: 'Swapping VRAM to new model...',
          progress: alreadyCached ? 0 : 0.86,
        });
        await unloadWebLlmEngine({ preserveAutoLoad: true });
      }

      // Set crash-loop guard right before WebGPU buffer allocation (`HachiueEngine.create`).
      // Cleared once the model finishes loading and runs stably for `STABILITY_VERIFICATION_MS`.
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LOADING_GUARD_STORAGE_KEY, resolvedModelId);
      }

      const engine = await HachiueEngine.create({
        url: matchedOption.url,
        maxSeqLen: 512,
        onProgress: (p) => {
          if (p.phase === 'weights' && p.totalBytes) {
            const rawRatio =
              p.loadedBytes !== undefined ? p.loadedBytes / p.totalBytes : 0;
            const scaledRatio = alreadyCached
              ? rawRatio
              : 0.86 + rawRatio * 0.14;
            const mb = ((p.loadedBytes ?? 0) / 1048576).toFixed(0);
            const totMb = (p.totalBytes / 1048576).toFixed(0);
            notifyProgress({
              text: `Uploading cached GGUF to WebGPU: ${mb} / ${totMb} MiB`,
              progress: scaledRatio,
            });
          } else if (p.message) {
            notifyProgress({
              text: p.message,
              progress: p.phase === 'ready' ? 1 : globalState.lastProgressRatio,
            });
          }
        },
        onDeviceLost: () => {
          globalState.engine = null;
          globalState.loadedModelId = null;
          clearVerifiedWebLlmModel();
        },
      });

      globalState.engine = engine;
      globalState.loadedModelId = resolvedModelId;
      translationResultCache.clear();
      scheduleModelStabilityVerification(resolvedModelId);
      return engine;
    } catch (err) {
      clearVerifiedWebLlmModel();
      throw err;
    } finally {
      globalState.loadingPromise = null;
      globalState.loadingModelId = null;
    }
  })();

  globalState.loadingPromise = loadTask;
  return loadTask;
}

function repairAndParseJson(candidate: string): Record<string, unknown> {
  // 1. Try strict JSON.parse first
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    // Continue to relaxed JSON repair
  }

  let repaired = candidate.trim();

  // Remove single-line // comments that aren't inside URLs (http:// or https://)
  repaired = repaired.replace(/(^|[^:])\/\/.*$/gm, '$1');

  // Quote unquoted object keys: { chunks: [...] } or , questions: [...]
  repaired = repaired.replace(
    /([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g,
    '$1"$2":'
  );

  // Convert single-quoted property names {'chunks': ...} to double-quoted {"chunks": ...}
  repaired = repaired.replace(
    /([{,]\s*)'([A-Za-z_][A-Za-z0-9_]*)'\s*:/g,
    '$1"$2":'
  );

  // Convert single-quoted string values : 'value' or ['a', 'b'] when double quotes are absent
  repaired = repaired.replace(
    /([:[,]\s*)'([^'\\]*(?:\\.[^'\\]*)*)'(\s*[,}\]])/g,
    (_m, prefix: string, inner: string, suffix: string) =>
      `${prefix}"${inner.replace(/"/g, '\\"')}"${suffix}`
  );

  // Remove trailing commas before } or ]
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(repaired) as Record<string, unknown>;
  } catch {
    // 2. If truncated by max_tokens, attempt to close open brackets/braces
    let balanced = repaired.replace(/,\s*$/, '');
    const stack: string[] = [];
    let inString = false;
    let escaped = false;
    for (let i = 0; i < balanced.length; i++) {
      const ch = balanced[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') stack.pop();
    }
    if (inString) balanced += '"';
    while (stack.length > 0) {
      balanced += stack.pop();
    }
    balanced = balanced.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(balanced) as Record<string, unknown>;
  }
}

export function parseLlmJsonOutput(rawContent: string): {
  chunks?: string[];
  discourseMarkerIndices?: number[];
  questions?: QuizQuestion[];
} {
  // 1. Strip thinking blocks (<think>...</think> or Gemma 4 <|thought|>...<|thought|>)
  let cleaned = rawContent
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\|thought\|>[\s\S]*?(?:<\|thought\|>|<\/thought>|<thought\|>)/gi, '')
    .trim();

  // 2. Collect candidate JSON substrings in priority order:
  //    (a) Inside ```json ... ``` fenced block
  //    (b) Starting at the `{` immediately preceding `"chunks"` or `"questions"`
  //    (c) Outermost `{ ... }`
  const candidates: string[] = [];

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    const fenced = fenceMatch[1].trim();
    const fStart = fenced.indexOf('{');
    const fEnd = fenced.lastIndexOf('}');
    if (fStart !== -1 && fEnd > fStart) {
      candidates.push(fenced.slice(fStart, fEnd + 1));
    }
  }

  const noFences = cleaned.replace(/```(?:json)?/gi, '').trim();

  const schemaKeyMatch = noFences.match(
    /\{\s*["']?(?:chunks|discourseMarkerIndices|questions)["']?\s*:/
  );
  if (schemaKeyMatch?.index !== undefined) {
    const startIdx = schemaKeyMatch.index;
    const endIdx = noFences.lastIndexOf('}');
    if (endIdx > startIdx) {
      candidates.push(noFences.slice(startIdx, endIdx + 1));
    } else {
      candidates.push(noFences.slice(startIdx));
    }
  }

  const firstBrace = noFences.indexOf('{');
  const lastBrace = noFences.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(noFences.slice(firstBrace, lastBrace + 1));
  } else if (firstBrace !== -1) {
    candidates.push(noFences.slice(firstBrace));
  }

  let parsed: Record<string, unknown> | null = null;
  let lastError: unknown = null;

  for (const cand of candidates) {
    try {
      const obj = repairAndParseJson(cand);
      if (
        obj &&
        typeof obj === 'object' &&
        (Array.isArray(obj.chunks) || Array.isArray(obj.questions))
      ) {
        parsed = obj;
        break;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!parsed) {
    const preview = rawContent.replace(/\s+/g, ' ').trim().slice(0, 140);
    const errMsg =
      lastError instanceof Error ? lastError.message : 'Invalid JSON output';
    throw new Error(`${errMsg} | Raw output: "${preview}"`);
  }

  const rawQuestions = Array.isArray(parsed.questions)
    ? parsed.questions
    : [];

  const validQuestions: QuizQuestion[] = [];
  for (let i = 0; i < rawQuestions.length && validQuestions.length < 3; i++) {
    const q = rawQuestions[i] as Record<string, unknown>;
    if (!q || typeof q !== 'object') continue;

    const qText = String(q.question || q.q || '').trim();
    const rawOpts = Array.isArray(q.options)
      ? q.options
      : Array.isArray(q.o)
      ? q.o
      : Array.isArray(q.choices)
      ? q.choices
      : null;

    if (
      !qText ||
      qText.length < 8 ||
      /^question\??$/i.test(qText) ||
      !rawOpts ||
      rawOpts.length < 4
    ) {
      continue;
    }

    const options = rawOpts.slice(0, 4).map((o) => String(o).trim()) as [
      string,
      string,
      string,
      string,
    ];
    if (options.some((o) => !o || /^option [a-d1-4]$/i.test(o))) {
      continue;
    }

    const rawAns = q.correctIndex ?? q.a ?? q.answer ?? 0;
    validQuestions.push({
      id: `q-llm-${Date.now()}-${validQuestions.length}`,
      code: String(q.code || `SYNAPSE-0${validQuestions.length + 1}`),
      question: qText,
      options,
      correctIndex: Math.max(0, Math.min(3, Number(rawAns) || 0)),
      explanation: String(q.explanation || q.e || '').trim(),
    });
  }

  if (validQuestions.length === 0 && !Array.isArray(parsed.chunks)) {
    const preview = rawContent.replace(/\s+/g, ' ').trim().slice(0, 140);
    throw new Error(
      `LLM output did not contain valid 4-option questions | Raw output: "${preview}"`
    );
  }

  const questions: QuizQuestion[] | undefined =
    validQuestions.length > 0 ? validQuestions : undefined;

  return {
    chunks: Array.isArray(parsed.chunks)
      ? parsed.chunks.map(String)
      : undefined,
    discourseMarkerIndices: Array.isArray(parsed.discourseMarkerIndices)
      ? parsed.discourseMarkerIndices.map(Number)
      : undefined,
    questions,
  };
}

/**
 * Fetches a random summary article from Wikipedia REST API (CORS-enabled)
 */
export async function fetchWikipediaPassage(): Promise<{
  title: string;
  rawText: string;
  category: string;
}> {
  const res = await fetch(
    'https://en.wikipedia.org/api/rest_v1/page/random/summary'
  );
  if (!res.ok) {
    throw new Error(`Wikipedia API returned ${res.status}`);
  }
  const data = await res.json();
  const extract: string = data.extract || '';
  return {
    title: data.title || 'Wikipedia Summary',
    rawText:
      extract.split(/\s+/).length >= 60
        ? extract
        : `${extract} ${data.description || ''}`.trim(),
    category: 'WIKIPEDIA',
  };
}

const CURATED_ART_TOPICS: readonly string[] = [
  'Impressionism',
  'Cubism',
  'Surrealism',
  'Abstract_expressionism',
  'Bauhaus',
  'Ukiyo-e',
  'Chiaroscuro',
  'Golden_ratio',
  'Gothic_architecture',
  'Brutalist_architecture',
  'De_Stijl',
  'Art_Nouveau',
  'Dada',
  'Minimalism',
  'Fugue',
  'Counterpoint',
  'Sonata_form',
  'Polyphony',
  'Film_noir',
  'Soviet_montage_theory',
  'Japanese_aesthetics',
  'Wabi-sabi',
  'Kintsugi',
  'Perspective_(graphical)',
  'Color_theory',
  'Pointillism',
  'Fauvism',
  'Baroque_painting',
];

/**
 * Fetches a curated Arts, Architecture, Music Theory, or Cinema summary from Wikipedia REST API v1
 */
export async function fetchWikipediaArtPassage(): Promise<{
  title: string;
  rawText: string;
  category: string;
}> {
  const topic =
    CURATED_ART_TOPICS[Math.floor(Math.random() * CURATED_ART_TOPICS.length)];
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      topic
    )}`
  );
  if (!res.ok) {
    throw new Error(`Wikipedia Art API returned ${res.status}`);
  }
  const data = await res.json();
  const extract: string = data.extract || '';
  return {
    title: data.title || topic.replace(/_/g, ' '),
    rawText:
      extract.split(/\s+/).length >= 60
        ? extract
        : `${extract} ${data.description || ''}`.trim(),
    category: 'FINE_ARTS',
  };
}

/**
 * Fetches a recent tech article from Dev.to API (CORS-enabled)
 */
export async function fetchDevToPassage(): Promise<{
  title: string;
  rawText: string;
  category: string;
}> {
  const listRes = await fetch('https://dev.to/api/articles?per_page=12&top=7');
  if (!listRes.ok) {
    throw new Error(`Dev.to API returned ${listRes.status}`);
  }
  const list = await listRes.json();
  const pick = list[Math.floor(Math.random() * list.length)];
  const detailRes = await fetch(`https://dev.to/api/articles/${pick.id}`);
  const detail = await detailRes.json();

  const rawMarkdown: string = detail.body_markdown || pick.description || '';
  const cleaned = rawMarkdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').slice(0, 260).join(' ');
  return {
    title: pick.title || 'Dev.to Technical Article',
    rawText: words,
    category: 'DEV_TO',
  };
}

let inferenceChain: Promise<unknown> = Promise.resolve();
let activeTranslationAbort: AbortController | null = null;

function runSerializedInference<T>(task: () => Promise<T>): Promise<T> {
  const next = inferenceChain.then(task, task);
  inferenceChain = next.catch(() => {});
  return next;
}

/**
 * Unified 3-Tier On-Device LLM Pipeline (Section 6.3):
 * 1. 'webllm': In-browser WebGPU execution via `hachiue` (Bonsai 1 & Bonsai 2 GGUF)
 * 2. 'ollama': Local Ollama / OpenAI-compatible HTTP endpoint
 * 3. 'rule_based': Instant heuristic chunker & Cloze quiz generator fallback
 */
export async function processPassageWithOptionalLlm(params: {
  title: string;
  rawText: string;
  category: string;
  sourceType: TrainingPassage['sourceType'];
  provider: LlmProviderType;
  webLlmModel?: string;
  llmEndpoint: string;
  llmModel: string;
  onProgress?: (statusText: string) => void;
}): Promise<{
  passage: TrainingPassage;
  usedProvider: LlmProviderType;
  fallbackReason?: string;
}> {
  let fallbackReason: string | undefined;

  // Step 1: Build deterministic rule-based chunks + Cloze quiz skeleton (<1ms)
  const basePassage = buildNormalizedPassage({
    title: params.title,
    rawText: params.rawText,
    category: params.category,
    sourceType: params.sourceType,
  });

  const targetWords = basePassage.questions
    .slice(0, 3)
    .map((q) => q.options[q.correctIndex]);
  const distractorPrompt = buildDistractorPrompt(targetWords);
  const distractorMessages = buildDistractorChatMessages(targetWords);

  // Tier A: In-Browser WebGPU (`hachiue` Bonsai 1 & 2) — Ultra-lightweight distractor word generation
  if (params.provider === 'webllm') {
    try {
      const requestedModel = params.webLlmModel || DEFAULT_WEBLLM_MODEL;
      const activeLoadedModel = getLoadedWebLlmModelId();
      const modelId =
        isWebLlmLoading() && activeLoadedModel
          ? activeLoadedModel
          : requestedModel;
      const engine = await initWebLlmEngine(modelId, (text, progress) => {
        const pct = Math.round(progress * 100);
        params.onProgress?.(`[WebGPU ${pct}%] ${text}`);
      });

      params.onProgress?.(
        `Generating Cloze distractors on WebGPU (${modelId})...`
      );

      const reply = await runSerializedInference(() =>
        engine.generate(distractorMessages, {
          temperature: 0,
          maxNewTokens: 64,
        })
      );

      const content = reply.text || '';
      const { updatedQuestions, appliedCount } = applyLlmDistractorsToQuestions(
        basePassage.questions,
        content
      );

      if (appliedCount === 0) {
        const preview = content.replace(/\s+/g, ' ').trim().slice(0, 120);
        throw new Error(`No valid distractor words parsed | Raw: "${preview}"`);
      }

      return {
        passage: {
          ...basePassage,
          questions: updatedQuestions,
        },
        usedProvider: 'webllm',
      };
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
      params.onProgress?.(
        `WebGPU fallback (${fallbackReason}) -> using Rule-based Cloze...`
      );
    }
  }

  // Tier A2: Chrome Built-in AI (Gemini Nano via Prompt API: LanguageModel / window.ai.languageModel)
  if (params.provider === 'chrome_ai') {
    try {
      params.onProgress?.('Querying Chrome Built-in AI (Gemini Nano)...');
      const content = await promptChromeBuiltInAi(distractorPrompt);
      const { updatedQuestions, appliedCount } = applyLlmDistractorsToQuestions(
        basePassage.questions,
        content
      );
      if (appliedCount === 0) {
        const preview = content.replace(/\s+/g, ' ').trim().slice(0, 120);
        throw new Error(
          `No valid distractor words parsed from Gemini Nano | Raw: "${preview}"`
        );
      }
      return {
        passage: {
          ...basePassage,
          questions: updatedQuestions,
        },
        usedProvider: 'chrome_ai',
      };
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
      params.onProgress?.(
        `Chrome AI fallback (${fallbackReason}) -> using Rule-based Cloze...`
      );
    }
  }

  // Tier B: Local Ollama / LM Studio HTTP Server
  if (params.provider === 'ollama' && params.llmEndpoint) {
    try {
      params.onProgress?.(
        `Querying local LLM (${params.llmModel} @ ${params.llmEndpoint})...`
      );
      const base = params.llmEndpoint.replace(/\/$/, '');
      const isOpenAiCompat = base.includes(':1234') || base.endsWith('/v1');
      const url = isOpenAiCompat
        ? `${base.replace(/\/v1$/, '')}/v1/chat/completions`
        : `${base}/api/generate`;

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);

      const body = isOpenAiCompat
        ? JSON.stringify({
            model: params.llmModel || 'gemma2:2b',
            messages: [{ role: 'user', content: distractorPrompt }],
            temperature: 0.3,
            max_tokens: 64,
          })
        : JSON.stringify({
            model: params.llmModel || 'gemma2:2b',
            prompt: distractorPrompt,
            stream: false,
          });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      window.clearTimeout(timeout);

      if (response.ok) {
        const json = await response.json();
        const rawContent: string = isOpenAiCompat
          ? json.choices?.[0]?.message?.content || ''
          : json.response || '';

        const { updatedQuestions, appliedCount } =
          applyLlmDistractorsToQuestions(basePassage.questions, rawContent);
        if (appliedCount > 0) {
          return {
            passage: {
              ...basePassage,
              questions: updatedQuestions,
            },
            usedProvider: 'ollama',
          };
        }
        fallbackReason = 'No valid distractor words parsed from Ollama';
      } else {
        fallbackReason = `HTTP ${response.status} from ${url}`;
      }
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
    }
  }

  // Tier C: Rule-based Chunker & Cloze Generator Fallback
  return {
    passage: basePassage,
    usedProvider: 'rule_based',
    fallbackReason,
  };
}

interface ChromeLanguageModelSession {
  prompt: (input: string, options?: { responseConstraint?: unknown }) => Promise<string>;
  clone?: () => Promise<ChromeLanguageModelSession>;
  destroy?: () => void;
}

const chromePromptBaseSessions = new Map<string, ChromeLanguageModelSession>();

/**
 * Checks whether Chrome Built-in Prompt API (Gemini Nano) is available
 * via the standard `LanguageModel` global (`'LanguageModel' in self`).
 */
export async function checkChromePromptApiAvailability(): Promise<{
  supported: boolean;
  status: 'available' | 'downloadable' | 'downloading' | 'unavailable';
  detail: string;
}> {
  if (typeof self === 'undefined' || !('LanguageModel' in self)) {
    return {
      supported: false,
      status: 'unavailable',
      detail:
        'Chrome Prompt API not detected (Enable chrome://flags/#prompt-api-for-gemini-nano on Desktop Chrome)',
    };
  }

  const g = self as unknown as {
    LanguageModel?: {
      availability?: () => Promise<string>;
    };
  };

  try {
    if (g.LanguageModel && typeof g.LanguageModel.availability === 'function') {
      const avail = await g.LanguageModel.availability();
      if (avail === 'available' || avail === 'readily') {
        return {
          supported: true,
          status: 'available',
          detail: 'GEMINI NANO READY (LanguageModel API)',
        };
      }
      if (avail === 'downloadable' || avail === 'after-download') {
        return {
          supported: true,
          status: 'downloadable',
          detail: 'GEMINI NANO DOWNLOADABLE ON DEMAND',
        };
      }
      if (avail === 'downloading') {
        return {
          supported: true,
          status: 'downloading',
          detail: 'GEMINI NANO DOWNLOADING IN CHROME...',
        };
      }
      return {
        supported: false,
        status: 'unavailable',
        detail: `LanguageModel status: ${avail}`,
      };
    }
  } catch (err) {
    return {
      supported: false,
      status: 'unavailable',
      detail: err instanceof Error ? err.message : 'Prompt API check failed',
    };
  }

  return {
    supported: false,
    status: 'unavailable',
    detail: 'Chrome Prompt API unavailable on this device',
  };
}

/**
 * Runs a prompt on Chrome Built-in Gemini Nano (`LanguageModel`).
 * Uses the `initialPrompts` + `session.clone()` pattern so system instructions
 * are parsed once on the base session and each task runs on an isolated clone
 * that is destroyed immediately after completion.
 */
export async function promptChromeBuiltInAi(
  promptText: string,
  systemInstruction?: string
): Promise<string> {
  if (typeof self === 'undefined' || !('LanguageModel' in self)) {
    throw new Error(
      'Chrome Built-in Prompt API (Gemini Nano) is not available in this browser.'
    );
  }

  const g = self as unknown as {
    LanguageModel?: {
      availability?: () => Promise<string>;
      create?: (opts?: {
        initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      }) => Promise<ChromeLanguageModelSession>;
    };
  };

  if (!g.LanguageModel || typeof g.LanguageModel.create !== 'function') {
    throw new Error(
      'Chrome Built-in Prompt API (Gemini Nano) is not available in this browser.'
    );
  }

  if (typeof g.LanguageModel.availability === 'function') {
    const avail = await g.LanguageModel.availability();
    if (avail === 'unavailable') {
      throw new Error('Gemini Nano is unavailable on this device.');
    }
  }

  const sysKey = systemInstruction?.trim() || '';
  let baseSession = chromePromptBaseSessions.get(sysKey);
  if (!baseSession) {
    baseSession = await g.LanguageModel.create(
      sysKey
        ? {
            initialPrompts: [{ role: 'system', content: sysKey }],
          }
        : undefined
    );
    chromePromptBaseSessions.set(sysKey, baseSession);
  }

  let taskSession: ChromeLanguageModelSession;
  let isCloned = false;
  if (typeof baseSession.clone === 'function') {
    try {
      taskSession = await baseSession.clone();
      isCloned = true;
    } catch {
      chromePromptBaseSessions.delete(sysKey);
      baseSession.destroy?.();
      taskSession = await g.LanguageModel.create(
        sysKey
          ? {
              initialPrompts: [{ role: 'system', content: sysKey }],
            }
          : undefined
      );
    }
  } else {
    taskSession = baseSession;
    chromePromptBaseSessions.delete(sysKey);
  }

  try {
    return await taskSession.prompt(promptText);
  } finally {
    if (isCloned || !chromePromptBaseSessions.has(sysKey)) {
      taskSession.destroy?.();
    }
  }
}

const chromeTranslatorCache = new Map<
  string,
  { translate: (text: string) => Promise<string>; destroy?: () => void }
>();

/**
 * Translates text using Chrome's Built-in On-Device Translator API (`self.Translator`)
 * if available in the browser. Returns null if unsupported.
 */
export async function translateWithChromeBuiltInTranslator(
  text: string,
  targetLang: TranslationLangCode
): Promise<string | null> {
  if (typeof self === 'undefined' || !('Translator' in self)) return null;

  const cached = chromeTranslatorCache.get(targetLang);
  if (cached) {
    try {
      const out = await cached.translate(text);
      if (out?.trim()) return out.trim();
    } catch {
      cached.destroy?.();
      chromeTranslatorCache.delete(targetLang);
    }
  }

  const g = self as unknown as {
    Translator?: {
      availability?: (opts: {
        sourceLanguage: string;
        targetLanguage: string;
      }) => Promise<string>;
      create?: (opts: {
        sourceLanguage: string;
        targetLanguage: string;
      }) => Promise<{
        translate: (input: string) => Promise<string>;
        destroy?: () => void;
      }>;
    };
  };

  try {
    if (g.Translator && typeof g.Translator.create === 'function') {
      const options = {
        sourceLanguage: 'en',
        targetLanguage: targetLang,
      };
      if (typeof g.Translator.availability === 'function') {
        const avail = await g.Translator.availability(options);
        if (avail === 'unavailable') return null;
      }
      const instance = await g.Translator.create(options);
      chromeTranslatorCache.set(targetLang, instance);
      const out = await instance.translate(text);
      if (out?.trim()) return out.trim();
    }
  } catch {
    // Built-in Translator not available or language pack requires user gesture
  }
  return null;
}

/**
 * Translates via MyMemory Translation API (`api.mymemory.translated.net`)
 * when the user explicitly opts into External Translation API fallback.
 */
async function translateViaCloudServer(
  cleanText: string,
  targetLang: TranslationLangCode
): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    cleanText
  )}&langpair=en|${encodeURIComponent(targetLang)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Translation request failed (${res.status})`);
  }
  const data = await res.json();
  const translated: string = data?.responseData?.translatedText || '';
  if (!translated) {
    throw new Error('No translation returned');
  }
  return translated;
}

function extractCleanTranslationLine(raw: string): string {
  const withoutTags = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .replace(
      /<\|thought\|>[\s\S]*?(?:<\|thought\|>|<\/thought>|<thought\|>|$)/gi,
      ''
    )
    .trim();
  const firstNonEmptyLine =
    withoutTags
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) || '';
  const afterArrow = firstNonEmptyLine.includes('→') || firstNonEmptyLine.includes('->')
    ? (firstNonEmptyLine.split(/→|->/).pop() || '').trim()
    : firstNonEmptyLine;
  return afterArrow
    .replace(/^(?:日本語訳|日本語|意味|訳|Translation|Meaning)\s*[:：]\s*/i, '')
    .replace(/^["'「『`]+|["'」』`]+$/g, '')
    .trim();
}

function isValidTargetLanguageTranslation(
  output: string,
  sourceText: string,
  targetLang: TranslationLangCode
): boolean {
  if (!output) return false;
  const cleanOut = output.trim();
  const cleanSrc = sourceText.trim();
  if (cleanOut.toLowerCase() === cleanSrc.toLowerCase()) {
    return false;
  }
  if (targetLang === 'ja') {
    // Must contain at least one Hiragana, Katakana, or CJK Kanji character
    return /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/.test(cleanOut);
  }
  if (targetLang === 'zh-CN' || targetLang === 'zh-TW') {
    return /[\u3400-\u4DBF\u4E00-\u9FFF]/.test(cleanOut);
  }
  if (targetLang === 'ko') {
    return /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(cleanOut);
  }
  return cleanOut.length > 0;
}

function buildTranslationChatMessages(
  cleanText: string,
  targetLang: TranslationLangCode
): Array<{ role: 'system' | 'user'; content: string }> {
  const localizedTemplates: Record<
    TranslationLangCode,
    {
      system: string;
      user: string;
    }
  > = {
    ja: {
      system:
        'あなたは英和辞典です。与えられた英語の簡潔な日本語訳のみを出力してください。英単語や類義語は出力しないでください。',
      user: `例:\n"rapid" → 急速な、速い\n"extract vital cues" → 重要な手がかりを抽出する\n"${cleanText}" →`,
    },
    'zh-CN': {
      system:
        '你是一本英汉词典。请只输出所给英文的简短中文翻译，不要输出英文或解释。',
      user: `示例:\n"rapid" → 快速的、迅速的\n"extract vital cues" → 提取重要线索\n"${cleanText}" →`,
    },
    'zh-TW': {
      system:
        '你是一本英漢詞典。請只輸出所給英文的簡短繁體中文翻譯，不要輸出英文或解釋。',
      user: `示例:\n"rapid" → 快速的、迅速的\n"extract vital cues" → 提取重要線索\n"${cleanText}" →`,
    },
    ko: {
      system:
        '당신은 영한사전입니다. 주어진 영어의 간결한 한국어 뜻만 출력하세요.',
      user: `예시:\n"rapid" → 빠른, 신속한\n"extract vital cues" → 중요한 단서를 추출하다\n"${cleanText}" →`,
    },
    es: {
      system:
        'Eres un diccionario inglés-español. Escribe SOLO la traducción breve al español.',
      user: `Ejemplo:\n"rapid" → rápido, veloz\n"extract vital cues" → extraer pistas vitales\n"${cleanText}" →`,
    },
    fr: {
      system:
        'Vous êtes un dictionnaire anglais-français. Donnez UNIQUEMENT la traduction courte en français.',
      user: `Exemple:\n"rapid" → rapide, véloce\n"extract vital cues" → extraire des indices vitaux\n"${cleanText}" →`,
    },
    de: {
      system:
        'Du bist ein Englisch-Deutsch-Wörterbuch. Gib NUR die kurze deutsche Übersetzung aus.',
      user: `Beispiel:\n"rapid" → schnell, rasch\n"extract vital cues" → wichtige Hinweise extrahieren\n"${cleanText}" →`,
    },
  };

  const tpl = localizedTemplates[targetLang];

  return [
    {
      role: 'system',
      content: tpl.system,
    },
    {
      role: 'user',
      content: tpl.user,
    },
  ];
}

/**
 * Translates a selected word or phrase into the user's configured target language.
 * - Uses Chrome Built-in AI (`Translator` API or Gemini Nano `LanguageModel`), in-browser WebLLM, or Ollama.
 * - When local engines are unavailable and `allowCloudApi` is enabled in CONFIG, queries MyMemory API.
 */
export async function translateSelection(params: {
  text: string;
  contextSentence?: string;
  targetLang: TranslationLangCode;
  provider: LlmProviderType;
  webLlmModel?: string;
  llmEndpoint?: string;
  llmModel?: string;
  allowCloudApi?: boolean;
}): Promise<{
  translation: string;
  source: 'webllm' | 'chrome_ai' | 'chrome_translator' | 'ollama' | 'cloud_dict';
}> {
  const cleanText = params.text.trim();
  const activeModelScope =
    getLoadedWebLlmModelId() || params.webLlmModel || DEFAULT_WEBLLM_MODEL;
  const cacheKey = `${params.provider}:${activeModelScope}:${params.targetLang}:${cleanText.toLowerCase()}`;
  const cachedHit = translationResultCache.get(cacheKey);
  if (cachedHit) {
    return cachedHit;
  }

  const langInfo =
    TRANSLATION_LANGUAGES.find((l) => l.code === params.targetLang) ||
    TRANSLATION_LANGUAGES[0];

  const systemInstruction = `You are a concise English-to-${langInfo.englishName} dictionary. Translate ONLY the given English term into ${langInfo.englishName}. Output ONLY the ${langInfo.englishName} meaning (1 to 3 words, or up to 2 common meanings separated by a comma). Never output full sentences, explanations, or quotes.`;
  const prompt = `English: "${cleanText}"\n${langInfo.englishName}:`;

  // 1. If Chrome Built-in AI is selected, try Chrome Translator API first, then Gemini Nano Prompt API
  if (params.provider === 'chrome_ai') {
    const builtInTrans = await translateWithChromeBuiltInTranslator(
      cleanText,
      params.targetLang
    );
    if (builtInTrans) {
      const hit = {
        translation: builtInTrans,
        source: 'chrome_translator' as const,
      };
      translationResultCache.set(cacheKey, hit);
      return hit;
    }
    try {
      const raw = await promptChromeBuiltInAi(prompt, systemInstruction);
      const out = extractCleanTranslationLine(raw);
      if (out) {
        const hit = { translation: out, source: 'chrome_ai' as const };
        translationResultCache.set(cacheKey, hit);
        return hit;
      }
    } catch {
      // Fall through if permitted
    }
  }

  let webLlmDiagError: string | null = null;

  // 2. If WebGPU (`hachiue`) is selected (or already loaded in VRAM), run on-device translation
  if (
    (params.provider === 'webllm' && isWebLlmReady(params.webLlmModel)) ||
    isWebLlmReady()
  ) {
    try {
      // Cancel any previous in-flight translation if the user tapped a new word rapidly
      if (activeTranslationAbort) {
        activeTranslationAbort.abort();
      }
      const abortCtrl = new AbortController();
      activeTranslationAbort = abortCtrl;

      const modelId =
        getLoadedWebLlmModelId() || params.webLlmModel || DEFAULT_WEBLLM_MODEL;
      const engine = await initWebLlmEngine(modelId);
      const chatMessages = buildTranslationChatMessages(
        cleanText,
        params.targetLang
      );

      let streamedText = '';
      const reply = await runSerializedInference(() =>
        engine.generate(chatMessages, {
          temperature: 0,
          maxNewTokens: 28,
          signal: abortCtrl.signal,
          onToken: (_id, delta) => {
            streamedText += delta;
            // Stop immediately once the first non-empty line finishes
            if (streamedText.trim().length > 0 && delta.includes('\n')) {
              abortCtrl.abort();
            }
          },
        })
      );
      if (activeTranslationAbort === abortCtrl) {
        activeTranslationAbort = null;
      }

      const rawContent = reply.text || streamedText || '';
      const out = extractCleanTranslationLine(rawContent);

      if (isValidTargetLanguageTranslation(out, cleanText, params.targetLang)) {
        const hit = { translation: out, source: 'webllm' as const };
        translationResultCache.set(cacheKey, hit);
        return hit;
      }
      webLlmDiagError = `Model returned non-${langInfo.englishName} output ("${out || 'empty'}")`;
    } catch (err) {
      webLlmDiagError =
        err instanceof Error ? err.message : 'WebGPU translation failed';
    }
  }

  // 3. If Ollama is selected
  if (params.provider === 'ollama' && params.llmEndpoint) {
    try {
      const base = params.llmEndpoint.replace(/\/$/, '');
      const isOpenAiCompat = base.includes(':1234') || base.endsWith('/v1');
      const url = isOpenAiCompat
        ? `${base.replace(/\/v1$/, '')}/v1/chat/completions`
        : `${base}/api/generate`;
      const body = isOpenAiCompat
        ? JSON.stringify({
            model: params.llmModel || 'gemma2:2b',
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 32,
          })
        : JSON.stringify({
            model: params.llmModel || 'gemma2:2b',
            prompt: `${systemInstruction}\n\n${prompt}`,
            stream: false,
          });
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (res.ok) {
        const json = await res.json();
        const raw: string = isOpenAiCompat
          ? json.choices?.[0]?.message?.content || ''
          : json.response || '';
        const out = extractCleanTranslationLine(raw);
        if (out) {
          return { translation: out, source: 'ollama' };
        }
      }
    } catch {
      // Fall through if permitted
    }
  }

  // 4. Automatic On-Device Fallback: Even if WebLLM isn't loaded into VRAM yet,
  // check if Chrome's Built-in On-Device Translator API is available locally!
  const localBrowserTranslator = await translateWithChromeBuiltInTranslator(
    cleanText,
    params.targetLang
  );
  if (localBrowserTranslator) {
    return { translation: localBrowserTranslator, source: 'chrome_translator' };
  }

  // 5. External Translation API (MyMemory; Opt-In Default OFF)
  if (!params.allowCloudApi) {
    if (webLlmDiagError) {
      throw new Error(`WebGPU LLM error: ${webLlmDiagError}`);
    }
    throw new Error(
      'Local AI offline. Enable Chrome Built-in AI, load a WebGPU LLM, or turn ON "External Translation API" in CONFIG.'
    );
  }

  const translated = await translateViaCloudServer(cleanText, params.targetLang);
  return {
    translation: translated,
    source: 'cloud_dict',
  };
}
