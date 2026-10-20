# WETWARE // NEURAL OVERCLOCK — 英語速読トレーニングシステム マスター設計仕様書 (v4.0)

本ドキュメントは、認知科学に基づく英語速読トレーニングシステムの全体設計、UI/UXデザイントークン、ローカルLLMパイプライン、データベース設計、およびAIコーディングエージェント（Antigravity / Cursor / Windsurf等）向けの実装指示書を統合したマスター仕様書である。

---

## 1. コア・コンセプトと科学的根拠

単なる「文字の高速提示（RSVP等）」は視覚野の刺激にはなるものの、高次の言語処理（構文解析・意味統合）が追いつかず、理解度の低下を招きやすい。本システムでは、Keith Raynerらの眼球運動研究、認知負荷理論（Cognitive Load Theory）、および神経科学における**強化学習（ドーパミン報酬系）**のメカニズムを組み合わせ、以下の4つの柱で脳の言語処理パイプラインをオーバークロックする。

1. **視覚的入力の最適化:** 傍中心窩（Parafovea）を活用したチャンク単位（2〜4語）の視野拡大と、不要な返り読み（Regression）の物理的抑制。
2. **音韻ループの抽象化:** 脳内音読（Subvocalization）を機能語（冠詞・前置詞・助動詞）から外し、内容語（名詞・本動詞・形容詞）のみに絞るダイレクト・セマンティック処理。
3. **人類の統計ベンチマーク比較と弱点特化:** 眼球運動・認知速度の各サブ指標をグローバル基準と比較し、個人のボトルネックを特定して集中的に負荷をかける。
4. **視覚・聴覚ドーパミン演出（Cyber-Wetware Juice）:** 周辺視野エフェクトと報酬予測誤差（RPE）を掛け合わせ、文字の視認性を損なわずに脳の強化学習サイクルを最大化する。

---

## 2. UI/UX デザイントークン（Cyber-Wetware Aesthetics）

PC-98/X68000時代のサイバーパンクADV（電脳神経端末・湿式電脳モニター）の美学を現代のWeb技術で再構築する。単なる角丸（`border-radius`）は一切使用せず、斜めカット（Chamfered Edge）と高コントラストなネオンカラーで統一する。

### 2.1 カラーパレット（CSS Variables定義）
```css
:root {
  /* Base Backgrounds */
  --bg-abyss: #0D0618;          /* 最背面：アビス・バイオレット */
  --bg-panel: #180B29;          /* パネル背景：ダーク・プラム */
  --bg-panel-alt: #101426;      /* サブパネル：ディープ・インディゴ */
  --bg-grid: rgba(255, 30, 122, 0.07); /* 背景ディザ・グリッド線 */

  /* Primary Neon Accents */
  --neon-cyan: #00F5D4;         /* プライマリ：解析・SYNC率・アクティブチャンク枠 */
  --neon-cyan-dim: rgba(0, 245, 212, 0.2);
  --neon-magenta: #FF1E7A;      /* セカンダリ：重要枠・警告・BPM・オーバークロック状態 */
  --neon-magenta-dim: rgba(255, 30, 122, 0.25);
  --neon-yellow: #FFE600;       /* アクセント：選択中カード・決定アクション・クリティカル正解 */
  --neon-yellow-dim: rgba(255, 230, 0, 0.2);

  /* Typography Colors */
  --text-primary: #F2F5F8;      /* 本文（高視認性オフホワイト） */
  --text-muted: #6C7A89;        /* 未読/通過済みチャンク・非アクティブ要素 */
  --text-terminal: #00F5D4;     /* メタデータ・計器テキスト */
}
```

### 2.2 ジオメトリ＆質感ルール（形状・エフェクト）
* **チャンファー（斜め角落とし）パネル:**
  `clip-path` を用い、コーナーを `8px`〜`12px` 斜めに切り落とす。
  ```css
  .cyber-panel {
    background: var(--bg-panel);
    border: 1px solid var(--neon-cyan);
    clip-path: polygon(
      0 0, calc(100% - 12px) 0, 100% 12px,
      100% 100%, 12px 100%, 0 calc(100% - 12px)
    );
    box-shadow: inset 0 0 15px rgba(0, 245, 212, 0.08);
  }
  ```
* **CRTスキャンライン＆ディザリング:**
  画面最前面に `pointer-events: none` のオーバーレイヤーを配置し、水平走査線（`repeating-linear-gradient`）を薄く（不透明度 `0.04` 程度）重ねる。ただし、**読書テキスト表示領域の中央のみスキャンラインをマスクして文字の可読性を100%保証する**。
* **ターミナル・メタデータ表記法:**
  システム内の指標はすべて等幅フォント（`JetBrains Mono`, `Fira Code`, `Share Tech Mono` 等）で表記し、世界観に没入させる。
  * セッション表示: `ACT I // WETWARE CALIBRATION`
  * 理解度スコア: `SYNC: 88%`
  * 読書速度（WPM）: `CLK: 340 WPM`
  * 負荷心拍イメージ: `BPM: 112 [OVERCLOCK]`

---

## 3. 主要評価メトリクスと「人類の平均値」ベンチマーク

表面的なWPMだけでなく、読書プロセスを5つのサブ指標に分解し、学術研究（Brysbaert 2019, Rayner 1998等）に基づく**「人類の統計分布（パーセンタイル）」**と比較してレーダーチャート化する。

| 評価指標 (Terminal表記) | 測定内容・算出式 | 非ネイティブ平均 | 人類標準 (Native Avg) | 上位10% (Pro) | 上位1% (Apex) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Effective WPM (`eWPM`)** | 理解度を掛け合わせた実効速度<br>$$eWPM = WPM_{raw} \times \text{SYNC}$$ | $135\text{ WPM}$ | **$238\text{ WPM}$**<br>($\sigma = 51$) | $320\text{ WPM}$ | $450+\text{ WPM}$ |
| **2. Fixation Speed (`FIX_MS`)** | 1チャンクあたりの平均停留時間<br>(タキストスコープおよびチャンク滞留時間) | $320\text{ ms}$ | **$225\text{ ms}$** | $180\text{ ms}$ | $140\text{ ms}$ |
| **3. Perceptual Span (`SPAN_W`)** | 1回の視線停留で処理できる語数<br>(クリアできた平均チャンク語数) | $1.2\text{ words}$ | **$2.5\text{ words}$** | $3.5\text{ words}$ | $4.5+\text{ words}$ |
| **4. Forward Flow (`FWD_RATE`)** | 全サッカードに対する「返り読み(Regression)」をしない順行割合 | $75\%$ | **$88\%$** | $94\%$ | $98\%$ |
| **5. Semantic Sync (`SYNC`)** | 高速処理時のワーキングメモリ維持率<br>（読後の神経解析クイズ正答率 $C$） | $65\%$ | **$80\%$** | $90\%$ | $95+\%$ |

### パーセンタイル算出ロジック（正規分布近似）
ネイティブ平均 $\mu = 238$、標準偏差 $\sigma = 51$ とし、ユーザーの $eWPM$ からZスコア $Z = \frac{eWPM - 238}{51}$ を計算。誤差関数 $\text{erf}(Z / \sqrt{2})$ を用いて人類上位何%（`TOP X.X%`）かをリアルタイムに算出してリザルト画面に刻印する。

---

## 4. トレーニング・エンジン仕様（4コア・モード）

ユーザーの5大指標のバランスから「認知ボトルネック」を自動診断し、以下の4つのモードから最適な負荷のドリルをルーティングする。

### Mode 1: `CHUNK PACER`（意味チャンク・ハイライト移動）
* **目的:** チャンキング（意味の塊での並列処理）と返り読み（Regression）の排除。
* **UI挙動:** パラグラフ全体を表示した状態で、現在のチャンク（2〜4語）だけを `--neon-cyan` の枠と高輝度テキストでハイライトし、周囲の未読・既読テキストを `--text-muted` に落とす。
* **Fade-out オプション:** 通過したチャンクの不透明度を `0.15` に減衰させ、物理的に返り読みを不可能にする。
* **キーボード操作:** 設定したWPMで自動進行するほか、`ArrowRight` / `Space` で手動高速ステップ、`ArrowUp` / `ArrowDown` でリアルタイムにクロック（WPM）を $\pm 20$ 増減可能。

### Mode 2: `RSVP STREAM`（高速逐次視覚提示＋ORP固定）
* **目的:** 眼球運動（サッカード）のコストをゼロにし、脳内音読（Subvocalization）の速度限界を超える感覚を掴む。
* **ORP (Optimal Recognition Point) ハイライト:** 単語または短チャンクの左から約 $30\% \sim 35\%$ の位置にある文字（認識のピボット文字）を `--neon-magenta`（`#FF1E7A`）で着色し、常に画面中央のガイドレティクル（照準線）に固定してフラッシュ表示する。
* **句読点ウェイト制御:** カンマ（`,`）を含むフレームは $\times 1.3$、ピリオド（`.`）や改行を含むフレームは $\times 1.8$ の表示時間を割り当て、脳内の構文統合バッファに余裕を与える。

### Mode 3: `4/3/2 OVERCLOCK`（時間圧縮リピート読み）
* **目的:** 既知の文章を段階的に圧縮した制限時間で3周読み切ることで、神経系の処理スループット上限を強制的に引き上げる。
* **フェーズ進行:**
  * `PASS 1 [100% TIME]`: 基準WPM（例: $220\text{ WPM}$）の制限時間タイマーで1周目を精読。
  * `PASS 2 [75% TIME]`: 同じテキストの最初に戻り、制限時間を $75\%$（約 $293\text{ WPM}$ 相当）に圧縮して2周目を走破。
  * `PASS 3 [50% TIME]`: 制限時間を $50\%$（$440\text{ WPM}$ 相当）に圧縮し、視覚イメージのみで3周目を駆け抜ける。

### Mode 4: `TACHISTOSCOPE FLASH`（瞬間チャンク判別ドリル）
* **目的:** `Fixation Speed`（停留時間）の短縮と傍中心窩（Parafovea）の視野拡大。
* **UI挙動:** 画面中央に $150\text{ ms} \sim 250\text{ ms}$ だけ3〜4語のコロケーション（例: `in accordance with the`）を瞬間提示してすぐ消去し、直後に4つの選択肢から今表示されたフレーズを0.5秒以内に当てさせる反射神経ドリル。

---

## 5. ドーパミン強化学習＆演出仕様（Visual & Audio Juice）

読解中の集中（ノルアドレナリン）と、読了・クイズ正解時の快感（ドーパミン）を最大化するため、演出を2つのフェーズに厳密に分離する。

### Phase 1: 読解中の「フロー＆ドライブ感」演出（周辺視野のみ）
※読書中のテキスト自体は絶対に揺らさず、外周フレームとプログレスバーのみで速度感を演出する。
1. **ゴースト・レーザー並走バー（Ghost Racing Bar）:**
   テキスト領域の上部に3本のレーザー・プログレスバーを走らせる。
   * `USER (CYAN)`: 現在の自分の読解位置
   * `HUMAN_AVG (GRAY/WHITE)`: $238\text{ WPM}$ で等速進行する人類平均ゴースト
   * `SELF_BEST (MAGENTA)`: 過去の自分の最高 $eWPM$ ゴースト
   * **Overtake演出:** 自分のバーがゴーストを追い抜いた瞬間、バーが黄色くスパークし、周辺視野フレームが1回フラッシュする。
2. **周辺視野スピードライン（Canvas Background）:**
   現在のWPMが $300\text{ WPM}$ を超えると背景のサイバーグリッドの流速が上がり、$400\text{ WPM}$ を超えると画面四隅にシアン〜マゼンタのオーラ（ビネット発光）が立ち上る。

### Phase 2: 読了＆「神経解析（クイズ）」フェーズの報酬爆発
1. **オペレーター・モニター（キャラクター表情差分）:**
   リザルトおよびクイズ画面には「電脳神経監査官（オペレーター）」のドット絵ワイプ（またはSVGニューロンモニター）を配置。
   * 通常時: `[STATE: OBSERVING]`（冷静な表情）
   * クイズ3秒以内クリティカル正解時: `[STATE: CONTRADICTION BROKEN // 驚愕・覚醒]` に切り替わり、カットイン演出が入る。
2. **「異議あり / 神経解析」カードUI:**
   理解度確認の4択クイズは、単なるラジオボタンではなく「証拠・解析カード（`BIO-EV-01` 等）」として提示。正解カードを叩きつける（クリックまたは数字キー `1`〜`4`）と、**50msのヒットストップ（画面停止）の直後に画面シェイク（Screen Shake）＋RGB色収差（Chromatic Aberration）フラッシュ**が発生する。
3. **Web Audio API プロシージャル効果音（外部音源ファイル不要）:**
   `AudioContext` を用いて、PC-98 / FM音源ライクなシンセ音をコード内で直接合成する。
   * チャンク移動時: 極小のローパス・クリック音（$800\text{ Hz}$ 短パルス、ON/OFF切替可）
   * クイズ正解時: アルペジオ上昇チャイム（$\text{C5} \to \text{E5} \to \text{G5} \to \text{C6}$ の矩形波＋ディレイ）
   * ランク確定時: 重低音サブベース・ドロップ＋高速カウントアップ音

---

## 6. コーパス調達＆オンデバイスLLMパイプライン（3段階モデル）

```
[Tier 1: 内蔵プリセットJSON (10〜20本)] ───────────────────────┐
[Tier 2: 検証済みAPI (Wikipedia / HN / Dev.to / arXiv)] ──┐    ├─> [Normalized Passage Schema]
[Tier 3: カスタムURL / RSS / 自由テキスト貼り付け] ────────┼─> [Local LLM (Gemma)] ──┘
                                                          └─> [Rule-based Chunker (Fallback)]
```

### 6.1 データ構造スキーマ（Normalized Passage Schema）
すべての文章データは、最終的に以下のTypeScriptインターフェースに正規化されてからトレーニングエンジンに渡される。

```typescript
export interface QuizQuestion {
  id: string;
  code: string;           // 例: "BIO-EV-01", "SYNAPSE-02"
  question: string;       // 設問テキスト
  options: [string, string, string, string]; // 4択
  correctIndex: number;   // 0〜3
  explanation: string;    // 解説（なぜその選択肢が正解か）
}

export interface TrainingPassage {
  id: string;
  sourceType: 'preset' | 'wikipedia' | 'hackernews' | 'devto' | 'arxiv' | 'rss' | 'custom';
  title: string;
  category: string;       // 例: "NEUROSCIENCE", "SYSTEM_ARCH", "QUANTUM_PHYS"
  wordCount: number;
  difficultyGrade: number;// Flesch-Kincaid Grade相当 (8.0 〜 16.0)
  rawText: string;
  chunks: string[];       // 意味の塊（2〜4語）ごとに分割された配列
  discourseMarkerIndices: number[]; // chunks配列内で逆接・結論マーカーを含むインデックス
  questions: QuizQuestion[];        // 理解度確認クイズ（通常3問）
  createdAt: number;
}
```

### 6.2 Tier 2: 検証済み外部APIエンドポイント（CORS対応）
クライアントサイドから直接 `fetch` 可能な検証済みエンドポイント：
1. **Wikipedia Random / Featured Article API:**
   * URL: `https://en.wikipedia.org/api/rest_v1/page/random/summary`
   * 取得フィールド: `title`, `extract`（約150〜300語の洗練された要約文）
2. **Dev.to Tech Articles API:**
   * URL: `https://dev.to/api/articles?per_page=10&top=7`
   * 詳細取得: `https://dev.to/api/articles/{id}` の `body_markdown` からコードブロックを除去して300語を抽出。
3. **arXiv API (Computer Science / Neuroscience Abstracts):**
   * URL: `https://export.arxiv.org/api/query?search_query=cat:cs.AI&max_results=5`
   * XMLの `<summary>` タグ内テキスト（約200〜300語の論文要旨）を抽出。

### 6.3 オンデバイスLLM（Gemma 2 / Gemma 3）連携仕様
取得した生テキスト（`rawText`）をチャンク分割し、3問の理解度クイズを自動生成するため、以下の3つのローカル推論バックエンドを抽象化アダプター（`LLMProvider`）として実装する。

1. **Ollama / LM Studio ローカルサーバー（推奨・最速）:**
   * エンドポイント: `http://localhost:11434/api/generate` (Ollama) または `http://localhost:1234/v1/chat/completions` (OpenAI互換)
   * 推奨モデル: `gemma2:2b`, `gemma3:4b`, `llama3.2:3b`
2. **WebGPU ブラウザ内推論 (`@mlc-ai/web-llm`):**
   * 外部サーバー不要でブラウザのVRAM上で `Gemma-2-2b-it-q4f16_1-MLC` を直接実行。
3. **Rule-based Fallback（LLM未使用時の即時フォールバック）:**
   * **自動チャンク分割アルゴリズム:** 前置詞（`in`, `on`, `at`, `with`, `from`, `by`）、接続詞（`that`, `which`, `because`, `although`）、句読点の前後で分割し、1チャンクが2〜4語（最大24文字以内）になるよう貪欲法（Greedy）で結合する。
   * **自動Cloze（穴埋め）クイズ生成:** 文章内の長단語（7文字以上の名詞・動詞）を3つ抽出し、その文脈から前後の単語とダミー語彙を組み合わせた4択クイズをヒューリスティックに生成する。

#### ローカルLLM用システムプロンプト（コピペ実装用）
```text
You are a cognitive science reading-training data generator.
Given an English passage, perform two tasks and output ONLY valid JSON matching the schema:
1. Split the passage into meaningful semantic chunks of 2 to 4 words each (keep prepositional phrases, noun phrases, and verb phrases intact). Perfectly preserve the original word order and punctuation.
2. Create 3 multiple-choice comprehension questions (1 main idea, 2 specific details) with 4 options each to test whether the reader genuinely understood the passage at high speed.

Output JSON Schema:
{
  "chunks": ["string"],
  "discourseMarkerIndices": [number],
  "questions": [
    {
      "code": "SYNAPSE-01",
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctIndex": 0,
      "explanation": "string"
    }
  ]
}
```

---

## 7. データ永続化（Local-First IndexedDB）＆ クラウドSync仕様

スコア履歴やカスタム記事はすべてブラウザ内の **IndexedDB（Dexie.js 推奨）** に保存し、オプションでリモートサーバーと差分同期（Delta Sync）を行う。

### 7.1 IndexedDB テーブル定義（Dexie Schema）
```typescript
import Dexie, { Table } from 'dexie';

export interface SessionLog {
  id: string;              // UUID v4
  timestamp: number;       // Unix epoch ms
  passageId: string;
  mode: 'chunk_pacer' | 'rsvp' | 'overclock_432' | 'tachistoscope';
  rawWpm: number;          // 純粋な読解速度
  syncRate: number;        // クイズ正答率 (0.0 〜 1.0)
  effectiveWpm: number;    // rawWpm * syncRate
  fixationMs: number;      // 平均停留時間 (ms)
  perceptualSpan: number;  // 平均チャンク語数
  forwardFlowRate: number; // 順行率 (0.0 〜 1.0)
  synced: 0 | 1;           // クラウド同期済みフラグ
}

export interface UserProfile {
  id: 'default';
  currentTargetWpm: number;
  bestEffectiveWpm: number;
  totalWordsRead: number;
  streakDays: number;
  lastActiveDate: string;  // YYYY-MM-DD
  llmEndpoint: string;     // 例: "http://localhost:11434"
  llmModel: string;        // 例: "gemma2:2b"
  syncEndpoint?: string;   // オプション: リモート同期URL
  syncApiKey?: string;
}
```

### 7.2 動的負荷コントロール（Adaptive Target WPM 更新式）
1セッション完了ごとに、`UserProfile.currentTargetWpm` を以下のアルゴリズムで自動更新する。
* **Overclock Success ($\text{SYNC} \ge 0.85$ かつ $\text{FWD\_RATE} \ge 0.90$):**
  $$\text{TargetWPM}_{next} = \text{round}(\text{TargetWPM} \times 1.05)$$
* **Flow State ($0.70 \le \text{SYNC} < 0.85$):**
  $$\text{TargetWPM}_{next} = \text{TargetWPM} \quad (\text{現状維持で定着})$$
* **System Desync ($\text{SYNC} < 0.70$):**
  $$\text{TargetWPM}_{next} = \text{round}(\text{TargetWPM} \times 0.95)$$

---

## 8. Antigravity / AIエージェント移行用 実装ロードマップ＆初期プロンプト

別環境（Antigravity、Cursor、Windsurf等）でプロジェクトを立ち上げる際は、このファイル（`speed_reading_app_spec.md`）をワークスペースのルートに配置し、以下の手順でエージェントに指示を出すことで破綻なく段階的にビルドできる。

### 推奨技術スタックとディレクトリ構成
* **Framework:** Vite + React + TypeScript
* **Styling:** Tailwind CSS + Custom CSS Variables（Cyber-Wetware テーマ）
* **Database:** `dexie` (IndexedDB Wrapper)
* **Icons:** `lucide-react`

```text
src/
├── assets/               # ドット絵オペレーターSVG / グリッド背景
├── components/
│   ├── layout/           # CyberHeader, CRTScanlineOverlay, ChamferedPanel
│   ├── dashboard/        # RadarBenchmarkChart, BottleneckDiagnosis, SessionHistory
│   ├── reader/           # ChunkPacerView, RsvpStreamView, Overclock432View, GhostRacingBar
│   ├── quiz/             # NeuralAnalysisQuiz, OperatorMonitor, ResultJackpotModal
│   └── corpus/           # CorpusSelector, LiveFeedFetcher, LlmSettingsModal
├── data/
│   └── presetPassages.ts # Tier 1: オフライン初期プリセット英文（最低6〜10本）
├── lib/
│   ├── db.ts             # Dexie IndexedDB 定義 & Sync ロジック
│   ├── chunker.ts        # ルールベース自動チャンク分割 & 穴埋めクイズ生成フォールバック
│   ├── llmClient.ts      # Ollama / OpenAI互換 / WebLLM 抽象化クライアント
│   ├── soundEngine.ts    # Web Audio API プロシージャルFMシンセ効果音エンジン
│   └── metrics.ts        # 人類平均パーセンタイル計算 & 動的WPM調整ロジック
└── App.tsx
```

### エージェントへの最初の指示プロンプト（コピペ用）

> ルートにある `speed_reading_app_spec.md` を読み込み、この仕様書に厳密に従って「WETWARE // NEURAL OVERCLOCK」英語速読トレーニングWebアプリケーションを構築してください。
>
> 一度にすべてを単一ファイルで書くのではなく、以下の4つのフェーズに分けて順番に実装・動作確認を進めてください。
>
> **【Phase 1: プロジェクト骨格・デザインシステム・音源エンジン】**
> 1. Vite + React + TypeScript + Tailwind CSS の構成をセットアップする。
> 2. 仕様書 Section 2 の CSS Variables（`#0D0618` ベース、`#00F5D4` シアン、`#FF1E7A` マゼンタ、`#FFE600` イエロー）と斜めカット（Chamfered）パネルコンポーネント、CRTスキャンラインオーバーレイを実装する。
> 3. `src/lib/soundEngine.ts` に Web Audio API を使ったレトロ・シンセ効果音（チャンク移動パルス、クイズ正解アルペジオ、ランク確定サウンド）を実装する。
> 4. `src/data/presetPassages.ts` に、認知科学やコンピュータサイエンス、サイバーパンクをテーマにした250〜300語の英語プリセットデータ（意味チャンク分割済み・4択クイズ3問付き）を5本作成する。
>
> **【Phase 2: コアリーディングエンジンとゴースト並走演出】**
> 1. `CHUNK PACER` モードと `RSVP STREAM`（ORP赤文字ハイライト付き）モード、`4/3/2 OVERCLOCK` モードの3つのリーダー画面を実装する。
> 2. リーダー上部に「人類平均（238 WPM）」および「自己ベスト」とリアルタイムに競走する `GhostRacingBar` と、高WPM時に周辺視野が発光・加速する背景Canvasエフェクトを実装する。
>
> **【Phase 3: 神経解析（クイズ）フェーズ・オペレーター演出・人類ベンチマーク比較】**
> 1. 読了直後に遷移する4択クイズ画面（証拠カードUI `BIO-EV-01` 風）と、正解時のヒットストップ＋画面シェイク＋色収差エフェクト＋オペレーター表情差分を実装する。
> 2. 仕様書 Section 3 の5大指標（`eWPM`, `FIX_MS`, `SPAN_W`, `FWD_RATE`, `SYNC`）を算出し、人類平均との比較レーダーチャートおよび上位パーセンタイル（`TOP X.X%`）をジャックポット演出で表示するリザルト画面を実装する。
>
> **【Phase 4: IndexedDB永続化・外部API取得・ローカルLLM（Ollama/Gemma）連携】**
> 1. IndexedDB（またはLocalStorage）によるセッション履歴保存と、動的負荷コントロール（+5% / -5% 自動調整）を実装する。
> 2. Wikipedia REST API および Dev.to API から最新記事を取得する機能と、`src/lib/chunker.ts`（ルールベース分割フォールバック）および `src/lib/llmClient.ts`（ローカルのOllama `localhost:11434` 等へリクエストしてチャンクとクイズをJSON生成するパイプライン）を実装する。
> 3. リモートエンドポイントへの差分SyncオプションとJSONエクスポート/インポート機能を実装する。
>
> まずは **Phase 1** から実装を開始し、完了したらプレビュー確認を求めてください。