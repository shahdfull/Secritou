// SEC-060 (mentions @ dans les commentaires, item 6 du constat P1 rapport Product Owner) : plutôt
// qu'un parsing de texte libre (@Nom), ambigu en cas d'homonymes et cassant si le nom contient un
// espace, le client insère une syntaxe explicite `@[Nom affiché](userId)` via un autocomplete —
// ce module extrait les userId mentionnés sans jamais faire confiance au nom affiché (purement
// cosmétique, jamais utilisé pour la résolution).
const MENTION_PATTERN = /@\[[^\]]*\]\(([0-9a-fA-F-]{36})\)/g;

export function extractMentionedUserIds(content: string): string[] {
  const ids = new Set<string>();
  for (const match of content.matchAll(MENTION_PATTERN)) {
    const userId = match[1];
    if (userId) ids.add(userId);
  }
  return Array.from(ids);
}
