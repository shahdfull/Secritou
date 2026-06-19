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
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  useAiConversations,
  useAiConversation,
  useCreateConversation,
  useAddMessage,
  useDeleteConversation,
  useImportFromLocalStorage,
} from "@/hooks/useAiConversations";
import type { AiMessage } from "@/api/aiConversations.api";
import { cn } from "@/lib/utils";

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
        const { conversation, reply } = await createMutation.mutateAsync(trimmed);
        setActiveId(conversation.id);
        onMessagesChange([...messages, userMsg, { role: "assistant", content: reply.content }]);
      } else {
        const { reply } = await addMutation.mutateAsync({ id: activeId, message: trimmed });
        onMessagesChange([...messages, userMsg, { role: "assistant", content: reply.content }]);
      }
    } catch {
      toast.error(t("aiAssistant.errors.unavailable"));
      onMessagesChange(messages);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ScrollArea className="flex-1 p-3">
        {messages.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center text-center text-muted-foreground">
            <Bot className="mb-3 h-10 w-10 opacity-50" />
            <p className="text-sm">{t("aiAssistant.emptyTitle")}</p>
            <p className="mt-1 text-xs">{t("aiAssistant.emptyExample")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} compact />
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

  const { data: convList, isLoading: listLoading } = useAiConversations();
  const { data: activeConv, isLoading: convLoading } = useAiConversation(activeId);
  const createMutation = useCreateConversation();
  const addMutation = useAddMessage();
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
    try {
      if (!activeId) {
        const { conversation } = await createMutation.mutateAsync(trimmed);
        setActiveId(conversation.id);
      } else {
        await addMutation.mutateAsync({ id: activeId, message: trimmed });
      }
    } catch {
      toast.error(t("aiAssistant.errors.unavailable"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNew = () => setActiveId(null);

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        if (activeId === id) setActiveId(null);
      },
    });
  };

  const messages: AiMessage[] = activeConv?.messages ?? [];

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
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
                    className="hidden group-hover:flex h-5 w-5 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
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
      <div className="flex flex-1 flex-col min-w-0">
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
                onClick={() => handleDelete(activeId)}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                {t("aiAssistant.clearHistory", "Supprimer")}
              </Button>
            </div>
          )}
        </div>

        <Card className="flex flex-1 flex-col overflow-hidden">
          <CardContent className="flex flex-1 flex-col p-0">
            <ScrollArea className="flex-1 p-4">
              {convLoading ? (
                <div className="flex min-h-[300px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center text-center text-muted-foreground">
                  <Bot className="mb-4 h-12 w-12 opacity-50" />
                  <p className="text-sm">{t("aiAssistant.emptyTitle")}</p>
                  <p className="mt-2 text-xs">{t("aiAssistant.emptyExample")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} />
                  ))}
                  {isLoading && <ThinkingBubble />}
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
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

function MessageBubble({
  msg,
  compact = false,
}: {
  msg: { role: string; content: string };
  compact?: boolean;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-${compact ? "2" : "3"} ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className={`flex h-${compact ? "7" : "8"} w-${compact ? "7" : "8"} shrink-0 items-center justify-center rounded-full bg-primary/10`}>
          <Bot className={`h-${compact ? "3.5" : "4"} w-${compact ? "3.5" : "4"} text-primary`} />
        </div>
      )}
      <div
        className={`max-w-[${compact ? "85" : "80"}%] rounded-lg px-${compact ? "3" : "4"} py-2 text-sm ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {msg.content}
      </div>
      {isUser && (
        <div className={`flex h-${compact ? "7" : "8"} w-${compact ? "7" : "8"} shrink-0 items-center justify-center rounded-full bg-muted`}>
          <User className={`h-${compact ? "3.5" : "4"} w-${compact ? "3.5" : "4"}`} />
        </div>
      )}
    </div>
  );
}

function ThinkingBubble({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={`flex gap-${compact ? "2" : "3"}`}>
      <div className={`flex h-${compact ? "7" : "8"} w-${compact ? "7" : "8"} items-center justify-center rounded-full bg-primary/10`}>
        <Loader2 className={`h-${compact ? "3.5" : "4"} w-${compact ? "3.5" : "4"} animate-spin text-primary`} />
      </div>
      <div className={`rounded-lg bg-muted px-${compact ? "3" : "4"} py-2 text-sm text-muted-foreground`}>
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
