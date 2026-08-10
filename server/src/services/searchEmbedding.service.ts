// SEC-070: embeds the caller's query text, then delegates the scoped similarity search entirely
// to searchEmbeddingRepository — this layer adds no filtering of its own, so the RBAC boundary
// stays defined in exactly one place (the repository's WHERE clauses).
import { embedText } from "./llm.client.js";
import { searchEmbeddingRepository, type SearchEmbeddingScope, type SemanticSearchResult } from "../repositories/searchEmbedding.repository.js";

const DEFAULT_RESULT_LIMIT = 5;

export const searchEmbeddingService = {
  async searchSimilar(queryText: string, scope: SearchEmbeddingScope, limit = DEFAULT_RESULT_LIMIT): Promise<SemanticSearchResult[]> {
    const queryEmbedding = await embedText(queryText);
    return searchEmbeddingRepository.searchSimilar(queryEmbedding, scope, limit);
  },
};
