import type { MLCEngineInterface, InitProgressReport } from '@mlc-ai/web-llm';
import { TrainingPassage, QuizQuestion } from '../types/schema';
import { buildNormalizedPassage } from './chunker';

export type LlmProviderType = 'webllm' | 'ollama' | 'rule_based';

export type WebLlmModelId =
  | 'gemma-2-2b-it-q4f16_1-MLC'
  | 'gemma-4-E2B-it-q4f16_1-MLC'
  | 'gemma3-1b-it-q4f16_1-MLC';

export const WEBLLM_MODEL_OPTIONS: Array<{
  id: WebLlmModelId;
  label: string;
  vram: string;
  desc: string;
}> = [
  {
    id: 'gemma-2-2b-it-q4f16_1-MLC',
    label: 'GEMMA 2 2B',
    vram: '1.9 GB',
    desc: 'Balanced speed & VRAM',
  },
  {
    id: 'gemma-4-E2B-it-q4f16_1-MLC',
    label: 'GEMMA 4 E2B',
    vram: '3.4 GB',
    desc: 'Best quiz & chunk quality',
  },
  {
    id: 'gemma3-1b-it-q4f16_1-MLC',
    label: 'GEMMA 3 1B',
    vram: '0.7 GB',
    desc: 'Ultra-lightweight & fast',
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
  return 'gemma-2-2b-it-q4f16_1-MLC';
}

export function saveWebLlmModelSelection(modelId: WebLlmModelId): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(MODEL_STORAGE_KEY, modelId);
  }
}

export const DEFAULT_WEBLLM_MODEL: WebLlmModelId = getSavedWebLlmModel();

const SYSTEM_PROMPT = `You are a cognitive science reading-training data generator.
Given an English passage, perform two tasks and output ONLY valid JSON matching the schema (no markdown fences, no commentary):
1. Split the passage into meaningful semantic chunks of 2 to 4 words each (keep prepositional phrases, noun phrases, and verb phrases intact). Perfectly preserve the original word order and punctuation.
2. Create 3 multiple-choice comprehension questions (1 main idea, 2 specific details) with 4 options each to test whether the reader genuinely understood the passage at high speed.

Output JSON Schema:
{
  "chunks": ["string"],
  "discourseMarkerIndices": [0],
  "questions": [
    {
      "code": "SYNAPSE-01",
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctIndex": 0,
      "explanation": "string"
    }
  ]
}`;

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
    'gemma-2-2b-it-q4f16_1-MLC': false,
    'gemma-4-E2B-it-q4f16_1-MLC': false,
    'gemma3-1b-it-q4f16_1-MLC': false,
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
    await globalState.engine.reload(resolvedModelId);
    globalState.loadedModelId = resolvedModelId;
    return globalState.engine;
  }

  const engine = await CreateMLCEngine(resolvedModelId, {
    appConfig: prebuiltAppConfig,
    initProgressCallback: (report: InitProgressReport) => {
      onProgress?.(report.text, report.progress);
    },
  });

  globalState.engine = engine;
  globalState.loadedModelId = resolvedModelId;
  return engine;
}

function parseLlmJsonOutput(rawContent: string): {
  chunks?: string[];
  discourseMarkerIndices?: number[];
  questions?: QuizQuestion[];
} {
  // Strip any thinking blocks (<think>...</think> or <|thought|>...<thought|>) and markdown fences
  let cleaned = rawContent
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\|thought\|>[\s\S]*?<thought\|>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();

  // Extract outermost JSON object {...}
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  const parsed = JSON.parse(cleaned);
  const questions: QuizQuestion[] | undefined = Array.isArray(parsed.questions)
    ? parsed.questions
        .slice(0, 3)
        .map((q: Record<string, unknown>, i: number) => ({
          id: `q-llm-${Date.now()}-${i}`,
          code: String(q.code || `SYNAPSE-0${i + 1}`),
          question: String(q.question || ''),
          options: (Array.isArray(q.options) && q.options.length === 4
            ? q.options.map(String)
            : ['Option A', 'Option B', 'Option C', 'Option D']) as [
            string,
            string,
            string,
            string,
          ],
          correctIndex: Math.max(
            0,
            Math.min(3, Number(q.correctIndex ?? 0) || 0)
          ),
          explanation: String(q.explanation || ''),
        }))
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

      // Combine system & user prompt into a single user turn for maximum Gemma 2/3/4 template compatibility
      const combinedPrompt = `${SYSTEM_PROMPT}\n\nPassage:\n${params.rawText}`;

      const reply = await engine.chat.completions.create({
        messages: [{ role: 'user', content: combinedPrompt }],
        temperature: 0.2,
        max_tokens: 1024,
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
