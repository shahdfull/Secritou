import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { aiApi, type ChatMessage } from "@/api/ai.api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function AIAssistantPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput("");
    setIsLoading(true);

    try {
      const reply = await aiApi.chat(trimmed, messages);
      setMessages([...newHistory, { role: "assistant", content: reply }]);
    } catch {
      toast.error(t("aiAssistant.errors.unavailable"));
      setMessages(messages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] max-w-3xl flex-col mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">{t("aiAssistant.title")}</h1>
        <p className="text-muted-foreground">{t("aiAssistant.subtitle")}</p>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardContent className="flex flex-1 flex-col p-0">
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center text-center text-muted-foreground">
                <Bot className="mb-4 h-12 w-12 opacity-50" />
                <p className="text-sm">{t("aiAssistant.emptyTitle")}</p>
                <p className="mt-2 text-xs">{t("aiAssistant.emptyExample")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                        msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {msg.content}
                    </div>
                    {msg.role === "user" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                    <div className="rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
                      {t("aiAssistant.thinking")}
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            )}
          </ScrollArea>

          <div className="flex gap-2 border-t p-4">
            <Input
              placeholder={t("aiAssistant.placeholder")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {t("aiAssistant.send")}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
