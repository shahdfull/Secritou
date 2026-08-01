import { useEffect, useRef, useState } from "react";
import {
  Send,
  Loader2,
  Bot,
  User,
  Trash2,
  Plus,
  MessageSquare,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDeleteDialog } from "@/components/shared/crud/ConfirmDeleteDialog";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";
import {
  useAiConversations,
  useAiConversation,
  useCreateConversation,
  useAddMessage,
  useStreamMessage,
  useDeleteConversation,
  useImportFromLocalStorage,
} from "@/hooks/useAiConversations";
import type { AiMessage } from "@/api/aiConversations.api";
import { cn } from "@/lib/utils";
import { parseAssistantMessage } from "./actionProposal";
import { ActionProposalCard } from "./ActionProposalCard";

// No response reached us at all (network down) or the server itself is failing
// (5xx, e.g. the LLM backend is unreachable) -> "service unavailable". Anything
// else (4xx: bad persona, validation, permissions...) is an application error
// the user can't fix by simply retrying later.
function isServiceUnavailableError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return true;
  if (!error.response) return true;
  return error.response.status >= 500;
}

// ── Legacy ChatMessage type (kept for compact/controlled mode compatibility) ──
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AIAssistantPageProps {
  compact?: boolean;
  messages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
}

// ── Compact controlled mode (used inside AdminLayout sidebar) ────────────────
function CompactChat({
  messages,
  onMessagesChange,
}: {
  messages: ChatMessage[];
  onMessagesChange: (m: ChatMessage[]) => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const createMutation = useCreateConversation();
  const addMutation = useAddMessage();
  const [activeId, setActiveId] = useState<string | null>(null);
  // Keyed by message index (ChatMessage has no id in this compact/local-state mode) — same
  // "lost on reload, API enrichment only" doctrine as FullChat's responseDurations.
  const [responseDurations, setResponseDurations] = useState<Record<number, number>>({});

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    setIsLoading(true);

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    onMessagesChange([...messages, userMsg]);

    try {
      if (!activeId) {
        const { conversation, reply, durationMs } = await createMutation.mutateAsync(trimmed);
        setActiveId(conversation.id);
        const nextMessages = [...messages, userMsg, { role: "assistant" as const, content: reply.content }];
        onMessagesChange(nextMessages);
        if (durationMs !== undefined) {
          setResponseDurations((prev) => ({ ...prev, [nextMessages.length - 1]: durationMs }));
        }
      } else {
        const { reply, durationMs } = await addMutation.mutateAsync({ id: activeId, message: trimmed });
        const nextMessages = [...messages, userMsg, { role: "assistant" as const, content: reply.content }];
        onMessagesChange(nextMessages);
        if (durationMs !== undefined) {
          setResponseDurations((prev) => ({ ...prev, [nextMessages.length - 1]: durationMs }));
        }
      }
    } catch (error) {
      toast.error(isServiceUnavailableError(error) ? t("aiAssistant.errors.unavailable") : t("aiAssistant.errors.appError"));
      onMessagesChange(messages);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScrollArea className="min-h-0 flex-1 p-3">
        {messages.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center text-center text-muted-foreground">
            <Bot className="mb-3 h-10 w-10 opacity-50" />
            <p className="text-sm">{t("aiAssistant.emptyTitle")}</p>
            <p className="mt-1 text-xs">{t("aiAssistant.emptyExample")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Chat is append-only (no reorder/filter); ChatMessage has no id,
                so a role+index composite is the stable key here. */}
            {messages.map((msg, i) => (
              <MessageBubble key={`${msg.role}-${i}`} msg={msg} compact durationMs={responseDurations[i]} />
            ))}
            {isLoading && <ThinkingBubble compact />}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        isLoading={isLoading}
        compact
      />
    </div>
  );
}

// ── Full-page mode with conversation list ────────────────────────────────────
function FullChat() {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  // durationMs is a per-response API enrichment, never persisted on AiMessage (see
  // aiConversation.service.ts) — kept here only for the messages answered during this page's
  // lifetime; reloading the page or switching conversations loses it, same as the rest of
  // "how this specific reply was produced" metadata (e.g. the AiToolCall trace isn't shown here
  // either).
  const [responseDurations, setResponseDurations] = useState<Record<string, number>>({});
  // The real AiMessage list only ever updates once the server has both persisted the user's
  // message AND finished generating a reply — activeConv is re-fetched (invalidated) only after
  // create()/addMessage() resolve. Without this, the user's own message would only appear at the
  // same instant as the assistant's, alongside a 10-70s wait for a slow local Ollama — this shows
  // it the instant "Envoyer" is pressed, cleared once the real list includes it.
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);

  const { data: convList, isLoading: listLoading } = useAiConversations();
  const { data: activeConv, isLoading: convLoading } = useAiConversation(activeId);
  const createMutation = useCreateConversation();
  const streamMutation = useStreamMessage();
  const deleteMutation = useDeleteConversation();
  const importMutation = useImportFromLocalStorage();

  // One-shot localStorage → backend migration
  useEffect(() => {
    const raw = localStorage.getItem("ai_chat_history");
    if (!raw) return;
    try {
      const legacy = JSON.parse(raw) as ChatMessage[];
      if (!legacy.length) return;
      localStorage.removeItem("ai_chat_history");
      importMutation.mutate(legacy, {
        onSuccess: (conv) => {
          toast.success(t("toasts.historyImported"));
          setActiveId(conv.id);
        },
      });
    } catch {
      localStorage.removeItem("ai_chat_history");
      toast.error(t("aiAssistant.errors.localHistoryLost", "Votre historique de discussion local n'a pas pu être récupéré."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages, isLoading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    setIsLoading(true);
    setPendingUserMessage(trimmed);
    try {
      if (!activeId) {
        // First message of a brand-new conversation isn't streamed — create() (server) doesn't
        // have a conversationId to persist the AiToolCall trace against until after this call
        // already succeeds, and streaming that specific path isn't worth the added complexity for
        // a single non-recurring message per conversation.
        const { conversation, reply, durationMs } = await createMutation.mutateAsync(trimmed);
        setActiveId(conversation.id);
        if (durationMs !== undefined) {
          setResponseDurations((prev) => ({ ...prev, [reply.id]: durationMs }));
        }
      } else {
        const { reply, durationMs } = await streamMutation.mutateAsync({ id: activeId, message: trimmed });
        if (durationMs !== undefined) {
          setResponseDurations((prev) => ({ ...prev, [reply.id]: durationMs }));
        }
      }
    } catch (error) {
      toast.error(isServiceUnavailableError(error) ? t("aiAssistant.errors.unavailable") : t("aiAssistant.errors.appError"));
    } finally {
      setIsLoading(false);
      setPendingUserMessage(null);
    }
  };

  const handleNew = () => setActiveId(null);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const requestDelete = (id: string) => setDeleteTargetId(id);

  const handleConfirmDelete = () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        if (activeId === id) setActiveId(null);
        setDeleteTargetId(null);
      },
      onError: () => {
        toast.error(t("aiAssistant.errors.deleteFailed"));
        setDeleteTargetId(null);
      },
    });
  };

  const messages: AiMessage[] = activeConv?.messages ?? [];

  return (
    <>
    <div className="flex h-chat-safe gap-4">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col gap-2 transition-all duration-200",
          sidebarOpen ? "w-64 shrink-0" : "w-0 overflow-hidden"
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Conversations</h2>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleNew} title="Nouvelle conversation">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {listLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : convList?.data.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1 py-4">Aucune conversation</p>
          ) : (
            <div className="space-y-1">
              {convList?.data.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-sm hover:bg-muted",
                    activeId === conv.id && "bg-muted font-medium"
                  )}
                  onClick={() => setActiveId(conv.id)}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{conv.title}</span>
                  <button
                    className="flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); requestDelete(conv.id); }}
                    title="Supprimer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </aside>

      {/* Main chat area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mb-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Masquer la liste" : "Afficher la liste"}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", !sidebarOpen && "rotate-180")} />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">{t("aiAssistant.title")}</h1>
            <p className="text-muted-foreground text-sm">{t("aiAssistant.subtitle")}</p>
          </div>
          {activeId && (
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={handleNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Nouveau
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => requestDelete(activeId)}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                {t("aiAssistant.clearHistory", "Supprimer")}
              </Button>
            </div>
          )}
        </div>

        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <ScrollArea className="min-h-0 flex-1 p-4">
              {convLoading ? (
                <div className="flex min-h-[300px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 && !pendingUserMessage ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center text-center text-muted-foreground">
                  <Bot className="mb-4 h-12 w-12 opacity-50" />
                  <p className="text-sm">{t("aiAssistant.emptyTitle")}</p>
                  <p className="mt-2 text-xs">{t("aiAssistant.emptyExample")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} durationMs={responseDurations[msg.id]} />
                  ))}
                  {pendingUserMessage && (
                    <MessageBubble msg={{ role: "user", content: pendingUserMessage }} />
                  )}
                  {streamMutation.isStreaming ? (
                    streamMutation.streamingText ? (
                      <MessageBubble msg={{ role: "assistant", content: streamMutation.streamingText }} />
                    ) : (
                      <ThinkingBubble />
                    )
                  ) : (
                    isLoading && <ThinkingBubble />
                  )}
                  <div ref={scrollRef} />
                </div>
              )}
            </ScrollArea>
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={handleSend}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
    <ConfirmDeleteDialog
      open={deleteTargetId !== null}
      onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
      onConfirm={handleConfirmDelete}
      isDeleting={deleteMutation.isPending}
      title={t("aiAssistant.deleteConversationTitle", "Supprimer cette conversation ?")}
      description={t(
        "aiAssistant.deleteConversationDesc",
        "Cette action est irréversible. La conversation et tous ses messages seront définitivement supprimés."
      )}
    />
    </>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

// durationMs formatting: below 1s shown in ms (precise enough to matter at that scale), at or
// above 1s shown in seconds with one decimal (matches how a human reads "réponse en 2.3s" rather
// than "2300ms").
function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function MessageBubble({
  msg,
  compact = false,
  durationMs,
}: {
  msg: { role: string; content: string };
  compact?: boolean;
  durationMs?: number;
}) {
  const { t } = useTranslation();
  // Two role conventions meet here: the local-only ChatMessage type (CompactChat's in-memory
  // state) uses lowercase "user"/"assistant", while AiMessage.role comes straight from Prisma's
  // AiMessageRole enum (server/prisma/schema.prisma) and is always uppercase "USER"/"ASSISTANT" —
  // a strict lowercase comparison silently matched neither for every real (server-backed)
  // message on /app/ai, so every bubble rendered as if it were the assistant's.
  const isUser = msg.role.toUpperCase() === "USER";
  // Only an ASSISTANT message can carry a proposal marker (encodeActionProposal is only ever
  // called on the model's own reply) — parsing a USER message would never find one, but skipping
  // the parse entirely for USER messages avoids running it on every keystroke-driven re-render for
  // no reason.
  const { visibleText, proposal } = isUser ? { visibleText: msg.content, proposal: null } : parseAssistantMessage(msg.content);
  // Every class below is written as a complete literal in each branch of the ternary (never
  // built by interpolating just a suffix like `gap-${compact ? "2" : "3"}`) — Tailwind's build-time
  // scanner only picks up classes it can find as whole tokens in the source text; an interpolated
  // fragment like that silently never generates the corresponding CSS rule (confirmed missing
  // max-w-[85%]/max-w-[80%] from the production build before this fix).
  //
  // w-full lives HERE, on each bubble's own row, not on the message-list wrapper one level up.
  // Radix ScrollArea wraps that wrapper in an internal `display: table; min-width: 100%` div to
  // size itself off content — putting w-full on the wrapper fights that table sizing and breaks
  // vertical scroll detection entirely (confirmed: the wrapper is exactly what must stay
  // unconstrained for Radix to detect overflow). Each individual flex row can safely claim the
  // table's full measured width without affecting how that width is computed in the first place.
  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"} ${compact ? "gap-2" : "gap-3"}`}>
      {!isUser && (
        <div
          className={`flex shrink-0 items-center justify-center rounded-full bg-primary/10 ${
            compact ? "h-7 w-7" : "h-8 w-8"
          }`}
        >
          <Bot className={`text-primary ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
        </div>
      )}
      <div className={compact ? "max-w-[85%]" : "max-w-[80%]"}>
        <div
          className={`rounded-lg py-2 text-sm ${compact ? "px-3" : "px-4"} ${
            isUser ? "bg-primary text-primary-foreground" : "bg-muted"
          }`}
        >
          {isUser ? (
            visibleText
          ) : (
            <div className="space-y-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="m-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  a: ({ children, href }) => (
                    <a href={href} target="_blank" rel="noreferrer" className="underline">
                      {children}
                    </a>
                  ),
                  code: ({ children }) => (
                    <code className="rounded bg-black/10 px-1 py-0.5 text-xs">{children}</code>
                  ),
                }}
              >
                {visibleText}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && durationMs !== undefined && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("aiAssistant.responseTime", "Réponse en {{duration}}", { duration: formatDuration(durationMs) })}
          </p>
        )}
        {proposal && <ActionProposalCard proposal={proposal} />}
      </div>
      {isUser && (
        <div
          className={`flex shrink-0 items-center justify-center rounded-full bg-muted ${
            compact ? "h-7 w-7" : "h-8 w-8"
          }`}
        >
          <User className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </div>
      )}
    </div>
  );
}

function ThinkingBubble({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={`flex ${compact ? "gap-2" : "gap-3"}`}>
      <div
        className={`flex items-center justify-center rounded-full bg-primary/10 ${
          compact ? "h-7 w-7" : "h-8 w-8"
        }`}
      >
        <Loader2 className={`animate-spin text-primary ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
      </div>
      <div className={`rounded-lg bg-muted py-2 text-sm text-muted-foreground ${compact ? "px-3" : "px-4"}`}>
        {t("aiAssistant.thinking")}
      </div>
    </div>
  );
}

function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  isLoading: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  };
  return (
    <div className={`flex gap-2 border-t ${compact ? "p-3" : "p-4"}`}>
      <Input
        placeholder={t("aiAssistant.placeholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        className={compact ? "text-sm" : ""}
      />
      <Button
        size={compact ? "sm" : "default"}
        onClick={onSend}
        disabled={isLoading || !value.trim()}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : compact ? (
          <Send className="h-4 w-4" />
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            {t("aiAssistant.send")}
          </>
        )}
      </Button>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export function AIAssistantPage({
  compact = false,
  messages: externalMessages,
  onMessagesChange,
}: AIAssistantPageProps) {
  if (compact && externalMessages !== undefined && onMessagesChange) {
    return <CompactChat messages={externalMessages} onMessagesChange={onMessagesChange} />;
  }
  return <FullChat />;
}