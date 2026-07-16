import { useState } from "react";
import { Languages, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { translationApi } from "@/api/translation.api";

/**
 * A single field shown as French/English inputs stacked together, with a
 * "Translate" button that fills English from French via the server's
 * MyMemory-backed helper. Shared between the list-item editor
 * (ListFieldEditor) and the plain section-field editor (SettingsSiteContentTab)
 * so both behave identically — no separate code path where one has
 * translation and the other doesn't.
 */
export function BilingualTextField({
  label,
  multiline,
  frValue,
  enValue,
  enEdited,
  onFrChange,
  onEnChange,
}: {
  label: string;
  multiline?: boolean;
  frValue: string;
  enValue: string;
  enEdited: boolean;
  onFrChange: (v: string) => void;
  onEnChange: (v: string, markEdited: boolean) => void;
}) {
  const [translating, setTranslating] = useState(false);
  const InputComponent = multiline ? Textarea : Input;
  const inputProps = multiline ? { rows: 3 } : {};

  async function handleTranslate() {
    if (!frValue.trim()) return;
    setTranslating(true);
    try {
      const translated = await translationApi.frToEn(frValue);
      onEnChange(translated, false); // machine translation — not a manual edit
      toast.success("Traduit automatiquement");
    } catch {
      toast.error("La traduction a échoué. Vous pouvez saisir le texte anglais manuellement.");
    } finally {
      setTranslating(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/60 p-3">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className="space-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Français</span>
        <InputComponent
          {...inputProps}
          value={frValue}
          onChange={(e) => onFrChange(e.target.value)}
          className="text-sm"
        />
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            Anglais
            {enEdited && (
              <span title="Corrigé manuellement — ne sera pas écrasé par une traduction automatique">
                <Check className="h-3 w-3 text-primary" />
              </span>
            )}
          </span>
          <button
            type="button"
            className="h-6 flex items-center gap-1 px-2 text-[11px] text-muted-foreground hover:text-ink disabled:opacity-50 disabled:pointer-events-none"
            onClick={handleTranslate}
            disabled={translating || !frValue.trim()}
          >
            {translating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
            Traduire depuis le français
          </button>
        </div>
        <InputComponent
          {...inputProps}
          value={enValue}
          onChange={(e) => onEnChange(e.target.value, true)} // hand-typed — mark as manually edited
          className="text-sm"
        />
      </div>
    </div>
  );
}
