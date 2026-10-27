export interface LexiconPopupState {
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
}

/**
 * Extracts the exact English word and surrounding phrase/sentence at a viewport (clientX, clientY)
 * click coordinate using standard DOM caret range inspection. Returns null if the click was not
 * directly on a word.
 */
export function extractWordAtClientPoint(
  clientX: number,
  clientY: number
): {
  word: string;
  phrase: string;
  contextSentence: string;
  rect: { x: number; top: number; bottom: number };
} | null {
  if (typeof document === 'undefined') return null;

  let textNode: Node | null = null;
  let offset = 0;

  const docAny = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number
    ) => { offsetNode: Node; offset: number } | null;
  };

  if (typeof document.caretRangeFromPoint === 'function') {
    const range = document.caretRangeFromPoint(clientX, clientY);
    if (range) {
      textNode = range.startContainer;
      offset = range.startOffset;
    }
  } else if (typeof docAny.caretPositionFromPoint === 'function') {
    const pos = docAny.caretPositionFromPoint(clientX, clientY);
    if (pos) {
      textNode = pos.offsetNode;
      offset = pos.offset;
    }
  }

  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return null;
  const fullText = textNode.textContent || '';
  if (!fullText.trim()) return null;

  const isWordChar = (ch: string | undefined) =>
    Boolean(ch && /[A-Za-z0-9'-]/.test(ch));

  let idx = offset;
  if (!isWordChar(fullText[idx]) && isWordChar(fullText[idx - 1])) {
    idx = idx - 1;
  }
  if (!isWordChar(fullText[idx])) return null;

  let wordStart = idx;
  while (wordStart > 0 && isWordChar(fullText[wordStart - 1])) {
    wordStart--;
  }
  let wordEnd = idx + 1;
  while (wordEnd < fullText.length && isWordChar(fullText[wordEnd])) {
    wordEnd++;
  }

  const rawWord = fullText
    .slice(wordStart, wordEnd)
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
  if (rawWord.length < 2 || !/[A-Za-z]/.test(rawWord)) return null;

  const wordRange = document.createRange();
  wordRange.setStart(textNode, wordStart);
  wordRange.setEnd(textNode, wordEnd);
  const r = wordRange.getBoundingClientRect();

  // Ensure the click actually landed near the word's bounding box (not empty container padding)
  if (
    r.width === 0 ||
    r.height === 0 ||
    clientX < r.left - 14 ||
    clientX > r.right + 14 ||
    clientY < r.top - 14 ||
    clientY > r.bottom + 14
  ) {
    return null;
  }

  // Extract a ~4-5 word surrounding phrase from the text node for PHRASE / sibling word pills
  const beforeSlice = fullText
    .slice(Math.max(0, wordStart - 28), wordStart)
    .split(/\s+/)
    .slice(-2)
    .join(' ');
  const afterSlice = fullText
    .slice(wordEnd, Math.min(fullText.length, wordEnd + 28))
    .split(/\s+/)
    .slice(0, 2)
    .join(' ');
  const phrase = `${beforeSlice}${fullText.slice(wordStart, wordEnd)}${afterSlice}`
    .replace(/\s+/g, ' ')
    .trim();

  const parentText = (
    textNode.parentElement?.closest('p, h1, h2, h3, li, div')?.textContent ||
    fullText
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);

  return {
    word: rawWord,
    phrase: phrase || rawWord,
    contextSentence: parentText || phrase || rawWord,
    rect: {
      x: r.left + r.width / 2,
      top: r.top,
      bottom: r.bottom,
    },
  };
}
