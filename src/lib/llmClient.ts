import type { MLCEngineInterface, InitProgressReport } from '@mlc-ai/web-llm';
import { TrainingPassage, QuizQuestion } from '../types/schema';
import { buildNormalizedPassage } from './chunker';

export type LlmProviderType = 'webllm' | 'ollama' | 'rule_based';

export type WebLlmModelId =
  | 'gemma3-1b-it-q4f16_1-MLC'
  | 'gemma-2-2b-it-q4f32_1-MLC-1k'
  | 'gemma-4-E2B-it-q4f16_1-MLC';

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
    desc: 'Ultra-lightweight & fast (Recommended)',
  },
  {
    id: 'gemma-2-2b-it-q4f32_1-MLC-1k',
    label: 'GEMMA 2 2B (F32)',
    vram: '1.9 GB',
    desc: 'FP32 compute (prevents mobile FP16 NaN)',
  },
  {
    id: 'gemma-4-E2B-it-q4f16_1-MLC',
    label: 'GEMMA 4 E2B',
    vram: '3.4 GB',
    desc: 'High-capacity desktop/tablet tier',
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

// Hybrid Rule + LLM Architecture:
// - Semantic chunking & discourse marker detection are handled deterministically in <1ms by `chunker.ts`
//   (avoiding 400-600 wasted output tokens of the LLM repeating the passage word-for-word).
// - The on-device LLM focuses exclusively on generating 3 compact anti-skimming comprehension questions.
const SYSTEM_PROMPT = `Generate 3 multiple-choice reading comprehension questions (1 main idea, 2 specific details) for the passage below.
Output ONLY valid JSON with double-quoted keys (no markdown fences, no commentary, keep options under 8 words):
{"questions":[{"q":"Question?","o":["Option A","Option B","Option C","Option D"],"a":0,"e":"Short reason."}]}`;

const MAX_LLM_INPUT_WORDS = 180;

function truncatePassageForLlm(rawText: string): string {
  const words = rawText.trim().split(/\s+/);
  if (words.length <= MAX_LLM_INPUT_WORDS) return rawText.trim();
  return words.slice(0, MAX_LLM_INPUT_WORDS).join(' ') + '...';
}

// Persist engine singleton on globalThis so Vite HMR updates never drop VRAM state
interface GlobalWebLlmState {
  engine: MLCEngineInterface | null;
  loadedModelId: string | null;
}

const globalState: GlobalWebLlmState = (() => {
  const g = globalThis as unknown as {
    __WETWARE_WEBLLM__?: GlobalWebLlmState;
  };
  if (!g.__WETWARE_WEBLLM__) {
    g.__WETWARE_WEBLLM__ = { engine: null, loadedModelId: null };
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
    'gemma-4-E2B-it-q4f16_1-MLC': false,
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

  // Resolve WindowSizeConfigurationError in gemma3-1b-it-q4f16_1-MLC where upstream
  // mlc-chat-config.json sets sliding_window_size: 512 while prebuiltAppConfig sets
  // context_window_size: 4096 without resetting sliding_window_size to -1.
  const chatOpts = {
    context_window_size: 1024,
    sliding_window_size: -1,
  };

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

  const questions: QuizQuestion[] | undefined = Array.isArray(parsed.questions)
    ? parsed.questions
        .slice(0, 3)
        .map((q: Record<string, unknown>, i: number) => {
          const rawOpts = Array.isArray(q.o)
            ? q.o
            : Array.isArray(q.options)
            ? q.options
            : null;
          const options = (
            rawOpts && rawOpts.length >= 4
              ? rawOpts.slice(0, 4).map(String)
              : ['Option A', 'Option B', 'Option C', 'Option D']
          ) as [string, string, string, string];
          const rawAns = q.a ?? q.correctIndex ?? 0;
          return {
            id: `q-llm-${Date.now()}-${i}`,
            code: String(q.code || `SYNAPSE-0${i + 1}`),
            question: String(q.q || q.question || ''),
            options,
            correctIndex: Math.max(0, Math.min(3, Number(rawAns) || 0)),
            explanation: String(q.e || q.explanation || ''),
          };
        })
    : undefined;

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

  // Tier A: In-Browser WebGPU (@mlc-ai/web-llm)
  if (params.provider === 'webllm') {
    try {
      const modelId = params.webLlmModel || DEFAULT_WEBLLM_MODEL;
      const engine = await initWebLlmEngine(modelId, (text, progress) => {
        const pct = Math.round(progress * 100);
        params.onProgress?.(`[WebGPU ${pct}%] ${text}`);
      });

      params.onProgress?.(
        `Running on-device WebGPU inference (${modelId})...`
      );

      // Combine system & user prompt into a single user turn; cap input words and output tokens for fast mobile inference
      const compactInput = truncatePassageForLlm(params.rawText);
      const combinedPrompt = `${SYSTEM_PROMPT}\n\nPassage:\n${compactInput}`;

      const reply = await engine.chat.completions.create({
        messages: [{ role: 'user', content: combinedPrompt }],
        temperature: 0.2,
        max_tokens: 384,
      });

      const content = reply.choices?.[0]?.message?.content || '';
      const parsed = parseLlmJsonOutput(content);

      return {
        passage: buildNormalizedPassage({
          title: params.title,
          rawText: params.rawText,
          category: params.category,
          sourceType: params.sourceType,
          chunks: parsed.chunks,
          discourseMarkerIndices: parsed.discourseMarkerIndices,
          questions: parsed.questions,
        }),
        usedProvider: 'webllm',
      };
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
      params.onProgress?.(
        `WebGPU fallback (${fallbackReason}) -> using Rule-based Chunker...`
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
      const timeout = window.setTimeout(() => controller.abort(), 18000);

      const body = isOpenAiCompat
        ? JSON.stringify({
            model: params.llmModel || 'gemma2:2b',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: params.rawText },
            ],
            temperature: 0.2,
          })
        : JSON.stringify({
            model: params.llmModel || 'gemma2:2b',
            prompt: `${SYSTEM_PROMPT}\n\nPassage:\n${params.rawText}`,
            format: 'json',
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

        const parsed = parseLlmJsonOutput(rawContent);
        return {
          passage: buildNormalizedPassage({
            title: params.title,
            rawText: params.rawText,
            category: params.category,
            sourceType: params.sourceType,
            chunks: parsed.chunks,
            discourseMarkerIndices: parsed.discourseMarkerIndices,
            questions: parsed.questions,
          }),
          usedProvider: 'ollama',
        };
      } else {
        fallbackReason = `HTTP ${response.status} from ${url}`;
      }
    } catch (err) {
      fallbackReason = err instanceof Error ? err.message : String(err);
    }
  }

  // Tier C: Rule-based Chunker & Cloze Generator Fallback
  return {
    passage: buildNormalizedPassage({
      title: params.title,
      rawText: params.rawText,
      category: params.category,
      sourceType: params.sourceType,
    }),
    usedProvider: 'rule_based',
    fallbackReason,
  };
}
