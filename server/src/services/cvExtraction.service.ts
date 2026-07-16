import { PDFParse } from "pdf-parse";
import logger from "../utils/logger.js";

const MAX_TEXT_CHARS = 20_000; // keeps the LLM prompt sent to n8n bounded

/**
 * Extracts plain text from a CV PDF. Only handles text-based PDFs (Word/Canva exports,
 * the overwhelming majority of submitted CVs) — a scanned image PDF yields little or no
 * text, in which case this returns null rather than sending garbage to the LLM summary step.
 */
export async function extractCvText(buffer: Buffer): Promise<string | null> {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = result.text?.trim();
    if (!text || text.length < 20) return null;
    return text.length > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;
  } catch (err) {
    logger.warn({ err }, "[cvExtraction] Failed to extract text from CV PDF");
    return null;
  }
}
