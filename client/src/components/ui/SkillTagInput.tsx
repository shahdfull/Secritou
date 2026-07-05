import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import apiClient from "@/api/axios";

interface SkillTagInputProps {
  value: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
}

export function SkillTagInput({ value, onChange, placeholder = "Ajouter une compétence..." }: SkillTagInputProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: allSkills = [] } = useQuery<string[]>({
    queryKey: ["skill-list"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: string[] }>("/freelancers/skills");
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const suggestions = input.trim().length > 0
    ? allSkills.filter(
        (s) =>
          s.toLowerCase().includes(input.toLowerCase()) &&
          !value.map((v) => v.toLowerCase()).includes(s.toLowerCase())
      ).slice(0, 6)
    : [];

  const addSkill = useCallback((skill: string) => {
    const trimmed = skill.trim();
    if (!trimmed || value.map((v) => v.toLowerCase()).includes(trimmed.toLowerCase())) return;
    onChange([...value, trimmed]);
    setInput("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [value, onChange]);

  const removeSkill = useCallback((skill: string) => {
    onChange(value.filter((v) => v !== skill));
  }, [value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addSkill(input);
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative">
      <div
        className="flex flex-wrap gap-1.5 min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((skill) => (
          <Badge key={skill} variant="secondary" className="gap-1 pr-1 text-xs">
            {skill}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeSkill(skill); }}
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-24 bg-transparent outline-none placeholder:text-muted-foreground text-sm"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-md">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); addSkill(s); }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-1">
        Appuyez sur <kbd className="px-1 py-0.5 rounded bg-muted text-xs">Entrée</kbd> ou <kbd className="px-1 py-0.5 rounded bg-muted text-xs">,</kbd> pour ajouter
      </p>
    </div>
  );
}
