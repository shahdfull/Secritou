import { useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Avatar } from "@/components/ui/avatar";
import { getInitials } from "../taskUtils";
import type { User } from "@/types/auth";

// SEC-060 (mentions @): rather than a bare @Name text match (ambiguous with homonyms, breaks on
// names containing a space), typing "@" opens an autocomplete over `mentionableUsers` and
// selecting one inserts an explicit `@[Display Name](userId)` token — the server
// (utils/mentions.ts#extractMentionedUserIds) only ever trusts the userId, the display name is
// purely cosmetic. `mentionableUsers` is not scope-checked client-side: the server independently
// re-verifies task access before notifying anyone mentioned (comment.service.ts), matching the
// established pattern of never trusting the client as the sole authorization boundary.
const MENTION_TRIGGER_PATTERN = /(^|\s)@([^\s@]*)$/;

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  mentionableUsers: User[];
  rows?: number;
}

export function MentionTextarea({ value, onChange, placeholder, className, mentionableUsers, rows }: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [query, setQuery] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return mentionableUsers.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 5);
  }, [query, mentionableUsers]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    const upToCaret = next.slice(0, e.target.selectionStart ?? next.length);
    const match = upToCaret.match(MENTION_TRIGGER_PATTERN);
    setQuery(match ? match[2] ?? "" : null);
  };

  const insertMention = (user: User) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const caret = textarea.selectionStart ?? value.length;
    const upToCaret = value.slice(0, caret);
    const match = upToCaret.match(MENTION_TRIGGER_PATTERN);
    if (!match) return;
    const startOfMention = caret - (match[2]?.length ?? 0) - 1;
    const before = value.slice(0, startOfMention);
    const after = value.slice(caret);
    const token = `@[${user.name}](${user.id}) `;
    onChange(before + token + after);
    setQuery(null);
    requestAnimationFrame(() => {
      textarea.focus();
      const newCaret = before.length + token.length;
      textarea.setSelectionRange(newCaret, newCaret);
    });
  };

  return (
    <Popover open={suggestions.length > 0}>
      <PopoverAnchor asChild>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onBlur={() => setQuery(null)}
          placeholder={placeholder}
          className={className}
          rows={rows}
        />
      </PopoverAnchor>
      <PopoverContent
        className="p-1 w-56"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {suggestions.map((user) => (
          <button
            key={user.id}
            type="button"
            className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted text-left"
            onMouseDown={(e) => {
              e.preventDefault();
              insertMention(user);
            }}
          >
            <Avatar className="h-6 w-6 text-xs">
              <span>{getInitials(user.name)}</span>
            </Avatar>
            <span className="truncate">{user.name}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
