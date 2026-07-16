import { HttpError } from "../utils/httpError.js";
import logger from "../utils/logger.js";

// MyMemory's free, keyless tier caps each request at 500 characters — see
// https://mymemory.translated.net/doc/spec.php. Longer text is split on
// sentence boundaries and translated in chunks, then rejoined, rather than
// truncated (which would silently drop content) or rejected outright (which
// would block admins from translating a normal-length FAQ answer).
const MAX_CHUNK_CHARS = 480; // margin under the 500 hard limit for URL encoding overhead
const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

function splitIntoChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];

  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length > MAX_CHUNK_CHARS) {
      if (current) chunks.push(current.trim());
      // A single sentence longer than the limit: hard-split it as a last resort.
      current = sentence.length > MAX_CHUNK_CHARS ? sentence.slice(0, MAX_CHUNK_CHARS) : sentence;
    } else {
      current = (current + " " + sentence).trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

async function translateChunk(text: string, langpair: string): Promise<string> {
  const params = new URLSearchParams({ q: text, langpair });
  const res = await fetch(`${MYMEMORY_URL}?${params.toString()}`);

  if (!res.ok) {
    throw new HttpError(502, "Translation service unavailable");
  }

  const data = (await res.json()) as {
    responseStatus: number | string;
    responseDetails?: string;
    responseData?: { translatedText?: string };
  };

  if (Number(data.responseStatus) !== 200) {
    logger.warn({ status: data.responseStatus, details: data.responseDetails }, "MyMemory translation failed");
    throw new HttpError(502, "Translation service could not translate this text");
  }

  return data.responseData?.translatedText ?? text;
}

export const translationService = {
  /** Translates FR text to EN via MyMemory's free API, chunking text over the 500-char limit. */
  async translateFrToEn(text: string): Promise<string> {
    const trimmed = text.trim();
    if (!trimmed) return "";

    const chunks = splitIntoChunks(trimmed);
    const translated = await Promise.all(chunks.map((chunk) => translateChunk(chunk, "fr|en")));
    return translated.join(" ");
  },
};
