// SEC-082: comment content stores mentions as the raw `@[Display Name](userId)` token
// (MentionTextarea.tsx, matching server/src/utils/mentions.ts#extractMentionedUserIds), but
// nothing ever rendered it back into readable text — TaskDetailDrawer.tsx displayed
// `comment.content` verbatim, leaking the mentioned user's internal UUID into the comment thread.
// This renders the same token as a plain "@Name" chip, using only the display name (never the id).
const MENTION_TOKEN = /@\[([^\]]*)\]\([0-9a-fA-F-]{36}\)/g;

interface MentionTextProps {
  content: string;
}

export function MentionText({ content }: MentionTextProps) {
  const parts: (string | { name: string })[] = [];
  let lastIndex = 0;
  for (const match of content.matchAll(MENTION_TOKEN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(content.slice(lastIndex, index));
    parts.push({ name: match[1] ?? "" });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));

  return (
    <>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          <span key={i}>{part}</span>
        ) : (
          <span key={i} className="font-medium text-primary">
            @{part.name}
          </span>
        )
      )}
    </>
  );
}
