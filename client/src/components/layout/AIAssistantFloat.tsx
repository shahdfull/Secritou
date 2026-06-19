import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Maximize2, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AIAssistantPage } from "@/features/ai-assistant/AIAssistantPage";
import { type ChatMessage } from "@/api/ai.api";

interface AIAssistantFloatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
}

export function AIAssistantFloat({
  open,
  onOpenChange,
  messages,
  onMessagesChange,
}: AIAssistantFloatProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "j") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const handleFullScreen = () => {
    onOpenChange(false);
    navigate("/app/ai");
  };

  return (
    <>
      <button
        onClick={() => onOpenChange(true)}
        title={t("aiAssistant.float.open")}
        className="fixed bottom-6 right-6 z-50 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <Bot className="h-6 w-6" />
      </button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col p-0 sm:w-[420px] sm:max-w-[420px] [&>button]:hidden"
          // suppress the default dark overlay
          style={{ boxShadow: "-4px 0 24px rgba(0,0,0,0.08)" }}
        >
          <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <div>
                <SheetTitle className="text-base">{t("aiAssistant.float.header")}</SheetTitle>
                <SheetDescription className="text-xs">
                  {t("aiAssistant.float.subtitle")}
                </SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onMessagesChange([])}
                title={t("aiAssistant.float.clear")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleFullScreen}
                title={t("aiAssistant.float.fullscreen")}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onOpenChange(false)}
                title={t("aiAssistant.float.close")}
              >
                ✕
              </Button>
            </div>
          </SheetHeader>

          <div className="flex flex-1 flex-col overflow-hidden">
            <AIAssistantPage
              compact
              messages={messages}
              onMessagesChange={onMessagesChange}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
