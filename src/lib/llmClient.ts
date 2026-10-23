import type { MLCEngineInterface, InitProgressReport } from '@mlc-ai/web-llm';
import { TrainingPassage, QuizQuestion } from '../types/schema';
import { buildNormalizedPassage } from './chunker';

export type LlmProviderType = 'webllm' | 'ollama' | 'rule_based';

export type WebLlmModelId =
  | 'gemma3-1b-it-q4f16_1-MLC'
  | 'gemma-2-2b-it-q4f32_1-MLC-1k'
  | 'gemma-4-E2B-it-q4f32_1-MLC';

export const WEBLLM_MODEL_OPTIONS: Array<{
  id: WebLlmModelId;
  label: string;
  vram: string;
  desc: string;
}> = [
  {
    id: 'gemma3-1b-it-q4f16_1-MLC',
    label: 'GEMMA 3 1B',
    vram: '0.7 GB',
    desc: 'Ultra-lightweight (Sliding Window 512)',
  },
  {
    id: 'gemma-2-2b-it-q4f32_1-MLC-1k',
    label: 'GEMMA 2 2B (F32)',
    vram: '1.9 GB',
    desc: 'FP32 compute (Safe on mobile GPUs)',
  },
  {
    id: 'gemma-4-E2B-it-q4f32_1-MLC',
    label: 'GEMMA 4 E2B (F32)',
    vram: '3.8 GB',
    desc: 'FP32 high-capacity tier',
  },
];

const MODEL_STORAGE_KEY = 'wetware_selected_webllm_model';

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
  return 'gemma3-1b-it-q4f16_1-MLC';
}

export function saveWebLlmModelSelection(modelId: WebLlmModelId): void {
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
    .map((w, idx) => `${idx + 1}. ${sanitizeTargetWord(w)} ->`)
    .join('\n');
  return `Write 3 related English words for each word below. Use commas.

1. velocity -> speed, motion, tempo
2. cortical -> neural, cerebral, sensory
3. painting -> sculpture, drawing, fresco

Now complete these 3 lines with 3 words on each line:
${numbered}`;
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
    .replace(
      /<\|thought\|>[\s\S]*?(?:<\|thought\|>|<\/thought>|<thought\|>)/gi,
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
const ENGINE_CONFIG_VERSION = 3;

interface GlobalWebLlmState {
  engine: MLCEngineInterface | null;
  loadedModelId: string | null;
  configVersion?: number;
}

const globalState: GlobalWebLlmState = (() => {
  const g = globalThis as unknown as {
    __WETWARE_WEBLLM__?: GlobalWebLlmState;
  };
  if (
    !g.__WETWARE_WEBLLM__ ||
    g.__WETWARE_WEBLLM__.configVersion !== ENGINE_CONFIG_VERSION
  ) {
    g.__WETWARE_WEBLLM__ = {
      engine: null,
      loadedModelId: null,
      configVersion: ENGINE_CONFIG_VERSION,
    };
  }
  return g.__WETWARE_WEBLLM__;
})();

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
 * Checks which of the 3 Gemma models are already stored in the browser's persistent Cache Storage
 */
export async function checkCachedWebLlmModels(): Promise<
  Record<WebLlmModelId, boolean>
> {
  const result: Record<WebLlmModelId, boolean> = {
    'gemma3-1b-it-q4f16_1-MLC': false,
    'gemma-2-2b-it-q4f32_1-MLC-1k': false,
    'gemma-4-E2B-it-q4f32_1-MLC': false,
  };
  try {
    const { hasModelInCache, prebuiltAppConfig } = await import(
      '@mlc-ai/web-llm'
    );
    await Promise.all(
      WEBLLM_MODEL_OPTIONS.map(async (opt) => {
        try {
          result[opt.id] = await hasModelInCache(opt.id, prebuiltAppConfig);
        } catch {
          result[opt.id] = false;
        }
      })
    );
  } catch {
    // Ignore if Cache API unavailable
  }
  return result;
}

/**
 * Initializes (or reuses) the in-browser WebGPU MLC Engine
 */
export async function initWebLlmEngine(
  modelId: string = DEFAULT_WEBLLM_MODEL,
  onProgress?: (text: string, progress: number) => void
): Promise<MLCEngineInterface> {
  if (!isWebGpuSupported()) {
    throw new Error(
      'WebGPU is not available in this browser context (requires Secure Context: localhost or HTTPS).'
    );
  }

  const { CreateMLCEngine, prebuiltAppConfig } = await import(
    '@mlc-ai/web-llm'
  );
  const matchedRecord = prebuiltAppConfig.model_list.find(
    (m) => m.model_id.toLowerCase() === modelId.toLowerCase()
  );
  const resolvedModelId = matchedRecord ? matchedRecord.model_id : modelId;

  // gemma3-1b-it-q4f16_1_cs1k-webgpu.wasm is compiled with AttnKind::kMHASliding
  // (sliding_window_size: 512). Setting sliding_window_size: -1 disables sliding
  // window KV cache setup (`fKVCacheEnableSlidingWindowForSeq`), causing uninitialized
  // KV cache reads and random token output. Instead, set context_window_size: -1,
  // sliding_window_size: 512, attention_sink_size: 0 for gemma3-1b.
  const isGemma3SlidingWindow = resolvedModelId
    .toLowerCase()
    .includes('gemma3-1b');
  const chatOpts = isGemma3SlidingWindow
    ? {
        context_window_size: -1,
        sliding_window_size: 512,
        attention_sink_size: 0,
      }
    : undefined;

  if (
    globalState.engine &&
    globalState.loadedModelId?.toLowerCase() === resolvedModelId.toLowerCase()
  ) {
    return globalState.engine;
  }

  if (globalState.engine) {
    globalState.engine.setInitProgressCallback((report: InitProgressReport) => {
      onProgress?.(report.text, report.progress);
    });
    await globalState.engine.reload(resolvedModelId, chatOpts);
    globalState.loadedModelId = resolvedModelId;
    return globalState.engine;
  }

  const engine = await CreateMLCEngine(
    resolvedModelId,
    {
      appConfig: prebuiltAppConfig,
      initProgressCallback: (report: InitProgressReport) => {
        onProgress?.(report.text, report.progress);
      },
    },
    chatOpts
  );

  globalState.engine = engine;
  globalState.loadedModelId = resolvedModelId;
  return engine;
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

/**
 * Unified 3-Tier On-Device LLM Pipeline (Section 6.3):
 * 1. 'webllm': In-browser WebGPU execution via `@mlc-ai/web-llm`
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

  const targetWords = basePassage.questions.map(
    (q) => q.options[q.correctIndex]
  );
  const distractorPrompt = buildDistractorPrompt(targetWords);

  // Tier A: In-Browser WebGPU (@mlc-ai/web-llm) — Ultra-lightweight distractor word generation
  if (params.provider === 'webllm') {
    try {
      const modelId = params.webLlmModel || DEFAULT_WEBLLM_MODEL;
      const engine = await initWebLlmEngine(modelId, (text, progress) => {
        const pct = Math.round(progress * 100);
        params.onProgress?.(`[WebGPU ${pct}%] ${text}`);
      });

      params.onProgress?.(
        `Generating Cloze distractors on WebGPU (${modelId})...`
      );

      const reply = await engine.chat.completions.create({
        messages: [{ role: 'user', content: distractorPrompt }],
        temperature: 0.3,
        max_tokens: 64,
      });

      const content = reply.choices?.[0]?.message?.content || '';
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

/**
 * Translates a selected word or phrase into the user's configured target language.
 * - Uses in-browser WebLLM (if provider === 'webllm' and loaded in VRAM) or Ollama (if provider === 'ollama').
 * - Only uses the external translation API if the user explicitly enabled `allowCloudApi` in CONFIG (default OFF).
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
  source: 'webllm' | 'ollama' | 'cloud_dict';
}> {
  const cleanText = params.text.trim();
  const langInfo =
    TRANSLATION_LANGUAGES.find((l) => l.code === params.targetLang) ||
    TRANSLATION_LANGUAGES[0];

  const prompt = params.contextSentence
    ? `Translate "${cleanText}" into ${langInfo.englishName} (used in: "${params.contextSentence}"). Output ONLY the concise ${langInfo.englishName} translation in one short line:`
    : `Translate "${cleanText}" into ${langInfo.englishName}. Output ONLY the concise ${langInfo.englishName} translation in one short line:`;

  // 1. If WebLLM is selected AND already loaded in VRAM, run on-device translation
  if (params.provider === 'webllm' && isWebLlmReady(params.webLlmModel)) {
    try {
      const engine = await initWebLlmEngine(
        params.webLlmModel || DEFAULT_WEBLLM_MODEL
      );
      const reply = await engine.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 48,
      });
      const out = (reply.choices?.[0]?.message?.content || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<\|thought\|>[\s\S]*?(?:<\|thought\|>|<\/thought>|<thought\|>)/gi, '')
        .split('\n')[0]
        .replace(/^["'`]+|["'`]+$/g, '')
        .trim();
      if (out) {
        return { translation: out, source: 'webllm' };
      }
    } catch {
      // Fall through if permitted
    }
  }

  // 2. If Ollama is selected
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
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 48,
          })
        : JSON.stringify({
            model: params.llmModel || 'gemma2:2b',
            prompt,
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
        const out = raw.split('\n')[0].replace(/^["'`]+|["'`]+$/g, '').trim();
        if (out) {
          return { translation: out, source: 'ollama' };
        }
      }
    } catch {
      // Fall through if permitted
    }
  }

  // 3. External Translation API (Strictly Opt-In; Default OFF)
  if (!params.allowCloudApi) {
    throw new Error(
      'Translation engine offline. Please load an on-device LLM into VRAM or enable the External Translation API in CONFIG.'
    );
  }

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    cleanText
  )}&langpair=en|${encodeURIComponent(params.targetLang)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Translation request failed (${res.status})`);
  }
  const data = await res.json();
  const translated: string = data?.responseData?.translatedText || '';
  if (!translated) {
    throw new Error('No translation returned');
  }
  return {
    translation: translated,
    source: 'cloud_dict',
  };
}
