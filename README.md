# WETWARE // NEURAL OVERCLOCK

A cognitive-science speed-reading training web application designed to overcome the subvocalization bottleneck, expand parafoveal perceptual span, and benchmark effective reading throughput (`eWPM`) against empirical human distributions.

---

## Core Features

- **4 Specialized Training Modes**:
  1. **`CHUNK PACER`**: Highlights 2–4 word syntactic phrases along horizontal guide rails with optional anti-regression fade-out (`0.15` opacity on passed chunks) and zero layout shift.
  2. **`RSVP STREAM`**: Rapid Serial Visual Presentation anchored at the Optimal Recognition Point (`ORP`, ~33% pivot character in neon magenta) with punctuation-weighted dwell times (`,`: `1.3x`, `.`: `1.8x`).
  3. **`4/3/2 OVERCLOCK`**: 3-pass progressive time compression (`100%` → `75%` → `50%` duration) on the same passage to push neural decoding ceiling.
  4. **`TACHISTOSCOPE FLASH`**: Brief `130ms–250ms` parafoveal phrase flash followed by immediate 4-way recognition drills.
- **Anti-Skimming Neural Verification & 5-Axis Benchmark**:
  - Every session concludes with a 3-question comprehension check (`SYNC`).
  - Effective throughput is scored as $\text{eWPM} = \text{WPM}_{\text{raw}} \times \text{SYNC}$ and ranked against adult silent reading norms ($\mu = 238\text{ WPM}, \sigma = 51$, Brysbaert 2019) across a 5-axis radar chart (`eWPM`, `FIX_MS`, `SPAN_W`, `FWD_RATE`, `SYNC`).
  - Personal best records (`BEST`) update strictly when the comprehension check is passed ($\ge 67\%$).
- **Hybrid Rule + On-Device LLM Pipeline**:
  - Instant (`<2ms`) deterministic syntactic phrase chunking allows reading to start with zero wait time when importing from **Wikipedia REST API**, **Dev.to API**, or custom pasted text.
  - Comprehension quizzes are synthesized asynchronously in the background using **in-browser WebGPU (`@mlc-ai/web-llm`)** with selectable Gemma tiers (`Gemma 3 1B`, `Gemma 2 2B F32`, `Gemma 4 E2B F32`), a local **Ollama / OpenAI-compatible HTTP server**, or a deterministic Cloze fallback.
- **Procedural Web Audio FM Synthesizer**:
  - Built-in 4-operator FM synth telemetry (`800Hz` chunk pulse, overtake spark, C-major arpeggio chime, and sub-bass rank drop) with zero external audio assets.
- **Local-First Persistence**:
  - All session logs, custom passages, and speed preferences are stored locally in **IndexedDB** (`Dexie.js`) with full JSON export/import support.

---

## Getting Started

### Prerequisites
- Node.js 20+ and npm
- For in-browser WebGPU LLM inference (`@mlc-ai/web-llm`): a browser with WebGPU enabled served over `http://localhost` or `https://`

### Installation & Development

```bash
npm install
npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```

---

## License

Released under the [MIT License](./LICENSE).
